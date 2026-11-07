//! Convergence (roadmap § 4.3).
//!
//! On ne rejoue pas « les mêmes commandes dans un ordre aléatoire » : une commande dépend de l'état
//! observé. Chaque réplique exécute des commandes **valides sur son propre état** ; ce sont les mises à
//! jour produites qui circulent, livrées dans le désordre, en double, en retard. Après échange
//! complet, on vérifie séparément :
//! 1. la convergence des données ;
//! 2. les règles métier (une place par entrée ; `trail` contient chaque départ effectué) ;
//! 3. la visibilité (aucune entrée vivante absente de sa vue) ;
//! 4. l'absence d'écrasement à la reprise (réappliquer le journal ne change rien).
mod common;

use std::collections::{BTreeSet, HashSet};

use carnet_core::{Day, Kind, NewEntry, Notebook, Place, Scope};
use common::{clock, notebook};
use proptest::prelude::*;

const REPLICAS: usize = 3;

#[derive(Debug, Clone)]
enum Op {
    Add {
        kind: u8,
        day: u8,
        word: u8,
    },
    Edit {
        pick: u16,
        at: u16,
        word: u8,
    },
    Cycle {
        pick: u16,
    },
    Migrate {
        pick: u16,
        day: u8,
    },
    Delete {
        pick: u16,
    },
    Restore {
        pick: u16,
    },
    /// Livre à cette réplique `n` mises à jour en attente, choisies dans le désordre.
    Deliver {
        n: u8,
        seed: u16,
    },
    /// Simule une interruption : la réplique perd ce qui n'a pas été « écrit » puis relit son journal.
    Restart,
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        3 => (0u8..3, 0u8..14, any::<u8>()).prop_map(|(kind, day, word)| Op::Add { kind, day, word }),
        3 => (any::<u16>(), any::<u16>(), any::<u8>()).prop_map(|(pick, at, word)| Op::Edit { pick, at, word }),
        2 => any::<u16>().prop_map(|pick| Op::Cycle { pick }),
        3 => (any::<u16>(), 0u8..14).prop_map(|(pick, day)| Op::Migrate { pick, day }),
        1 => any::<u16>().prop_map(|pick| Op::Delete { pick }),
        1 => any::<u16>().prop_map(|pick| Op::Restore { pick }),
        3 => (1u8..6, any::<u16>()).prop_map(|(n, seed)| Op::Deliver { n, seed }),
        1 => Just(Op::Restart),
    ]
}

const WORDS: [&str; 6] = [
    "plombier",
    "café",
    "Fête 🌿",
    "e\u{301}té",
    "à 8 h",
    "œuvre",
];

fn base() -> Day {
    "2026-11-02".parse().unwrap()
}

struct Replica {
    nb: Notebook,
    /// Journal « écrit » de cette réplique : ses propres mises à jour et celles reçues.
    log: Vec<Vec<u8>>,
    /// Mises à jour du réseau déjà livrées (indices).
    seen: HashSet<usize>,
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 400, ..ProptestConfig::default() })]

    #[test]
    fn replicas_converge(script in prop::collection::vec((0usize..REPLICAS, op()), 1..70)) {
        let c = clock(1_700_000_000_000.0);
        let mut reps: Vec<Replica> = (0..REPLICAS).map(|i| Replica { nb: notebook(i as u64 + 1, &c), log: vec![], seen: HashSet::new() }).collect();
        let mut net: Vec<Vec<u8>> = Vec::new();
        // Départs effectués : (entrée, place quittée).
        let mut departures: Vec<(String, Place)> = Vec::new();
        let mut restarts = 0u64;

        for (r, o) in &script {
            let live: Vec<_> = reps[*r].nb.all().into_iter().filter(|e| e.deleted_at.is_none()).collect();
            let dead: Vec<_> = reps[*r].nb.all().into_iter().filter(|e| e.deleted_at.is_some()).collect();
            let pick = |p: &u16, v: &Vec<carnet_core::Entry>| (!v.is_empty()).then(|| v[*p as usize % v.len()].clone());
            let nb = &mut reps[*r].nb;
            match o {
                Op::Add { kind, day, word } => {
                    let kind = [Kind::Task, Kind::Event, Kind::Note][*kind as usize];
                    let place = if *day == 13 { Place { scope: Scope::Week(base()), day: None } } else { Place::day(base().add_days(*day as i64)) };
                    nb.add(place, NewEntry { kind: Some(kind), text: WORDS[*word as usize % WORDS.len()].into(), ..Default::default() }).unwrap();
                }
                Op::Edit { pick: p, at, word } => {
                    if let Some(e) = pick(p, &live) {
                        // Insertion à une frontière de caractère, comme le ferait le navigateur.
                        let chars: Vec<char> = e.text.chars().collect();
                        let k = *at as usize % (chars.len() + 1);
                        let mut s: String = chars[..k].iter().collect();
                        s.push_str(WORDS[*word as usize % WORDS.len()]);
                        s.extend(&chars[k..]);
                        nb.set_text(&e.id, &s).unwrap();
                    }
                }
                Op::Cycle { pick: p } => {
                    if let Some(e) = pick(p, &live).filter(|e| e.kind == Kind::Task) {
                        nb.cycle_state(&e.id).unwrap();
                    }
                }
                Op::Migrate { pick: p, day } => {
                    if let Some(e) = pick(p, &live) {
                        let to = Place::day(base().add_days(*day as i64));
                        if e.place != to {
                            departures.push((e.id.clone(), e.place.clone()));
                        }
                        nb.migrate(&e.id, to).unwrap();
                    }
                }
                Op::Delete { pick: p } => {
                    if let Some(e) = pick(p, &live) {
                        nb.delete(&e.id).unwrap();
                    }
                }
                Op::Restore { pick: p } => {
                    if let Some(e) = pick(p, &dead) {
                        nb.restore(&e.id).unwrap();
                    }
                }
                Op::Deliver { n, seed } => {
                    let pending: Vec<usize> = (0..net.len()).filter(|i| !reps[*r].seen.contains(i)).collect();
                    let mut s = *seed as usize;
                    for _ in 0..*n {
                        if pending.is_empty() { break; }
                        s = s.wrapping_mul(1103515245).wrapping_add(12345);
                        let i = pending[s % pending.len()];
                        // En double parfois : livrer ne marque pas toujours comme vu.
                        if s % 3 != 0 { reps[*r].seen.insert(i); }
                        let u = net[i].clone();
                        reps[*r].nb.apply_update(&u).unwrap();
                        reps[*r].log.push(u);
                    }
                }
                Op::Restart => {
                    // La page est éliminée : on reconstruit la réplique à partir de son journal écrit.
                    restarts += 1;
                    let mut fresh = notebook(*r as u64 + 1 + 1000 * restarts, &c);
                    for u in &reps[*r].log { fresh.apply_update(u).unwrap(); }
                    reps[*r].nb = fresh;
                }
            }
            // Ce que la commande a produit est écrit au journal local puis publié.
            for u in reps[*r].nb.take_updates() {
                reps[*r].log.push(u.clone());
                net.push(u);
            }
        }

        // Échange final complet, dans l'ordre inverse.
        for rep in reps.iter_mut() {
            for u in net.iter().rev() {
                rep.nb.apply_update(u).unwrap();
            }
        }

        // 1. Convergence des données.
        for (i, rep) in reps.iter().enumerate() {
            prop_assert!(!rep.nb.has_pending(), "réplique {} : mises à jour en attente après l'échange complet", i);
        }
        let reference = reps[0].nb.all();
        for rep in &reps[1..] {
            prop_assert_eq!(&rep.nb.all(), &reference);
            prop_assert_eq!(rep.nb.dismissed(), reps[0].nb.dismissed());
        }

        // 2. Règles métier.
        for e in &reference {
            if e.place.scope == Scope::Day {
                prop_assert!(e.place.day.is_some(), "entrée du jour sans date : {}", e.id);
            }
        }
        for (id, from) in &departures {
            let e = reference.iter().find(|e| &e.id == id).expect("une entrée n'est jamais perdue (pas de purge ici)");
            prop_assert!(e.trail.iter().any(|d| &d.from == from), "départ de {:?} absent du trail de {}", from, id);
        }

        // 3. Visibilité.
        let today = base().add_days(3);
        for e in reference.iter().filter(|e| e.deleted_at.is_none()) {
            let found = match &e.place.scope {
                Scope::Day => reps[0].nb.day_view(e.place.day.unwrap(), today, 5).lines.iter().any(|l| l.entry.id == e.id),
                Scope::Week(m) => reps[0].nb.week_view(*m, today).notes.iter().any(|l| l.entry.id == e.id),
                _ => true,
            };
            prop_assert!(found, "entrée vivante invisible : {}", e.id);
        }

        // 4. Reprise : réappliquer tout le réseau, puis reconstruire depuis un journal, ne change rien.
        let before: BTreeSet<String> = reference.iter().map(|e| format!("{e:?}")).collect();
        for u in &net { reps[1].nb.apply_update(u).unwrap(); }
        let mut rebuilt = notebook(99, &c);
        for u in &net { rebuilt.apply_update(u).unwrap(); }
        prop_assert_eq!(reps[1].nb.all(), reference.clone());
        prop_assert_eq!(rebuilt.all().iter().map(|e| format!("{e:?}")).collect::<BTreeSet<_>>(), before);
    }
}
