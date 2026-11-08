//! Le carnet : un document yrs logique pour toutes les entrées (roadmap § 3.2).
//!
//! - `entries` : `Y.Map` d'ULID → `Y.Map` ; chaque champ fusionne indépendamment.
//! - `text` est un `Y.Text` aux offsets UTF-16 (convention du DOM), modifié par insertions et
//!   suppressions minimales, jamais remplacé en entier.
//! - La migration est une transaction dans ce seul document : l'ancienne place va dans `trail`,
//!   la nouvelle remplace `scope` / `day`. L'entrée garde son identité, son texte et ses éditions.
//! - `meta.dismissed` : suggestions écartées (clé → vrai).
//!
//! Le core ne fait aucune E/S : chaque commande ajoute la mise à jour yrs qu'elle a produite à une
//! file que l'hôte vide (`take_updates`) pour l'écrire ; l'hôte rend les mises à jour lues ou reçues
//! par `apply_update`.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use yrs::types::{Event, PathSegment};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{
    uuid_v4_from, Any, Array, ArrayPrelim, ArrayRef, ClientID, DeepObservable, Doc, GetString, Map,
    MapPrelim, MapRef, OffsetKind, Options, Out, ReadTxn, StateVector, Text, TextPrelim, Transact,
    TransactionMut, Update, WriteTxn,
};

use crate::date::{parse_time, Day, Month};
use crate::id::Ulid;

/// Ce que l'hôte fournit au core : l'heure (pour l'ordre et la corbeille) et l'aléa (identifiants).
pub trait Env {
    fn now_ms(&mut self) -> f64;
    fn random(&mut self) -> u128;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Task,
    Event,
    Note,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Open,
    Done,
    Cancelled,
}

/// Où vit une entrée.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(into = "String", try_from = "String")]
pub enum Scope {
    /// Log du jour (`day` obligatoire).
    Day,
    /// Notes de la semaine commençant à ce lundi.
    Week(Day),
    /// Page libre du mois (`day` optionnel : rendez-vous daté).
    Month(Month),
    /// Collection (`ulid`).
    Collection(String),
}

impl From<Scope> for String {
    fn from(s: Scope) -> String {
        match s {
            Scope::Day => "day".into(),
            Scope::Week(d) => format!("week:{d}"),
            Scope::Month(m) => format!("month:{m}"),
            Scope::Collection(c) => format!("collection:{c}"),
        }
    }
}

impl TryFrom<String> for Scope {
    type Error = Error;
    fn try_from(s: String) -> Result<Scope, Error> {
        let bad = || Error::Invalid(format!("portée inconnue : {s}"));
        if s == "day" {
            return Ok(Scope::Day);
        }
        let (k, v) = s.split_once(':').ok_or_else(bad)?;
        match k {
            "week" => {
                let d: Day = v.parse().map_err(|_| bad())?;
                if d.weekday() != 0 {
                    return Err(bad());
                }
                Ok(Scope::Week(d))
            }
            "month" => Ok(Scope::Month(v.parse().map_err(|_| bad())?)),
            "collection" if !v.is_empty() => Ok(Scope::Collection(v.to_string())),
            _ => Err(bad()),
        }
    }
}

/// Une place : une portée et, pour un jour ou un rendez-vous de mois, une date.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Place {
    pub scope: Scope,
    pub day: Option<Day>,
}

impl Place {
    pub fn day(d: Day) -> Place {
        Place {
            scope: Scope::Day,
            day: Some(d),
        }
    }
    fn check(&self) -> Result<(), Error> {
        match (&self.scope, self.day) {
            (Scope::Day, None) => Err(Error::Invalid("une entrée du jour a une date".into())),
            // Même règle qu'à la relecture (`Scope::try_from`) : une entrée acceptée ici ne doit pas disparaître au rechargement.
            (Scope::Week(d), _) if d.weekday() != 0 => {
                Err(Error::Invalid("une semaine commence un lundi".into()))
            }
            (Scope::Collection(c), _) if c.is_empty() => {
                Err(Error::Invalid("collection sans identifiant".into()))
            }
            (Scope::Month(m), Some(d)) if d.month() != *m => {
                Err(Error::Invalid("date hors du mois".into()))
            }
            (Scope::Week(_) | Scope::Collection(_), Some(_)) => {
                Err(Error::Invalid("pas de date dans cette portée".into()))
            }
            _ => Ok(()),
        }
    }
}

/// Une étape de l'historique d'une entrée : une place quittée et l'instant du départ.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Departure {
    pub from: Place,
    pub at: f64,
}

/// Une entrée telle que les vues la lisent.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub kind: Kind,
    pub state: State,
    pub priority: bool,
    pub idea: bool,
    pub text: String,
    pub time: Option<String>,
    pub place: Place,
    pub created_at: f64,
    pub trail: Vec<Departure>,
    pub deleted_at: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewEntry {
    pub kind: Option<Kind>,
    pub text: String,
    pub time: Option<String>,
    #[serde(default)]
    pub priority: bool,
    #[serde(default)]
    pub idea: bool,
}

/// Version du schéma du document que ce code sait écrire. Les migrations vont vers l'avant seulement :
/// un carnet marqué d'un schéma plus récent se lit, mais ne s'écrit plus (roadmap § 3.3).
pub const SCHEMA: u32 = 1;

#[derive(Debug, Clone, PartialEq)]
pub enum Error {
    /// Le carnet a été écrit par une version plus récente de Carnet.
    NewerSchema(u32),
    NotFound(String),
    Deleted(String),
    Invalid(String),
    Update(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::NewerSchema(n) => write!(
                f,
                "carnet enregistré par une version plus récente de Carnet (schéma {n}) : mets l'application à jour pour le modifier"
            ),
            Error::NotFound(id) => write!(f, "entrée introuvable : {id}"),
            Error::Deleted(id) => write!(f, "entrée à la corbeille : {id}"),
            Error::Invalid(m) => write!(f, "{m}"),
            Error::Update(m) => write!(f, "mise à jour illisible : {m}"),
        }
    }
}
impl std::error::Error for Error {}

/// Durée de la corbeille (règle produit : 30 jours).
pub const TRASH_MS: f64 = 30.0 * 24.0 * 3600.0 * 1000.0;

pub struct Notebook {
    doc: Doc,
    entries: MapRef,
    meta: MapRef,
    env: Box<dyn Env>,
    outbox: Vec<Vec<u8>>,
    /// Mises à jour reçues avant celles dont elles dépendent, gardées telles quelles.
    deferred: Vec<Vec<u8>>,
    /// Entrées déjà lues du document : les vues ne relisent que celles qu'une transaction a touchées
    /// (carnet de référence : 20 ms → moins d'1 ms pour une semaine). Tenu à jour par un observateur
    /// profond sur `entries`, donc aussi pour les mises à jour reçues d'ailleurs.
    cache: RefCell<HashMap<String, Entry>>,
    dirty: Arc<Mutex<Dirty>>,
}

const CACHE_OBSERVER: &str = "carnet-cache";

/// Au-delà, une mise à jour reçue est appliquée sans observateur (yrs ne calcule alors pas les
/// événements, coûteux sur un checkpoint) et le cache est relu en entier.
const BULK_UPDATE: usize = 32 * 1024;

fn observe_entries(entries: &MapRef, dirty: &Arc<Mutex<Dirty>>) {
    let d = dirty.clone();
    entries.observe_deep(CACHE_OBSERVER, move |txn, events| {
        let mut d = d.lock().unwrap_or_else(|e| e.into_inner());
        for e in events.iter() {
            match e.path().front() {
                // Un champ d'une entrée, ou son texte, ou son historique : la première clé est l'ULID.
                Some(PathSegment::Key(id)) => d.mark(id),
                // La map `entries` elle-même : entrées ajoutées ou retirées.
                None => match e {
                    Event::Map(m) => {
                        for k in m.keys(txn).keys() {
                            d.mark(k);
                        }
                    }
                    _ => *d = Dirty::All,
                },
                _ => *d = Dirty::All,
            }
        }
    });
}

/// Ce que le cache doit relire.
enum Dirty {
    All,
    Ids(HashSet<String>),
}

impl Dirty {
    fn mark(&mut self, id: &str) {
        if let Dirty::Ids(s) = self {
            s.insert(id.to_string());
        }
    }
}

/* ───── Lecture des champs ───── */
fn get_str<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> Option<String> {
    match m.get(t, k) {
        Some(Out::Any(Any::String(s))) => Some(s.to_string()),
        _ => None,
    }
}
fn get_num<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> Option<f64> {
    match m.get(t, k) {
        Some(Out::Any(Any::Number(n))) => n.as_f64(),
        _ => None,
    }
}
fn get_bool<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> bool {
    matches!(m.get(t, k), Some(Out::Any(Any::Bool(true))))
}
fn any_str(a: &HashMap<String, Any>, k: &str) -> Option<String> {
    match a.get(k) {
        Some(Any::String(s)) => Some(s.to_string()),
        _ => None,
    }
}
fn place_any(p: &Place, at: f64) -> Any {
    let mut h: HashMap<String, Any> = HashMap::new();
    h.insert(
        "scope".into(),
        Any::String(Arc::from(String::from(p.scope.clone()))),
    );
    if let Some(d) = p.day {
        h.insert("day".into(), Any::String(Arc::from(d.to_string())));
    }
    h.insert("at".into(), Any::Number(yrs::any::Number::Float(at)));
    Any::Map(Arc::new(h))
}

fn read_entry<T: ReadTxn>(id: &str, m: &MapRef, t: &T) -> Option<Entry> {
    let kind = match get_str(m, t, "kind")?.as_str() {
        "task" => Kind::Task,
        "event" => Kind::Event,
        _ => Kind::Note,
    };
    let state = match get_str(m, t, "state").as_deref() {
        Some("done") => State::Done,
        Some("cancelled") => State::Cancelled,
        _ => State::Open,
    };
    let scope = Scope::try_from(get_str(m, t, "scope")?).ok()?;
    let day = get_str(m, t, "day").and_then(|d| d.parse().ok());
    let text = match m.get(t, "text") {
        Some(Out::YText(x)) => x.get_string(t),
        _ => String::new(),
    };
    let mut trail = Vec::new();
    if let Some(Out::YArray(a)) = m.get(t, "trail") {
        for v in a.iter(t) {
            if let Out::Any(Any::Map(h)) = v {
                let Some(scope) = any_str(&h, "scope").and_then(|s| Scope::try_from(s).ok()) else {
                    continue;
                };
                let day = any_str(&h, "day").and_then(|d| d.parse().ok());
                let at = match h.get("at") {
                    Some(Any::Number(n)) => n.as_f64().unwrap_or(0.0),
                    _ => 0.0,
                };
                trail.push(Departure {
                    from: Place { scope, day },
                    at,
                });
            }
        }
    }
    Some(Entry {
        id: id.to_string(),
        kind,
        state,
        priority: get_bool(m, t, "priority"),
        idea: get_bool(m, t, "idea"),
        text,
        time: get_str(m, t, "time"),
        place: Place { scope, day },
        created_at: get_num(m, t, "createdAt").unwrap_or(0.0),
        trail,
        deleted_at: get_num(m, t, "deletedAt"),
    })
}

/// Découpe minimale entre deux textes, en unités UTF-16 et sur des frontières de caractères :
/// (début, longueur supprimée, texte inséré).
pub fn text_splice(old: &str, new: &str) -> Option<(u32, u32, String)> {
    if old == new {
        return None;
    }
    let o: Vec<char> = old.chars().collect();
    let n: Vec<char> = new.chars().collect();
    let mut p = 0;
    while p < o.len() && p < n.len() && o[p] == n[p] {
        p += 1;
    }
    let mut s = 0;
    while s < o.len() - p && s < n.len() - p && o[o.len() - 1 - s] == n[n.len() - 1 - s] {
        s += 1;
    }
    let u16len = |cs: &[char]| cs.iter().map(|c| c.len_utf16() as u32).sum::<u32>();
    let start = u16len(&o[..p]);
    let del = u16len(&o[p..o.len() - s]);
    let ins: String = n[p..n.len() - s].iter().collect();
    Some((start, del, ins))
}

impl Notebook {
    /// `client_id` : identifiant yrs de cet appareil, unique parmi ceux qui partagent le carnet (53 bits).
    pub fn new(client_id: u64, mut env: Box<dyn Env>) -> Notebook {
        let mut o = Options::with_guid_and_client_id(
            uuid_v4_from(env.random()),
            ClientID::new(client_id & ((1 << 53) - 1)),
        );
        o.offset_kind = OffsetKind::Utf16;
        let doc = Doc::with_options(o);
        let entries = doc.get_or_insert_map("entries");
        let meta = doc.get_or_insert_map("meta");
        let dirty = Arc::new(Mutex::new(Dirty::All));
        observe_entries(&entries, &dirty);
        Notebook {
            doc,
            entries,
            meta,
            env,
            outbox: Vec::new(),
            deferred: Vec::new(),
            cache: RefCell::new(HashMap::new()),
            dirty,
        }
    }

    /* ───── Mises à jour ───── */

    /// Mises à jour produites par les commandes locales depuis le dernier appel, dans l'ordre.
    pub fn take_updates(&mut self) -> Vec<Vec<u8>> {
        std::mem::take(&mut self.outbox)
    }

    /// Applique une mise à jour lue du stockage ou reçue d'un autre appareil. Idempotent, et
    /// indifférent à l'ordre d'arrivée.
    ///
    /// yrs met de côté une mise à jour qui arrive avant celles dont elle dépend, mais son tampon
    /// d'attente peut rester bloqué une fois toutes les dépendances reçues (trouvé par le test de
    /// convergence). On garde donc nous-mêmes ces mises à jour, brutes, et on les réapplique après
    /// chaque arrivée jusqu'à ce que plus rien n'attende : réappliquer est sans effet sur ce qui est
    /// déjà intégré.
    pub fn apply_update(&mut self, bytes: &[u8]) -> Result<(), Error> {
        let u = Update::decode_v1(bytes).map_err(|e| Error::Update(e.to_string()))?;
        let bulk = bytes.len() > BULK_UPDATE;
        if bulk {
            self.entries.unobserve_deep(CACHE_OBSERVER);
        }
        let missing = {
            let mut txn = self.doc.transact_mut();
            let r = txn.apply_update(u);
            let missing = txn.has_missing_updates();
            drop(txn);
            if bulk {
                *self.dirty.lock().unwrap_or_else(|e| e.into_inner()) = Dirty::All;
                observe_entries(&self.entries, &self.dirty);
            }
            r.map_err(|e| Error::Update(e.to_string()))?;
            missing
        };
        if missing {
            self.deferred.push(bytes.to_vec());
        }
        self.retry_deferred()
    }

    fn retry_deferred(&mut self) -> Result<(), Error> {
        for _ in 0..8 {
            if self.deferred.is_empty() {
                return Ok(());
            }
            let before = self.state_vector();
            let missing = {
                let mut txn = self.doc.transact_mut();
                // On repart des mises à jour brutes plutôt que du tampon interne.
                let _ = txn.prune_pending();
                for raw in &self.deferred {
                    let u = Update::decode_v1(raw).map_err(|e| Error::Update(e.to_string()))?;
                    txn.apply_update(u)
                        .map_err(|e| Error::Update(e.to_string()))?;
                }
                txn.has_missing_updates()
            };
            if !missing {
                self.deferred.clear();
                return Ok(());
            }
            if self.state_vector() == before {
                return Ok(());
            }
        }
        Ok(())
    }

    /// Tout le document, en une mise à jour (checkpoint, sauvegarde).
    pub fn encode_state(&self) -> Vec<u8> {
        self.doc
            .transact()
            .encode_state_as_update_v1(&StateVector::default())
    }

    /// Des mises à jour reçues attendent-elles encore celles dont elles dépendent ?
    pub fn has_pending(&self) -> bool {
        self.doc.transact().has_missing_updates()
    }

    pub fn state_vector(&self) -> Vec<u8> {
        self.doc.transact().state_vector().encode_v1()
    }

    /// Ce qui manque à un appareil dont on connaît le vecteur d'état.
    pub fn diff(&self, state_vector: &[u8]) -> Result<Vec<u8>, Error> {
        let sv = StateVector::decode_v1(state_vector).map_err(|e| Error::Update(e.to_string()))?;
        Ok(self.doc.transact().encode_diff_v1(&sv))
    }

    pub(crate) fn write<R>(
        &mut self,
        f: impl FnOnce(&mut TransactionMut, &MapRef, &MapRef) -> Result<R, Error>,
    ) -> Result<R, Error> {
        let (entries, meta) = (self.entries.clone(), self.meta.clone());
        let mut txn = self.doc.transact_mut();
        if let Some(n) = get_num(&meta, &txn, "schema").map(|n| n as u32) {
            if n > SCHEMA {
                return Err(Error::NewerSchema(n));
            }
        }
        let r = f(&mut txn, &entries, &meta);
        let update = txn.encode_update_v1();
        drop(txn);
        // Une commande refusée n'a rien écrit ; une mise à jour vide (deux octets) n'est pas transmise.
        if update.len() > 2 {
            self.outbox.push(update);
        }
        r
    }

    fn entry_map<T: ReadTxn>(entries: &MapRef, t: &T, id: &str) -> Result<MapRef, Error> {
        match entries.get(t, id) {
            Some(Out::YMap(m)) => Ok(m),
            _ => Err(Error::NotFound(id.to_string())),
        }
    }

    fn live_map<T: ReadTxn>(entries: &MapRef, t: &T, id: &str) -> Result<MapRef, Error> {
        let m = Self::entry_map(entries, t, id)?;
        if get_num(&m, t, "deletedAt").is_some() {
            return Err(Error::Deleted(id.to_string()));
        }
        Ok(m)
    }

    /* ───── Commandes ───── */

    pub fn add(&mut self, place: Place, e: NewEntry) -> Result<String, Error> {
        place.check()?;
        let time = match e.time.as_deref() {
            Some(t) if !t.is_empty() => {
                Some(parse_time(t).ok_or_else(|| Error::Invalid(format!("heure invalide : {t}")))?)
            }
            _ => None,
        };
        let now = self.env.now_ms();
        let id = Ulid::new(now as u64, self.env.random()).to_string();
        let kind = match e.kind.unwrap_or(Kind::Note) {
            Kind::Task => "task",
            Kind::Event => "event",
            Kind::Note => "note",
        };
        let id2 = id.clone();
        self.write(move |txn, entries, _| {
            let m = entries.insert(txn, id2.as_str(), MapPrelim::default());
            m.insert(txn, "text", TextPrelim::new(e.text));
            m.insert(txn, "kind", kind);
            m.insert(txn, "state", "open");
            m.insert(txn, "scope", String::from(place.scope.clone()));
            if let Some(d) = place.day {
                m.insert(txn, "day", d.to_string());
            }
            if let Some(t) = time {
                m.insert(txn, "time", t);
            }
            if e.priority {
                m.insert(txn, "priority", true);
            }
            if e.idea {
                m.insert(txn, "idea", true);
            }
            m.insert(txn, "createdAt", now);
            m.insert(txn, "trail", ArrayPrelim::default());
            Ok(())
        })?;
        Ok(id)
    }

    /// Remplace le texte par `new`, en n'envoyant que la différence minimale.
    pub fn set_text(&mut self, id: &str, new: &str) -> Result<(), Error> {
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            let Some(Out::YText(t)) = m.get(txn, "text") else {
                return Err(Error::Invalid("texte absent".into()));
            };
            let old = t.get_string(txn);
            if let Some((start, del, ins)) = text_splice(&old, new) {
                if del > 0 {
                    t.remove_range(txn, start, del);
                }
                if !ins.is_empty() {
                    t.insert(txn, start, &ins);
                }
            }
            Ok(())
        })
    }

    /// Une modification telle que le navigateur la décrit (offsets UTF-16), bornée au texte actuel.
    pub fn splice_text(
        &mut self,
        id: &str,
        start: u32,
        delete: u32,
        insert: &str,
    ) -> Result<(), Error> {
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            let Some(Out::YText(t)) = m.get(txn, "text") else {
                return Err(Error::Invalid("texte absent".into()));
            };
            let len = t.len(txn);
            if start > len || start + delete > len {
                return Err(Error::Invalid(format!(
                    "plage {start}+{delete} hors du texte ({len})"
                )));
            }
            if delete > 0 {
                t.remove_range(txn, start, delete);
            }
            if !insert.is_empty() {
                t.insert(txn, start, insert);
            }
            Ok(())
        })
    }

    pub fn set_state(&mut self, id: &str, s: State) -> Result<(), Error> {
        let v = match s {
            State::Open => "open",
            State::Done => "done",
            State::Cancelled => "cancelled",
        };
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            if get_str(&m, txn, "kind").as_deref() != Some("task") {
                return Err(Error::Invalid("seules les tâches ont un état".into()));
            }
            m.insert(txn, "state", v);
            Ok(())
        })
    }

    /// Ouverte → faite → annulée → ouverte.
    pub fn cycle_state(&mut self, id: &str) -> Result<State, Error> {
        let e = self
            .get(id)
            .ok_or_else(|| Error::NotFound(id.to_string()))?;
        let next = match e.state {
            State::Open => State::Done,
            State::Done => State::Cancelled,
            State::Cancelled => State::Open,
        };
        self.set_state(id, next)?;
        Ok(next)
    }

    pub fn set_time(&mut self, id: &str, time: Option<&str>) -> Result<(), Error> {
        let t = match time {
            Some(t) if !t.is_empty() => {
                Some(parse_time(t).ok_or_else(|| Error::Invalid(format!("heure invalide : {t}")))?)
            }
            _ => None,
        };
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            match t {
                Some(t) => {
                    m.insert(txn, "time", t);
                }
                None => {
                    m.remove(txn, "time");
                }
            }
            Ok(())
        })
    }

    pub fn set_marks(&mut self, id: &str, priority: bool, idea: bool) -> Result<(), Error> {
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            for (k, v) in [("priority", priority), ("idea", idea)] {
                if v {
                    m.insert(txn, k, true);
                } else {
                    m.remove(txn, k);
                }
            }
            Ok(())
        })
    }

    /// Migration : l'ancienne place va dans `trail`, la nouvelle la remplace, en une transaction.
    pub fn migrate(&mut self, id: &str, to: Place) -> Result<(), Error> {
        to.check()?;
        let now = self.env.now_ms();
        self.write(|txn, entries, _| {
            let m = Self::live_map(entries, txn, id)?;
            let e = read_entry(id, &m, txn).ok_or_else(|| Error::NotFound(id.to_string()))?;
            if e.place == to {
                return Ok(());
            }
            let trail: ArrayRef = match m.get(txn, "trail") {
                Some(Out::YArray(a)) => a,
                _ => m.insert(txn, "trail", ArrayPrelim::default()),
            };
            trail.push_back(txn, place_any(&e.place, now));
            m.insert(txn, "scope", String::from(to.scope.clone()));
            match to.day {
                Some(d) => {
                    m.insert(txn, "day", d.to_string());
                }
                None => {
                    m.remove(txn, "day");
                }
            }
            Ok(())
        })
    }

    /// Corbeille (30 jours), annulable par `restore`.
    pub fn delete(&mut self, id: &str) -> Result<(), Error> {
        let now = self.env.now_ms();
        self.write(|txn, entries, _| {
            let m = Self::entry_map(entries, txn, id)?;
            m.insert(txn, "deletedAt", now);
            Ok(())
        })
    }

    pub fn restore(&mut self, id: &str) -> Result<(), Error> {
        self.write(|txn, entries, _| {
            let m = Self::entry_map(entries, txn, id)?;
            m.remove(txn, "deletedAt");
            Ok(())
        })
    }

    /// Vide la corbeille de ce qui y est depuis plus de 30 jours. Renvoie le nombre d'entrées purgées.
    pub fn purge(&mut self) -> Result<usize, Error> {
        let now = self.env.now_ms();
        self.write(|txn, entries, _| {
            let old: Vec<String> = entries
                .iter(txn)
                .filter_map(|(k, v)| match v {
                    Out::YMap(m) => get_num(&m, txn, "deletedAt")
                        .filter(|d| now - d > TRASH_MS)
                        .map(|_| k.to_string()),
                    _ => None,
                })
                .collect();
            for k in &old {
                entries.remove(txn, k);
            }
            Ok(old.len())
        })
    }

    pub fn dismiss(&mut self, key: &str) -> Result<(), Error> {
        self.write(|txn, _, meta| {
            let d: MapRef = match meta.get(txn, "dismissed") {
                Some(Out::YMap(d)) => d,
                _ => meta.insert(txn, "dismissed", MapPrelim::default()),
            };
            d.insert(txn, key, true);
            Ok(())
        })
    }

    /// Marque le carnet du schéma de ce code s'il porte un schéma plus ancien (ou aucun).
    pub fn stamp_schema(&mut self) -> Result<(), Error> {
        if self.schema() >= SCHEMA {
            return Ok(());
        }
        self.write(|txn, _, meta| {
            meta.insert(txn, "schema", SCHEMA as f64);
            Ok(())
        })
    }

    /// Tests : simule un carnet écrit par une version future.
    #[doc(hidden)]
    pub fn force_schema_for_tests(&mut self, n: u32) {
        let mut txn = self.doc.transact_mut();
        self.meta.insert(&mut txn, "schema", n as f64);
        drop(txn);
    }

    /* ───── Lecture ───── */

    /// Schéma qui a écrit ce carnet (0 : avant le marquage).
    pub fn schema(&self) -> u32 {
        let t = self.doc.transact();
        get_num(&self.meta, &t, "schema").map_or(0, |n| n as u32)
    }

    /// Ce code peut-il modifier ce carnet ?
    pub fn writable(&self) -> bool {
        self.schema() <= SCHEMA
    }

    /// Relit dans le document les entrées touchées depuis la dernière lecture.
    fn refresh(&self) {
        let dirty = std::mem::replace(
            &mut *self.dirty.lock().unwrap_or_else(|e| e.into_inner()),
            Dirty::Ids(HashSet::new()),
        );
        let t = self.doc.transact();
        let mut cache = self.cache.borrow_mut();
        match dirty {
            Dirty::All => {
                *cache = self
                    .entries
                    .iter(&t)
                    .filter_map(|(k, v)| match v {
                        Out::YMap(m) => read_entry(k, &m, &t).map(|e| (k.to_string(), e)),
                        _ => None,
                    })
                    .collect();
            }
            Dirty::Ids(ids) => {
                for id in ids {
                    match self.entries.get(&t, &id) {
                        Some(Out::YMap(m)) => match read_entry(&id, &m, &t) {
                            Some(e) => cache.insert(id, e),
                            None => cache.remove(&id),
                        },
                        _ => cache.remove(&id),
                    };
                }
            }
        }
    }

    pub fn get(&self, id: &str) -> Option<Entry> {
        self.refresh();
        self.cache.borrow().get(id).cloned()
    }

    /// Toutes les entrées, corbeille comprise, triées par identifiant.
    pub fn all(&self) -> Vec<Entry> {
        self.refresh();
        let mut v: Vec<Entry> = self.cache.borrow().values().cloned().collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    }

    /// Les mêmes entrées, relues dans le document sans le cache (tests : le cache ne ment pas).
    #[doc(hidden)]
    pub fn all_uncached(&self) -> Vec<Entry> {
        let t = self.doc.transact();
        let mut v: Vec<Entry> = self
            .entries
            .iter(&t)
            .filter_map(|(k, v)| match v {
                Out::YMap(m) => read_entry(k, &m, &t),
                _ => None,
            })
            .collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    }

    pub fn is_dismissed(&self, key: &str) -> bool {
        let t = self.doc.transact();
        match self.meta.get(&t, "dismissed") {
            Some(Out::YMap(d)) => d.get(&t, key).is_some(),
            _ => false,
        }
    }

    pub fn dismissed(&self) -> Vec<String> {
        let t = self.doc.transact();
        match self.meta.get(&t, "dismissed") {
            Some(Out::YMap(d)) => {
                let mut v: Vec<String> = d.keys(&t).map(str::to_string).collect();
                v.sort();
                v
            }
            _ => Vec::new(),
        }
    }
}
