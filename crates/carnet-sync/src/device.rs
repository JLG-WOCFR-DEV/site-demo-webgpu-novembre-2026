//! Un appareil (§ 5, § 6) : file d'envoi, flux, curseurs, instantanés, troncature. Sans entrées-sorties.
//!
//! L'hôte fait les requêtes et garde l'état ([`Device::encode`]) dans la même transaction IndexedDB que
//! son journal local (§ 5.1). Le pilote synchrone [`sync`] fixe l'ordre des opérations ; l'hôte web le
//! reproduit avec des requêtes asynchrones. Un seul envoyeur par origine (verrou `carnet:sync`, § 5.1).

use crate::codec::{
    decode_batch, decode_covers, decode_docs, encode_batch, encode_covers, encode_docs, Batch,
    Covers, Docs, Reader,
};
use crate::envelope::{self, ctx_stream, Kind};
use crate::keys::{Id, Rng, RootKey};
use crate::store::{Put, Store};
use crate::Error;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub const STATE_FORMAT: u8 = 1;
pub const SNAPSHOT_FORMAT: u8 = 1;

/* ───── Noms canoniques (hexadécimal minuscule, longueur fixe ; le reste est ignoré) ───── */

pub fn hex(id: &[u8]) -> String {
    id.iter().map(|b| format!("{b:02x}")).collect()
}
fn is_lower_hex(s: &str) -> bool {
    s.bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn unhex(s: &str) -> Option<Id> {
    if s.len() != 32 || !is_lower_hex(s) {
        return None;
    }
    let mut out = [0u8; 16];
    for (i, o) in out.iter_mut().enumerate() {
        *o = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).ok()?;
    }
    Some(out)
}
fn seq_name(n: u64) -> String {
    format!("{n:016x}")
}
pub fn unseq(s: &str) -> Option<u64> {
    (s.len() == 16 && is_lower_hex(s))
        .then(|| u64::from_str_radix(s, 16).ok())
        .flatten()
}

/// Chemins (§ 8.1).
pub struct Paths<'a>(pub &'a Id);
impl Paths<'_> {
    pub fn root(&self) -> String {
        format!("nb/{}/", hex(self.0))
    }
    pub fn keyparams(&self, gen: u64) -> String {
        format!("{}keyparams/{}", self.root(), seq_name(gen))
    }
    pub fn keybox(&self, gen: u64) -> String {
        format!("{}keybox/{}", self.root(), seq_name(gen))
    }
    pub fn logs(&self) -> String {
        format!("{}log/", self.root())
    }
    pub fn log_stream(&self, st: &Id) -> String {
        format!("{}log/{}/", self.root(), hex(st))
    }
    pub fn log(&self, st: &Id, seq: u64) -> String {
        format!("{}{}", self.log_stream(st), seq_name(seq))
    }
    pub fn metas(&self) -> String {
        format!("{}meta/", self.root())
    }
    pub fn meta(&self, st: &Id, n: u64) -> String {
        format!("{}meta/{}/{}", self.root(), hex(st), seq_name(n))
    }
    pub fn snap(&self, st: &Id, n: u64) -> String {
        format!("{}snap/{}/{}", self.root(), hex(st), seq_name(n))
    }
    pub fn media(&self, id: &Id) -> String {
        format!("{}media/{}", self.root(), hex(id))
    }
}

/// `a` couvre-t-il tout ce que couvre `b` ?
pub fn dominates(a: &Covers, b: &Covers) -> bool {
    b.iter()
        .all(|(st, n)| a.get(st).copied().unwrap_or(0) >= *n)
}

/// Une entrée envoyée, pas encore confirmée : figée (texte clair et enveloppe) pour être renvoyée à l'identique.
#[derive(Clone, Debug, PartialEq)]
pub struct Inflight {
    pub seq: u64,
    pub batch: Batch,
    pub env: Vec<u8>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Ack {
    /// Écrite (ou déjà écrite par nous : accusé de réception perdu).
    Done,
    /// Place prise par un autre contenu : nouveau flux, lot remis en file (§ 5.4).
    Forked,
}

/// Fiche d'un instantané (§ 6.1), petite : on choisit sans télécharger les corps.
#[derive(Debug, Clone, PartialEq)]
pub struct Meta {
    pub st: Id,
    pub n: u64,
    pub key_version: u32,
    pub schema: u32,
    pub created_ms: u64,
    pub body_sha256: [u8; 32],
    pub covers: Covers,
    /// Instantané de rotation : la borne figée de la version précédente (§ 3.4).
    pub bound: Option<(u32, Covers)>,
}

/// Ce qu'il faut tirer.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Plan {
    pub fetch: Vec<(Id, u64)>,
    /// Numéros absents alors qu'un suivant existe (stockage en retard, troncature, ou retenue).
    pub gaps: Vec<(Id, u64)>,
    /// Le suivant d'un flux manque : peut-être tronqué, un instantané tranchera.
    pub needs_snapshot: bool,
}

pub struct Device {
    pub nb: Id,
    /// Trousseau, version courante d'abord.
    pub keys: Vec<RootKey>,
    pub stream: Id,
    pub next_seq: u64,
    pub next_snap: u64,
    pub cursors: Covers,
    /// Mises à jour **locales** en attente (jamais celles reçues d'ailleurs : § 5.1, pas d'écho).
    pub pending: Vec<(String, Vec<Vec<u8>>)>,
    pub inflight: Option<Inflight>,
    /// Flux abandonnés par fourche : on les lit comme ceux des autres.
    pub retired: Vec<Id>,
    /// Plus grande version de clé vue dans une enveloppe : on n'écrit jamais sous une version inférieure.
    pub max_version_seen: u32,
    /// Bornes figées des anciennes versions (instantanés de rotation) : au-delà, une enveloppe sous
    /// une ancienne clé est refusée (§ 3.4, appareil retiré).
    pub bounds: BTreeMap<u32, Covers>,
    /// Fiches déjà lues (non gardé : relu après un redémarrage).
    pub metas: BTreeMap<(Id, u64), Meta>,
}

impl Device {
    pub fn new(nb: Id, keys: Vec<RootKey>, rng: &mut dyn Rng) -> Device {
        let mut stream = [0u8; 16];
        rng.fill(&mut stream);
        let v = keys[0].version;
        Device {
            nb,
            keys,
            stream,
            next_seq: 1,
            next_snap: 1,
            cursors: Covers::new(),
            pending: Vec::new(),
            inflight: None,
            retired: Vec::new(),
            max_version_seen: v,
            bounds: BTreeMap::new(),
            metas: BTreeMap::new(),
        }
    }

    pub fn paths(&self) -> Paths<'_> {
        Paths(&self.nb)
    }
    fn key(&self) -> &RootKey {
        &self.keys[0]
    }

    /* ───── Écrire (§ 5.1) ───── */

    /// Une mise à jour **locale** à envoyer (dans la transaction qui l'écrit au journal local).
    pub fn queue(&mut self, doc: &str, update: Vec<u8>) {
        match self.pending.iter_mut().find(|(k, _)| k == doc) {
            Some((_, v)) => v.push(update),
            None => self.pending.push((doc.to_string(), vec![update])),
        }
    }

    pub fn has_outgoing(&self) -> bool {
        self.inflight.is_some() || !self.pending.is_empty()
    }

    /// Ce que couvre l'état de cet appareil : tout ce qu'il a appliqué, et tout ce qu'il a écrit.
    pub fn covers(&self) -> Covers {
        let mut c = self.cursors.clone();
        if self.next_seq > 1 {
            c.insert(self.stream, self.next_seq - 1);
        }
        c
    }

    /// L'entrée à écrire : celle en vol (à l'identique), sinon un nouveau lot, figé. L'hôte garde l'état avant d'envoyer.
    pub fn outgoing(&mut self, rng: &mut dyn Rng) -> Result<Option<(String, Vec<u8>)>, Error> {
        if self.key().version < self.max_version_seen {
            return Err(Error::Unsupported(
                "une clé plus récente existe : rouvre le coffre",
            ));
        }
        if self.inflight.is_none() && !self.pending.is_empty() {
            let mut docs: Docs = Vec::new();
            for (k, ups) in std::mem::take(&mut self.pending) {
                let merged = if ups.len() == 1 {
                    ups.into_iter().next().unwrap()
                } else {
                    yrs::merge_updates_v1(&ups).map_err(|e| Error::Core(e.to_string()))?
                };
                docs.push((k, merged));
            }
            let batch = Batch {
                seen: self.covers(),
                docs,
            };
            let env = envelope::seal(
                self.key(),
                Kind::Entry,
                &self.nb,
                &ctx_stream(&self.stream, self.next_seq),
                &encode_batch(&batch),
                rng,
            );
            self.inflight = Some(Inflight {
                seq: self.next_seq,
                batch,
                env,
            });
        }
        Ok(self
            .inflight
            .as_ref()
            .map(|f| (self.paths().log(&self.stream, f.seq), f.env.clone())))
    }

    /// Avant d'écrire : un numéro au-delà du nôtre sous notre flux veut dire que quelqu'un d'autre l'utilise
    /// (profil cloné, base restaurée), y compris quand la place visée a été libérée par une troncature (§ 5.4).
    pub fn own_conflict(&self, own: &[u64]) -> bool {
        let next = self
            .inflight
            .as_ref()
            .map(|f| f.seq)
            .unwrap_or(self.next_seq);
        own.iter().any(|&s| s > next) || (own.contains(&next) && self.inflight.is_none())
    }

    /// Réponse du stockage à [`outgoing`](Self::outgoing).
    pub fn ack(&mut self, put: Put, rng: &mut dyn Rng) -> Ack {
        let Some(f) = self.inflight.as_ref() else {
            return Ack::Done;
        };
        let ours = match &put {
            Put::Created => true,
            Put::Exists(bytes) => *bytes == f.env,
        };
        if ours {
            self.next_seq = f.seq + 1;
            self.inflight = None;
            return Ack::Done;
        }
        self.fork(rng);
        Ack::Forked
    }

    /// Fourche : quelqu'un d'autre écrit sous ce flux. Ce qui précède était à nous ; la suite est à lire.
    pub fn fork(&mut self, rng: &mut dyn Rng) {
        self.retired.push(self.stream);
        self.cursors.insert(self.stream, self.next_seq - 1);
        rng.fill(&mut self.stream);
        self.next_seq = 1;
        let mut again: Vec<(String, Vec<Vec<u8>>)> = match self.inflight.take() {
            Some(f) => f
                .batch
                .docs
                .into_iter()
                .map(|(k, u)| (k, vec![u]))
                .collect(),
            None => Vec::new(),
        };
        for (k, ups) in std::mem::take(&mut self.pending) {
            match again.iter_mut().find(|(kk, _)| *kk == k) {
                Some((_, v)) => v.extend(ups),
                None => again.push((k, ups)),
            }
        }
        self.pending = again;
    }

    /* ───── Lire (§ 5.2) ───── */

    /// D'après la liste des flux et de leurs numéros, ce qu'il faut lire, dans l'ordre de chaque flux.
    pub fn plan(&self, listing: &[(Id, Vec<u64>)]) -> Plan {
        let mut p = Plan::default();
        for (st, seqs) in listing {
            if *st == self.stream {
                continue;
            }
            let cur = self.cursors.get(st).copied().unwrap_or(0);
            let mut ahead: Vec<u64> = seqs.iter().copied().filter(|&s| s > cur).collect();
            ahead.sort_unstable();
            let Some(&first) = ahead.first() else {
                continue;
            };
            if first > cur + 1 {
                p.needs_snapshot = true;
                p.gaps.push((*st, cur + 1));
                continue;
            }
            for (want, s) in (cur + 1..).zip(ahead) {
                if s != want {
                    p.gaps.push((*st, want));
                    break;
                }
                p.fetch.push((*st, s));
            }
        }
        p
    }

    /// Une entrée lue : déchiffrée et vérifiée. Le curseur n'avance qu'à [`commit`](Self::commit), quand
    /// l'hôte l'a appliquée sans qu'elle reste en attente de dépendances (§ 5.2).
    pub fn receive(&mut self, st: &Id, seq: u64, env: &[u8]) -> Result<Option<Batch>, Error> {
        let cur = self.cursors.get(st).copied().unwrap_or(0);
        if seq <= cur {
            return Ok(None); // rejeu : déjà appliqué
        }
        if seq != cur + 1 {
            return Err(Error::Format("entrée hors d'ordre"));
        }
        let (_, v) = envelope::peek(env)?;
        if v < self.key().version {
            // Ancienne clé : seulement sous la borne figée par la rotation (sinon : appareil retiré, ou en retard).
            let ok = self
                .bounds
                .get(&v)
                .is_some_and(|b| b.get(st).copied().unwrap_or(0) >= seq);
            if !ok {
                return Err(Error::Stale);
            }
        }
        let plain = envelope::open(&self.keys, Kind::Entry, &self.nb, &ctx_stream(st, seq), env)?;
        self.max_version_seen = self.max_version_seen.max(v);
        Ok(Some(decode_batch(&plain)?))
    }

    pub fn commit(&mut self, st: &Id, seq: u64) {
        let c = self.cursors.entry(*st).or_insert(0);
        *c = (*c).max(seq);
    }

    /* ───── Instantanés (§ 6) ───── */

    /// Un instantané : corps (`snap/…`) puis fiche (`meta/…`), à écrire **dans cet ordre**, en création seule.
    /// `docs` : l'état complet de **chaque** document connu, vides compris.
    pub fn snapshot(
        &mut self,
        docs: &Docs,
        schema: u32,
        now_ms: u64,
        bound: Option<(u32, Covers)>,
        rng: &mut dyn Rng,
    ) -> [(String, Vec<u8>); 2] {
        let n = self.next_snap;
        self.next_snap += 1;
        let ctx = ctx_stream(&self.stream, n);
        let mut body = vec![SNAPSHOT_FORMAT];
        encode_docs(&mut body, docs);
        let body_env = envelope::seal(self.key(), Kind::Snapshot, &self.nb, &ctx, &body, rng);
        let mut m = vec![SNAPSHOT_FORMAT];
        m.extend_from_slice(&schema.to_le_bytes());
        m.extend_from_slice(&now_ms.to_le_bytes());
        m.extend_from_slice(&Sha256::digest(&body_env));
        encode_covers(&mut m, &self.covers());
        match &bound {
            None => m.push(0),
            Some((v, c)) => {
                m.push(1);
                m.extend_from_slice(&v.to_le_bytes());
                encode_covers(&mut m, c);
            }
        }
        let meta_env = envelope::seal(self.key(), Kind::SnapMeta, &self.nb, &ctx, &m, rng);
        [
            (self.paths().snap(&self.stream, n), body_env),
            (self.paths().meta(&self.stream, n), meta_env),
        ]
    }

    pub fn open_meta(&mut self, st: &Id, n: u64, env: &[u8]) -> Result<Meta, Error> {
        if let Some(m) = self.metas.get(&(*st, n)) {
            return Ok(m.clone());
        }
        let (_, key_version) = envelope::peek(env)?;
        let plain = envelope::open(
            &self.keys,
            Kind::SnapMeta,
            &self.nb,
            &ctx_stream(st, n),
            env,
        )?;
        let mut r = Reader(&plain);
        if r.u8()? != SNAPSHOT_FORMAT {
            return Err(Error::Unsupported("format d'instantané inconnu"));
        }
        let schema = r.u32()?;
        let created_ms = r.u64()?;
        let body_sha256 = r.take(32)?.try_into().unwrap();
        let covers = decode_covers(&mut r)?;
        let bound = match r.u8()? {
            0 => None,
            _ => {
                let v = r.u32()?;
                Some((v, decode_covers(&mut r)?))
            }
        };
        let m = Meta {
            st: *st,
            n,
            key_version,
            schema,
            created_ms,
            body_sha256,
            covers,
            bound,
        };
        if let Some((v, c)) = &m.bound {
            self.bounds.insert(*v, c.clone());
        }
        self.max_version_seen = self.max_version_seen.max(key_version);
        self.metas.insert((*st, n), m.clone());
        Ok(m)
    }

    /// Corps d'un instantané, vérifié contre sa fiche.
    pub fn open_body(&self, meta: &Meta, env: &[u8]) -> Result<Docs, Error> {
        if Sha256::digest(env).as_slice() != meta.body_sha256 {
            return Err(Error::Decrypt);
        }
        let plain = envelope::open(
            &self.keys,
            Kind::Snapshot,
            &self.nb,
            &ctx_stream(&meta.st, meta.n),
            env,
        )?;
        let mut r = Reader(&plain);
        if r.u8()? != SNAPSHOT_FORMAT {
            return Err(Error::Unsupported("format d'instantané inconnu"));
        }
        let docs = decode_docs(&mut r)?;
        if !r.0.is_empty() {
            return Err(Error::Format("instantané mal formé"));
        }
        Ok(docs)
    }

    /// Après avoir appliqué un instantané (par-dessus l'état local) : les curseurs avancent jusqu'à lui.
    pub fn adopt(&mut self, covers: &Covers) {
        for (st, n) in covers {
            if *st == self.stream {
                continue;
            }
            let c = self.cursors.entry(*st).or_insert(0);
            *c = (*c).max(*n);
        }
    }

    /* ───── État gardé par l'hôte ───── */

    pub fn encode(&self) -> Vec<u8> {
        let mut o = vec![STATE_FORMAT];
        o.extend_from_slice(&self.nb);
        o.extend_from_slice(&self.stream);
        o.extend_from_slice(&self.next_seq.to_le_bytes());
        o.extend_from_slice(&self.next_snap.to_le_bytes());
        o.extend_from_slice(&self.max_version_seen.to_le_bytes());
        encode_covers(&mut o, &self.cursors);
        o.extend_from_slice(&(self.retired.len() as u32).to_le_bytes());
        for st in &self.retired {
            o.extend_from_slice(st);
        }
        o.extend_from_slice(&(self.bounds.len() as u32).to_le_bytes());
        for (v, c) in &self.bounds {
            o.extend_from_slice(&v.to_le_bytes());
            encode_covers(&mut o, c);
        }
        o.extend_from_slice(&(self.pending.len() as u32).to_le_bytes());
        for (k, ups) in &self.pending {
            o.extend_from_slice(&(k.len() as u16).to_le_bytes());
            o.extend_from_slice(k.as_bytes());
            o.extend_from_slice(&(ups.len() as u32).to_le_bytes());
            for u in ups {
                o.extend_from_slice(&(u.len() as u32).to_le_bytes());
                o.extend_from_slice(u);
            }
        }
        match &self.inflight {
            None => o.push(0),
            Some(f) => {
                o.push(1);
                o.extend_from_slice(&f.seq.to_le_bytes());
                let b = encode_batch(&f.batch);
                o.extend_from_slice(&(b.len() as u32).to_le_bytes());
                o.extend_from_slice(&b);
                o.extend_from_slice(&(f.env.len() as u32).to_le_bytes());
                o.extend_from_slice(&f.env);
            }
        }
        o
    }

    pub fn decode(bytes: &[u8], keys: Vec<RootKey>) -> Result<Device, Error> {
        let mut r = Reader(bytes);
        if r.u8()? != STATE_FORMAT {
            return Err(Error::Unsupported("état de synchro d'une autre version"));
        }
        let nb: Id = r.take(16)?.try_into().unwrap();
        let stream: Id = r.take(16)?.try_into().unwrap();
        let next_seq = r.u64()?;
        let next_snap = r.u64()?;
        let max_version_seen = r.u32()?;
        let cursors = decode_covers(&mut r)?;
        let mut retired = Vec::new();
        for _ in 0..r.u32()? {
            retired.push(r.take(16)?.try_into().unwrap());
        }
        let mut bounds = BTreeMap::new();
        for _ in 0..r.u32()? {
            let v = r.u32()?;
            bounds.insert(v, decode_covers(&mut r)?);
        }
        let mut pending = Vec::new();
        for _ in 0..r.u32()? {
            let kl = r.u16()? as usize;
            let k = String::from_utf8(r.take(kl)?.to_vec())
                .map_err(|_| Error::Format("clé de document"))?;
            let mut ups = Vec::new();
            for _ in 0..r.u32()? {
                let l = r.u32()? as usize;
                ups.push(r.take(l)?.to_vec());
            }
            pending.push((k, ups));
        }
        let inflight = match r.u8()? {
            0 => None,
            _ => {
                let seq = r.u64()?;
                let bl = r.u32()? as usize;
                let batch = decode_batch(r.take(bl)?)?;
                let el = r.u32()? as usize;
                Some(Inflight {
                    seq,
                    batch,
                    env: r.take(el)?.to_vec(),
                })
            }
        };
        if !r.0.is_empty() {
            return Err(Error::Format("état de synchro mal formé"));
        }
        Ok(Device {
            nb,
            keys,
            stream,
            next_seq,
            next_snap,
            cursors,
            pending,
            inflight,
            retired,
            max_version_seen,
            bounds,
            metas: BTreeMap::new(),
        })
    }
}

/* ───── Pilote synchrone (tests, outils) ───── */

/// Ce que la synchro demande à l'état local.
pub trait Replica {
    /// Applique une mise à jour **venue d'ailleurs** (l'hôte l'écrit au journal local, pas à la file d'envoi).
    fn apply(&mut self, doc: &str, update: &[u8]) -> Result<(), Error>;
    /// L'état complet de chaque document connu, vides compris.
    fn states(&self) -> Docs;
    /// Mises à jour reçues en attente de leurs dépendances (tous documents).
    fn pending_count(&self) -> usize;
    /// Faux si le carnet est d'un schéma plus récent que ce code : ni instantané ni troncature.
    fn writable(&self) -> bool {
        true
    }
    fn schema(&self) -> u32 {
        1
    }
}

/// Liste `{ flux → numéros }` sous un préfixe (`log/`, `meta/`), noms canoniques seulement.
pub fn listing(store: &dyn Store, prefix: &str) -> Vec<(Id, Vec<u64>)> {
    store
        .list(prefix)
        .into_iter()
        .filter_map(|s| {
            unhex(&s).map(|st| {
                (
                    st,
                    store
                        .list(&format!("{prefix}{s}/"))
                        .iter()
                        .filter_map(|n| unseq(n))
                        .collect(),
                )
            })
        })
        .collect()
}

/// Ce qu'a fait un tour de synchro.
#[derive(Debug, Default)]
pub struct Report {
    pub sent: usize,
    pub received: usize,
    pub forked: bool,
    pub gaps: Vec<(Id, u64)>,
    pub snapshots_applied: usize,
    /// Entrées appliquées mais en attente de dépendances : curseur non avancé, relues au prochain tour.
    pub parked: usize,
    /// Un auteur avait vu `(flux, numéro)` que le stockage ne liste pas : retenue, ou stockage en retard.
    pub withheld: Vec<(Id, u64)>,
    /// Enveloppes rejetées (falsifiées, déplacées, ancienne clé hors borne) : le flux s'arrête à elles.
    pub rejected: Vec<(Id, u64, Error)>,
}

/// Fiches lisibles, toutes.
pub fn read_metas(dev: &mut Device, store: &dyn Store) -> Vec<Meta> {
    let mut out = Vec::new();
    for (st, ns) in listing(store, &dev.paths().metas()) {
        for n in ns {
            let Some(env) = store.get(&dev.paths().meta(&st, n)) else {
                continue;
            };
            if let Ok(m) = dev.open_meta(&st, n, &env) {
                out.push(m);
            }
        }
    }
    out
}

/// Repartir des instantanés (§ 6.3) : applique **tous** ceux qu'aucun autre ne domine (fusion CRDT), puis
/// curseurs = maximum flux par flux. Rend le nombre d'instantanés appliqués.
pub fn join_from_snapshots(
    dev: &mut Device,
    store: &dyn Store,
    replica: &mut dyn Replica,
) -> Result<usize, Error> {
    let metas = read_metas(dev, store);
    let mut applied = 0;
    for m in &metas {
        if dominates(&dev.cursors, &m.covers) {
            continue; // rien de neuf pour nous
        }
        let dominated = metas.iter().any(|o| {
            o != m
                && dominates(&o.covers, &m.covers)
                && (o.covers != m.covers || (o.st, o.n) > (m.st, m.n))
        });
        if dominated {
            continue;
        }
        let Some(env) = store.get(&dev.paths().snap(&m.st, m.n)) else {
            continue;
        };
        let Ok(docs) = dev.open_body(m, &env) else {
            continue;
        };
        for (k, state) in &docs {
            replica.apply(k, state)?;
        }
        dev.adopt(&m.covers);
        applied += 1;
    }
    Ok(applied)
}

/// Un tour complet : envoyer, puis tirer (instantanés si besoin).
pub fn sync(
    dev: &mut Device,
    store: &mut dyn Store,
    replica: &mut dyn Replica,
    rng: &mut dyn Rng,
) -> Result<Report, Error> {
    let mut rep = Report::default();
    // Fiches d'abord : elles apprennent les bornes des anciennes clés et les versions récentes.
    read_metas(dev, store);
    // Envoyer, après avoir vérifié que notre flux est bien à nous.
    if dev.has_outgoing() {
        let own: Vec<u64> = store
            .list(&dev.paths().log_stream(&dev.stream))
            .iter()
            .filter_map(|n| unseq(n))
            .collect();
        if dev.own_conflict(&own) {
            dev.fork(rng);
            rep.forked = true;
        }
    }
    while let Some((path, env)) = dev.outgoing(rng)? {
        let put = store.put_new(&path, &env);
        if dev.ack(put, rng) == Ack::Forked {
            rep.forked = true;
        } else {
            rep.sent += 1;
        }
    }
    // Tirer.
    let mut list = listing(store, &dev.paths().logs());
    let mut plan = dev.plan(&list);
    if plan.needs_snapshot {
        rep.snapshots_applied = join_from_snapshots(dev, store, replica)?;
        list = listing(store, &dev.paths().logs());
        plan = dev.plan(&list);
    }
    rep.gaps = plan.gaps;
    let listed: BTreeMap<Id, u64> = list
        .iter()
        .map(|(st, s)| (*st, s.iter().copied().max().unwrap_or(0)))
        .collect();
    let mut stopped: BTreeSet<Id> = BTreeSet::new();
    let mut parked: Vec<(Id, u64)> = Vec::new();
    for (st, seq) in plan.fetch {
        if stopped.contains(&st) {
            continue;
        }
        let Some(env) = store.get(&dev.paths().log(&st, seq)) else {
            stopped.insert(st);
            continue;
        };
        match dev.receive(&st, seq, &env) {
            Ok(None) => {}
            Ok(Some(batch)) => {
                let before = replica.pending_count();
                for (k, u) in &batch.docs {
                    replica.apply(k, u)?;
                }
                for (s, n) in &batch.seen {
                    if *s != dev.stream
                        && !dev.retired.contains(s)
                        && listed.get(s).copied().unwrap_or(0) < *n
                    {
                        rep.withheld.push((*s, *n));
                    }
                }
                rep.received += 1;
                if replica.pending_count() > before {
                    // Elle attend une dépendance : on ne la compte pas encore, ni la suite de son flux.
                    parked.push((st, seq));
                    stopped.insert(st);
                } else {
                    dev.commit(&st, seq);
                }
            }
            Err(e) => {
                rep.rejected.push((st, seq, e));
                stopped.insert(st);
            }
        }
    }
    // Plus rien n'attend : les entrées mises de côté sont intégrées, on peut les compter.
    if replica.pending_count() == 0 {
        for (st, seq) in &parked {
            dev.commit(st, *seq);
        }
    } else {
        rep.parked = parked.len();
    }
    rep.withheld.sort();
    rep.withheld.dedup();
    Ok(rep)
}

/// Instantané (si l'appareil est à jour, sans attente ni envoi en cours, et du bon schéma), puis
/// troncature (§ 6.2) :
/// - une entrée est supprimée si **deux** instantanés distincts, vérifiés ici et assez anciens, la couvrent,
///   sauf la dernière couverte de chaque flux (borne : un flux vidé deviendrait invisible) ;
/// - un instantané est supprimé s'il est dominé par deux autres encore présents.
///
/// Rend le nombre d'entrées supprimées.
pub fn snapshot_and_truncate(
    dev: &mut Device,
    store: &mut dyn Store,
    replica: &dyn Replica,
    now_ms: u64,
    min_age_ms: u64,
    rng: &mut dyn Rng,
) -> Result<usize, Error> {
    if dev.has_outgoing() || replica.pending_count() > 0 || !replica.writable() {
        return Ok(0);
    }
    let states = replica.states();
    let [(bp, be), (mp, me)] = dev.snapshot(&states, replica.schema(), now_ms, None, rng);
    // Vérifié avant envoi : relu et déchiffré, il redonne exactement l'état de chaque document.
    let n = dev.next_snap - 1;
    let st = dev.stream;
    let meta = dev.open_meta(&st, n, &me)?;
    if dev.open_body(&meta, &be)? != states {
        dev.metas.remove(&(st, n));
        return Err(Error::Format("instantané non conforme à l'état local"));
    }
    if store.put_new(&bp, &be) != Put::Created || store.put_new(&mp, &me) != Put::Created {
        return Ok(0);
    }
    // Instantanés vérifiés par cet appareil (fiche et corps).
    let mut verified: Vec<Meta> = Vec::new();
    for m in read_metas(dev, store) {
        if let Some(env) = store.get(&dev.paths().snap(&m.st, m.n)) {
            if dev.open_body(&m, &env).is_ok() {
                verified.push(m);
            }
        }
    }
    let old: Vec<&Meta> = verified
        .iter()
        .filter(|m| m.created_ms + min_age_ms <= now_ms)
        .collect();
    let mut removed = 0;
    for (st, seqs) in listing(store, &dev.paths().logs()) {
        // Le deuxième plus grand numéro couvert pour ce flux, parmi les instantanés assez anciens.
        let mut c: Vec<u64> = old
            .iter()
            .map(|m| m.covers.get(&st).copied().unwrap_or(0))
            .collect();
        c.sort_unstable_by(|a, b| b.cmp(a));
        let upto = c.get(1).copied().unwrap_or(0);
        for s in seqs.into_iter().filter(|&s| s < upto) {
            store.delete(&dev.paths().log(&st, s));
            removed += 1;
        }
    }
    // Instantanés dominés par deux autres restants, du moins couvrant au plus couvrant.
    let mut alive: Vec<Meta> = verified;
    alive.sort_by_key(|m| m.covers.values().sum::<u64>());
    let mut i = 0;
    while i < alive.len() {
        let m = &alive[i];
        let by = alive
            .iter()
            .filter(|o| (o.st, o.n) != (m.st, m.n) && dominates(&o.covers, &m.covers))
            .count();
        if by >= 2 && m.bound.is_none() {
            let key = (m.st, m.n);
            store.delete(&dev.paths().meta(&key.0, key.1));
            store.delete(&dev.paths().snap(&key.0, key.1));
            dev.metas.remove(&key);
            alive.remove(i);
        } else {
            i += 1;
        }
    }
    Ok(removed)
}
