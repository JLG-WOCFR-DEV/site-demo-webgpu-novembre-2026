//! Plan de tests de docs/carnet/sync.md § 11 : de vrais carnets (carnet-core), un stockage simulé.

use std::cell::Cell;
use std::collections::BTreeMap;
use std::rc::Rc;

use carnet_core::{Anchor, Env, NewEntry, Notebook, Page, Place};
use carnet_sync::codec::Docs;
use carnet_sync::device::{snapshot_and_truncate, sync, Device, Paths, Replica};
use carnet_sync::envelope::{self, ctx_stream, Kind};
use carnet_sync::keys::{
    media_id, notebook_code, notebook_from_code, phrase_bits, recovery_display, recovery_parse, Id,
    Keybox, Rng, RootKey, KDF_TEST,
};
use carnet_sync::store::{MemStore, Put, Store};
use carnet_sync::Error;
use proptest::prelude::*;

/* ───── Outils ───── */

struct XorShift(u128);
impl Rng for XorShift {
    fn fill(&mut self, out: &mut [u8]) {
        for b in out {
            let mut x = self.0;
            x ^= x << 35;
            x ^= x >> 59;
            x ^= x << 23;
            self.0 = x;
            *b = (x >> 64) as u8;
        }
    }
}
fn rng(seed: u64) -> XorShift {
    XorShift(
        0x9E37_79B9_7F4A_7C15_F39C_C060_5CED_C834u128
            ^ ((seed as u128 + 1) * 0x1234_5678_9ABC_DEF1),
    )
}

struct TestEnv {
    clock: Rc<Cell<f64>>,
    state: u128,
}
impl Env for TestEnv {
    fn now_ms(&mut self) -> f64 {
        let t = self.clock.get() + 1.0;
        self.clock.set(t);
        t
    }
    fn random(&mut self) -> u128 {
        let mut x = self.state;
        x ^= x << 35;
        x ^= x >> 59;
        x ^= x << 23;
        self.state = x;
        x
    }
}

/// Un appareil : son carnet, ses pages, et son état de synchro.
struct Phone {
    nb: Notebook,
    pages: BTreeMap<String, Page>,
    client: u64,
    clock: Rc<Cell<f64>>,
}
impl Phone {
    fn new(client: u64) -> Phone {
        let clock = Rc::new(Cell::new(1_794_000_000_000.0));
        let env = |c: u64| {
            Box::new(TestEnv {
                clock: clock.clone(),
                state: 0xABCDu128 ^ (c as u128 * 0x1234_5678_9ABC_DEF1),
            })
        };
        Phone {
            nb: Notebook::new(client, env(client)),
            pages: BTreeMap::new(),
            client,
            clock: clock.clone(),
        }
    }
    fn page(&mut self, key: &str) -> &mut Page {
        let (c, clock) = (self.client, self.clock.clone());
        self.pages.entry(key.to_string()).or_insert_with(|| {
            Page::new(
                c,
                Box::new(TestEnv {
                    clock,
                    state: 0x5151u128 ^ (c as u128 * 77),
                }),
            )
        })
    }
    /// Une commande locale, mise en file d'envoi (comme Store.commit le fera).
    fn add(&mut self, dev: &mut Device, text: &str, day: &str) {
        self.nb
            .add(
                Place::day(day.parse().unwrap()),
                NewEntry {
                    kind: None,
                    text: text.into(),
                    time: None,
                    priority: false,
                    idea: false,
                },
            )
            .unwrap();
        for u in self.nb.take_updates() {
            dev.queue("notebook", u);
        }
    }
    fn sticker(&mut self, dev: &mut Device, key: &str, name: &str) {
        let p = self.page(key);
        p.add_sticker(
            name,
            "automne",
            Anchor {
                x: 10.0,
                y: 20.0,
                w: 320.0,
            },
            0.0,
            1.0,
        )
        .unwrap();
        for u in p.take_updates() {
            dev.queue(key, u);
        }
    }
    fn texts(&self) -> Vec<String> {
        let mut t: Vec<String> = self.nb.all().into_iter().map(|e| e.text).collect();
        t.sort();
        t
    }
    fn stickers(&self) -> BTreeMap<String, usize> {
        self.pages
            .iter()
            .map(|(k, p)| (k.clone(), p.items().len()))
            .filter(|(_, n)| *n > 0)
            .collect()
    }
}
impl Replica for Phone {
    fn apply(&mut self, doc: &str, update: &[u8]) -> Result<(), Error> {
        let r = if doc == "notebook" {
            self.nb.apply_update(update)
        } else {
            self.page(doc).apply_update(update)
        };
        r.map_err(|e| Error::Core(e.to_string()))
    }
    fn states(&self) -> Docs {
        let mut v = vec![("notebook".to_string(), self.nb.encode_state())];
        v.extend(
            self.pages
                .iter()
                .map(|(k, p)| (k.clone(), p.encode_state())),
        );
        v
    }
    fn pending_count(&self) -> usize {
        self.nb.pending_count()
            + self
                .pages
                .values()
                .map(|p| p.pending_count())
                .sum::<usize>()
    }
}

fn carnet(seed: u64) -> (Id, Vec<RootKey>) {
    let mut r = rng(seed);
    let mut nb = [0u8; 16];
    r.fill(&mut nb);
    let (_, root, _, _) = Keybox::create(nb, "cheval agrafe lune", KDF_TEST, &mut r).unwrap();
    (nb, vec![root])
}

/* ───── Clés ───── */

#[test]
fn coffre_phrase_recuperation_rotation() {
    let mut r = rng(1);
    let nb = [7u8; 16];
    let (mut kb, root, recovery, token) =
        Keybox::create(nb, "  cheval   agrafe lune ", KDF_TEST, &mut r).unwrap();
    // Aller-retour du format ; la partie publique suffit à recalculer le jeton du coffre.
    let kb2 = Keybox::decode(&kb.encode()).unwrap();
    assert_eq!(kb2, kb);
    assert_eq!(
        Keybox::decode_params(&kb.encode_params()).unwrap(),
        (kb.kdf, kb.salt)
    );
    assert_eq!(kb2.phrase_token("cheval agrafe lune").unwrap(), token);
    assert_eq!(
        kb2.open_with_phrase("cheval agrafe lune").unwrap().keys[0].bytes(),
        root.bytes()
    );
    assert_eq!(
        kb2.open_with_recovery(&recovery).unwrap().keys[0].bytes(),
        root.bytes()
    );
    assert_eq!(
        kb2.open_with_phrase("cheval agrafe lunes").err(),
        Some(Error::WrongSecret)
    );
    // Clé de récupération affichée, recopiée avec des fautes de lecture courantes ; code du carnet.
    let shown = recovery_display(&recovery);
    assert_eq!(shown.len(), 56 + 13);
    let typed = shown.to_lowercase().replace('0', "o").replace('1', "l");
    assert_eq!(recovery_parse(&typed).unwrap(), recovery);
    let mut bad = shown.clone().into_bytes();
    bad[0] = if bad[0] == b'A' { b'B' } else { b'A' };
    assert!(recovery_parse(std::str::from_utf8(&bad).unwrap()).is_err());
    assert_eq!(notebook_from_code(&notebook_code(&nb)).unwrap(), nb);
    // Changer de phrase : demande la clé de récupération ; la clé ne change pas ; nouveau sel, nouveau jeton.
    let keys = kb.open_with_phrase("cheval agrafe lune").unwrap().keys;
    assert!(kb
        .change_phrase(&keys, "nouvelle phrase", &[0u8; 32], &mut r)
        .is_err());
    let salt = kb.salt;
    let t2 = kb
        .change_phrase(&keys, "nouvelle phrase", &recovery, &mut r)
        .unwrap();
    assert_ne!(kb.salt, salt);
    assert_ne!(t2, token);
    assert_eq!(kb.gen, 2);
    assert!(kb.open_with_phrase("cheval agrafe lune").is_err());
    assert_eq!(
        kb.open_with_phrase("nouvelle phrase").unwrap().keys[0].bytes(),
        root.bytes()
    );
    // Rotation : nouvelle clé courante, l'ancienne reste dans le trousseau, ses protections sont effacées.
    let new_rec = [42u8; 32];
    let (all, _) = kb
        .rotate(&keys, "troisième phrase", &recovery, Some(&new_rec), &mut r)
        .unwrap();
    let back = Keybox::decode(&kb.encode()).unwrap();
    let reopened = back.open_with_phrase("troisième phrase").unwrap().keys;
    assert_eq!(reopened.len(), 2);
    assert_eq!(reopened[0].version, 2);
    assert_eq!(reopened[0].bytes(), all[0].bytes());
    assert_eq!(reopened[1].bytes(), root.bytes());
    assert_ne!(reopened[0].relay_verifier(), reopened[1].relay_verifier());
    assert!(
        back.open_with_recovery(&recovery).is_err(),
        "l'ancienne clé de récupération ne sert plus"
    );
    assert_eq!(back.open_with_recovery(&new_rec).unwrap().keys.len(), 2);
    assert!(
        back.versions[0].wrapped_pass.is_empty() && back.versions[0].wrapped_recovery.is_empty()
    );
    // Les identifiants de médias ne changent pas avec la rotation.
    assert_eq!(
        media_id(&reopened, &[5u8; 32]),
        media_id(&reopened[1..], &[5u8; 32])
    );
}

#[test]
fn force_des_phrases() {
    assert!(phrase_bits("cheval agrafe lune") < 60.0);
    assert!(phrase_bits("cheval agrafe lune pompe brioche tulipe") > 60.0);
    assert!(phrase_bits("motdepasse") < 60.0);
}

#[test]
fn identifiants_opaques_des_medias() {
    let (_, keys) = carnet(2);
    let (_, keys2) = carnet(3);
    let sha = [9u8; 32];
    assert_eq!(media_id(&keys, &sha), media_id(&keys, &sha));
    assert_ne!(
        media_id(&keys, &sha),
        media_id(&keys2, &sha),
        "un autre carnet, un autre identifiant"
    );
}

/* ───── Enveloppe ───── */

#[test]
fn falsification_et_deplacement() {
    let (nb, keys) = carnet(4);
    let mut r = rng(4);
    let st = [1u8; 16];
    let env = envelope::seal(
        &keys[0],
        Kind::Entry,
        &nb,
        &ctx_stream(&st, 5),
        b"bonjour",
        &mut r,
    );
    assert_eq!(
        envelope::open(&keys, Kind::Entry, &nb, &ctx_stream(&st, 5), &env).unwrap(),
        b"bonjour"
    );
    // Chaque octet changé est refusé.
    for i in 0..env.len() {
        let mut e = env.clone();
        e[i] ^= 0x40;
        assert!(
            envelope::open(&keys, Kind::Entry, &nb, &ctx_stream(&st, 5), &e).is_err(),
            "octet {i}"
        );
    }
    // Déplacée : autre numéro, autre flux, autre carnet, autre nature.
    assert_eq!(
        envelope::open(&keys, Kind::Entry, &nb, &ctx_stream(&st, 6), &env),
        Err(Error::Decrypt)
    );
    assert_eq!(
        envelope::open(&keys, Kind::Entry, &nb, &ctx_stream(&[2u8; 16], 5), &env),
        Err(Error::Decrypt)
    );
    assert_eq!(
        envelope::open(&keys, Kind::Entry, &[0u8; 16], &ctx_stream(&st, 5), &env),
        Err(Error::Decrypt)
    );
    assert_eq!(
        envelope::open(&keys, Kind::Snapshot, &nb, &ctx_stream(&st, 5), &env),
        Err(Error::Decrypt)
    );
    // Paliers : une lettre et un paragraphe pèsent pareil.
    let small = envelope::seal(
        &keys[0],
        Kind::Entry,
        &nb,
        &ctx_stream(&st, 1),
        b"x",
        &mut r,
    );
    let mid = envelope::seal(
        &keys[0],
        Kind::Entry,
        &nb,
        &ctx_stream(&st, 1),
        &[b'y'; 200],
        &mut r,
    );
    assert_eq!(small.len(), mid.len());
}

/* ───── Protocole ───── */

#[test]
fn deux_appareils_puis_un_nouveau() {
    let (nb, keys) = carnet(5);
    let mut store = MemStore::new();
    let mut r = rng(5);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "Rappeler le plombier", "2026-11-08");
    a.sticker(&mut da, "day:2026-11-08", "feuille");
    b.add(&mut db, "Acheter du café", "2026-11-09");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert_eq!(a.texts(), b.texts());
    assert_eq!(a.texts().len(), 2);
    assert_eq!(a.stickers(), b.stickers());
    // Le stockage ne voit ni texte ni nom de page.
    for v in store.files.values() {
        let s = String::from_utf8_lossy(v);
        assert!(!s.contains("plombier") && !s.contains("2026-11") && !s.contains("feuille"));
    }
    for k in store.files.keys() {
        assert!(!k.contains("2026"), "{k}");
    }
    // Un troisième appareil arrive : il lit tout.
    let (mut c, mut dc) = (Phone::new(33), Device::new(nb, keys.clone(), &mut r));
    let rep = sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert_eq!(rep.received, 2);
    assert_eq!(c.texts(), a.texts());
    assert_eq!(c.stickers(), a.stickers());
}

#[test]
fn accuse_de_reception_perdu_puis_reprise() {
    let (nb, keys) = carnet(6);
    let mut store = MemStore::new();
    let mut r = rng(6);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "Une", "2026-11-08");
    // L'hôte garde l'état avec l'entrée en vol, envoie, puis s'éteint avant l'accusé de réception.
    let (path, env) = da.outgoing(&mut r).unwrap().unwrap();
    let saved = da.encode();
    assert_eq!(store.put_new(&path, &env), Put::Created);
    // Au redémarrage, l'entrée en vol repart à l'identique : la place est prise, mais par nous.
    let mut da = Device::decode(&saved, keys.clone()).unwrap();
    let rep = sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert!(!rep.forked);
    assert_eq!(da.next_seq, 2);
    assert_eq!(store.list(&Paths(&nb).log_stream(&da.stream)).len(), 1);
}

#[test]
fn fourche_profil_clone() {
    let (nb, keys) = carnet(7);
    let mut store = MemStore::new();
    let mut r = rng(7);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "Avant le clone", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    // Profil copié : même flux, même numéro suivant, même carnet.
    let mut db = Device::decode(&da.encode(), keys.clone()).unwrap();
    let mut b = Phone::new(22);
    b.nb.apply_update(&a.nb.encode_state()).unwrap();
    a.add(&mut da, "Écrit par A", "2026-11-08");
    b.add(&mut db, "Écrit par B", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    let rep = sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert!(rep.forked, "B découvre la fourche");
    assert_ne!(da.stream, db.stream);
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert_eq!(a.texts(), b.texts());
    assert_eq!(a.texts().len(), 3);
}

#[test]
fn entree_falsifiee_par_le_stockage() {
    let (nb, keys) = carnet(8);
    let mut store = MemStore::new();
    let mut r = rng(8);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    for t in ["un", "deux", "trois"] {
        a.add(&mut da, t, "2026-11-08");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    }
    let p2 = Paths(&nb).log(&da.stream, 2);
    let mut e = store.get(&p2).unwrap();
    let last = e.len() - 1;
    e[last] ^= 1;
    store.put(&p2, &e);
    let rep = sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert_eq!(rep.received, 1, "le flux s'arrête à l'entrée falsifiée");
    assert_eq!(rep.rejected.len(), 1);
    assert_eq!(b.texts(), vec!["un"]);
    // Une entrée recopiée à la place d'une autre ne passe pas non plus.
    let p1 = Paths(&nb).log(&da.stream, 1);
    store.put(&p2, &store.get(&p1).unwrap());
    let rep = sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert_eq!(rep.rejected.len(), 1);
    // Rejouer une entrée déjà appliquée : sans effet.
    assert!(db
        .receive(&da.stream, 1, &store.get(&p1).unwrap())
        .unwrap()
        .is_none());
}

#[test]
fn trou_signale() {
    let (nb, keys) = carnet(9);
    let mut store = MemStore::new();
    let mut r = rng(9);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    for t in ["un", "deux", "trois"] {
        a.add(&mut da, t, "2026-11-08");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    }
    store.delete(&Paths(&nb).log(&da.stream, 2));
    let rep = sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert_eq!(rep.received, 1);
    assert_eq!(rep.gaps, vec![(da.stream, 2)]);
}

#[test]
fn instantane_troncature_et_retour_d_un_absent() {
    let (nb, keys) = carnet(10);
    let mut store = MemStore::new();
    let mut r = rng(10);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "première", "2026-11-01");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    // B part hors ligne et écrit ; A écrit beaucoup, fait deux instantanés, tronque.
    b.add(&mut db, "écrit hors ligne par B", "2026-11-02");
    for i in 0..10 {
        a.add(&mut da, &format!("A {i}"), "2026-11-03");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
        if i == 4 || i == 9 {
            snapshot_and_truncate(&mut da, &mut store, &a, 0, 0, &mut r).unwrap();
        }
    }
    let left = store.list(&Paths(&nb).log_stream(&da.stream));
    assert!(left.len() < 11, "le journal a été tronqué : {left:?}");
    // Un nouvel appareil part d'un instantané.
    let (mut c, mut dc) = (Phone::new(33), Device::new(nb, keys.clone(), &mut r));
    let rep = sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert!(rep.snapshots_applied > 0);
    assert_eq!(c.texts(), a.texts());
    // B revient : son curseur est en deçà de la troncature ; il repart de l'instantané sans rien perdre.
    let rep = sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert!(rep.snapshots_applied > 0);
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert_eq!(a.texts(), b.texts());
    assert_eq!(a.texts(), c.texts());
    assert!(a.texts().contains(&"écrit hors ligne par B".to_string()));
    assert_eq!(a.texts().len(), 12);
}

#[test]
fn rotation_borne_et_appareil_retire() {
    let mut r = rng(11);
    let nb = [3u8; 16];
    let (mut kb, root, recovery, _) = Keybox::create(nb, "phrase", KDF_TEST, &mut r).unwrap();
    let mut store = MemStore::new();
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, vec![root.clone()], &mut r));
    let (mut x, mut dx) = (Phone::new(66), Device::new(nb, vec![root.clone()], &mut r));
    a.add(&mut da, "sous la clé 1", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    x.add(&mut dx, "avant le retrait", "2026-11-08");
    sync(&mut dx, &mut store, &mut x, &mut r).unwrap();
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    // Rotation (§ 3.4) : nouvelle clé, puis instantané de rotation qui fige la borne de la version 1.
    let (keys, _) = kb
        .rotate(&[root], "nouvelle phrase", &recovery, None, &mut r)
        .unwrap();
    da.keys = keys.clone();
    let bound = Some((1, da.covers()));
    let [(bp, be), (mp, me)] = da.snapshot(&a.states(), 1, 0, bound, &mut r);
    store.put_new(&bp, &be);
    store.put_new(&mp, &me);
    a.add(&mut da, "sous la clé 2", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    // L'appareil retiré n'a que l'ancienne clé : il écrit encore sous la version 1.
    x.add(&mut dx, "écrit après le retrait", "2026-11-08");
    sync(&mut dx, &mut store, &mut x, &mut r).unwrap();
    // Un nouvel appareil (nouvelle phrase) lit l'historique sous la borne, refuse ce qui la dépasse.
    let opened = Keybox::decode(&kb.encode())
        .unwrap()
        .open_with_phrase("nouvelle phrase")
        .unwrap()
        .keys;
    let (mut c, mut dc) = (Phone::new(33), Device::new(nb, opened, &mut r));
    let rep = sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert_eq!(
        c.texts(),
        vec!["avant le retrait", "sous la clé 1", "sous la clé 2"]
    );
    assert_eq!(rep.rejected.len(), 1);
    assert_eq!(rep.rejected[0].2, Error::Stale);
    // A non plus n'applique pas l'écriture de l'appareil retiré.
    let rep = sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert_eq!(rep.rejected[0].2, Error::Stale);
    assert_eq!(a.texts(), c.texts());
    // Un appareil qui a vu la version 2 refuse d'écrire sous la version 1.
    let mut stale = Device::decode(&dc.encode(), vec![dc.keys[1].clone()]).unwrap();
    stale.queue("notebook", vec![0, 0]);
    assert!(stale.outgoing(&mut r).is_err());
}

#[test]
fn pas_d_echo() {
    let (nb, keys) = carnet(13);
    let mut store = MemStore::new();
    let mut r = rng(13);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "une", "2026-11-08");
    for _ in 0..4 {
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
        sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    }
    // Ce qui est reçu ne repart pas : une seule entrée en tout.
    assert_eq!(
        store.files.keys().filter(|k| k.contains("/log/")).count(),
        1
    );
    assert_eq!(b.texts(), vec!["une"]);
}

#[test]
fn base_restauree_apres_troncature() {
    let (nb, keys) = carnet(14);
    let mut store = MemStore::new();
    let mut r = rng(14);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "a0", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    // Copie de l'état de A (base IndexedDB restaurée plus tard depuis cette copie).
    let old_state = da.encode();
    let old_nb = a.nb.encode_state();
    for i in 1..8 {
        a.add(&mut da, &format!("a{i}"), "2026-11-08");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
        snapshot_and_truncate(&mut da, &mut store, &a, 0, 0, &mut r).unwrap();
    }
    // Restauration : même flux, numéro ancien ; les places visées ont été libérées par la troncature.
    let mut da2 = Device::decode(&old_state, keys.clone()).unwrap();
    let mut a2 = Phone::new(77);
    a2.nb.apply_update(&old_nb).unwrap();
    a2.add(&mut da2, "écrit après restauration", "2026-11-08");
    let rep = sync(&mut da2, &mut store, &mut a2, &mut r).unwrap();
    assert!(
        rep.forked,
        "le numéro plus grand sous notre flux révèle la restauration"
    );
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    assert!(b.texts().contains(&"écrit après restauration".to_string()));
    assert_eq!(b.texts().len(), 9);
}

#[test]
fn dependance_en_attente_curseur_retenu() {
    let (nb, keys) = carnet(15);
    let mut store = MemStore::new();
    let mut r = rng(15);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    // Ordre de lecture : B avant A (flux triés).
    da.stream = [0xee; 16];
    db.stream = [0x11; 16];
    a.add(&mut da, "écrit par A", "2026-11-08");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    // B modifie l'entrée de A : sa mise à jour dépend de celle de A.
    let id = b.nb.all()[0].id.clone();
    b.nb.set_text(&id, "écrit par A, corrigé par B").unwrap();
    for u in b.nb.take_updates() {
        db.queue("notebook", u);
    }
    sync(&mut db, &mut store, &mut b, &mut r).unwrap();
    // C lit B (qui attend A) puis A : B est mis de côté puis compté quand A arrive.
    let (mut c, mut dc) = (Phone::new(33), Device::new(nb, keys.clone(), &mut r));
    let rep = sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert_eq!(rep.received, 2);
    assert_eq!(c.texts(), vec!["écrit par A, corrigé par B"]);
    assert_eq!(dc.cursors.get(&db.stream), Some(&1));
    // Si A manque (retenu), B reste en attente et son curseur ne bouge pas.
    let (mut d, mut dd) = (Phone::new(44), Device::new(nb, keys.clone(), &mut r));
    let mut partial = store.clone();
    partial.delete(&Paths(&nb).log(&da.stream, 1));
    let rep = sync(&mut dd, &mut partial, &mut d, &mut r).unwrap();
    assert_eq!(rep.parked, 1);
    assert_eq!(dd.cursors.get(&db.stream), None);
    assert_eq!(
        rep.withheld,
        vec![(da.stream, 1)],
        "B avait vu A:1, que le stockage ne liste pas"
    );
    assert!(snapshot_and_truncate(&mut dd, &mut partial, &d, 0, 0, &mut r).unwrap() == 0);
    assert!(
        partial.list(&Paths(&nb).metas()).is_empty(),
        "pas d'instantané avec une mise à jour en attente"
    );
}

#[test]
fn instantanes_concurrents_incomparables() {
    let (nb, keys) = carnet(16);
    let mut store = MemStore::new();
    let mut r = rng(16);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let (mut b, mut db) = (Phone::new(22), Device::new(nb, keys.clone(), &mut r));
    for i in 0..4 {
        a.add(&mut da, &format!("a{i}"), "2026-11-08");
        b.add(&mut db, &format!("b{i}"), "2026-11-08");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
        sync(&mut db, &mut store, &mut b, &mut r).unwrap();
        // Chacun fait son instantané à son rythme : couvertures incomparables.
        snapshot_and_truncate(&mut da, &mut store, &a, 0, 0, &mut r).unwrap();
        snapshot_and_truncate(&mut db, &mut store, &b, 0, 0, &mut r).unwrap();
    }
    let (mut c, mut dc) = (Phone::new(33), Device::new(nb, keys.clone(), &mut r));
    let rep = sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
    assert!(rep.gaps.is_empty(), "{:?}", rep.gaps);
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert_eq!(c.texts(), a.texts());
    assert_eq!(c.texts().len(), 8);
}

#[test]
fn age_minimal_avant_troncature() {
    let (nb, keys) = carnet(17);
    let mut store = MemStore::new();
    let mut r = rng(17);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    let week = 7 * 86_400_000;
    for i in 0..5u64 {
        a.add(&mut da, &format!("a{i}"), "2026-11-08");
        sync(&mut da, &mut store, &mut a, &mut r).unwrap();
        assert_eq!(
            snapshot_and_truncate(&mut da, &mut store, &a, 1_000 + i, week, &mut r).unwrap(),
            0
        );
    }
    a.add(&mut da, "plus tard", "2026-11-20");
    sync(&mut da, &mut store, &mut a, &mut r).unwrap();
    assert!(
        snapshot_and_truncate(&mut da, &mut store, &a, 1_000 + week + 10, week, &mut r).unwrap()
            > 0
    );
}

#[test]
fn etat_garde_aller_retour() {
    let (nb, keys) = carnet(12);
    let mut r = rng(12);
    let (mut a, mut da) = (Phone::new(11), Device::new(nb, keys.clone(), &mut r));
    a.add(&mut da, "x", "2026-11-08");
    a.sticker(&mut da, "week:2026-11-02", "lune");
    da.outgoing(&mut r).unwrap();
    a.add(&mut da, "y", "2026-11-08");
    let e = da.encode();
    let back = Device::decode(&e, keys).unwrap();
    assert_eq!(back.encode(), e);
    assert_eq!(back.inflight, da.inflight);
}

/* ───── Convergence (proptest) ───── */

#[derive(Debug, Clone)]
enum Op {
    Add(usize),
    Sticker(usize),
    Sync(usize),
    Snapshot(usize),
    /// L'appareil s'éteint juste après avoir écrit (état gardé avant l'envoi, accusé perdu).
    Crash(usize),
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        4 => (0..3usize).prop_map(Op::Add),
        2 => (0..3usize).prop_map(Op::Sticker),
        4 => (0..3usize).prop_map(Op::Sync),
        1 => (0..3usize).prop_map(Op::Snapshot),
        1 => (0..3usize).prop_map(Op::Crash),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig { cases: std::env::var("PROPTEST_CASES").ok().and_then(|v| v.parse().ok()).unwrap_or(120), ..ProptestConfig::default() })]
    #[test]
    fn convergence_chiffree(ops in prop::collection::vec(op(), 1..40), seed in 0u64..1000) {
        let (nb, keys) = carnet(seed);
        let mut store = MemStore::new();
        let mut r = rng(seed + 1);
        let mut phones: Vec<(Phone, Device)> = (0..3).map(|i| (Phone::new(100 + i as u64), Device::new(nb, keys.clone(), &mut r))).collect();
        let mut n = 0;
        for o in ops {
            n += 1;
            match o {
                Op::Add(i) => { let (p, d) = &mut phones[i]; p.add(d, &format!("ligne {n}"), "2026-11-08"); }
                Op::Sticker(i) => { let (p, d) = &mut phones[i]; p.sticker(d, &format!("day:2026-11-0{}", 1 + n % 3), "feuille"); }
                Op::Sync(i) => { let (p, d) = &mut phones[i]; let rep = sync(d, &mut store, p, &mut r).unwrap(); prop_assert!(rep.rejected.is_empty()); }
                Op::Snapshot(i) => {
                    let (p, d) = &mut phones[i];
                    sync(d, &mut store, p, &mut r).unwrap();
                    snapshot_and_truncate(d, &mut store, p, 0, 0, &mut r).unwrap();
                }
                Op::Crash(i) => {
                    let (_, d) = &mut phones[i];
                    if let Some((path, env)) = d.outgoing(&mut r).unwrap() {
                        let saved = d.encode();
                        store.put_new(&path, &env);
                        *d = Device::decode(&saved, keys.clone()).unwrap();
                    }
                }
            }
        }
        // Échange complet : deux tours chacun.
        for _ in 0..2 {
            for (p, d) in phones.iter_mut() {
                let rep = sync(d, &mut store, p, &mut r).unwrap();
                prop_assert!(rep.rejected.is_empty());
                prop_assert!(rep.gaps.is_empty(), "trous : {:?}", rep.gaps);
            }
        }
        let t0 = phones[0].0.texts();
        let s0 = phones[0].0.stickers();
        for (p, d) in &phones {
            prop_assert_eq!(&p.texts(), &t0);
            prop_assert_eq!(&p.stickers(), &s0);
            prop_assert!(!d.has_outgoing());
        }
        // Un nouvel appareil retrouve exactement le même carnet.
        let (mut c, mut dc) = (Phone::new(999), Device::new(nb, keys.clone(), &mut r));
        sync(&mut dc, &mut store, &mut c, &mut r).unwrap();
        prop_assert_eq!(c.texts(), t0);
        prop_assert_eq!(c.stickers(), s0);
    }
}
