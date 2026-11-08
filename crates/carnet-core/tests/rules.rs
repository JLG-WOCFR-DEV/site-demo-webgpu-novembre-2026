//! Règles produit et modèle d'entrée (roadmap § 3.2).
mod common;

use carnet_core::{
    text_splice, Day, Kind, Month, NewEntry, Place, Scope, State, SuggestionKind, TRASH_MS,
};
use common::{clock, notebook, sync};

fn d(s: &str) -> Day {
    s.parse().unwrap()
}
fn task(text: &str) -> NewEntry {
    NewEntry {
        kind: Some(Kind::Task),
        text: text.into(),
        ..Default::default()
    }
}

#[test]
fn day_order_is_total_and_time_first() {
    let c = clock(1_000.0);
    let mut nb = notebook(1, &c);
    let day = d("2026-11-05");
    let a = nb
        .add(Place::day(day), task("sans heure, la première"))
        .unwrap();
    let b = nb
        .add(
            Place::day(day),
            NewEntry {
                kind: Some(Kind::Event),
                text: "réunion".into(),
                time: Some("9:30".into()),
                ..Default::default()
            },
        )
        .unwrap();
    let e = nb
        .add(
            Place::day(day),
            NewEntry {
                kind: Some(Kind::Event),
                text: "course".into(),
                time: Some("07:45".into()),
                ..Default::default()
            },
        )
        .unwrap();
    let z = nb
        .add(Place::day(day), task("sans heure, la seconde"))
        .unwrap();
    let v = nb.day_view(day, day, 5);
    let ids: Vec<&str> = v.lines.iter().map(|l| l.entry.id.as_str()).collect();
    assert_eq!(ids, [e.as_str(), b.as_str(), a.as_str(), z.as_str()]);
    assert_eq!(v.lines[1].entry.time.as_deref(), Some("09:30"));
    assert!(nb
        .add(
            Place::day(day),
            NewEntry {
                time: Some("25:00".into()),
                ..task("x")
            }
        )
        .is_err());
}

#[test]
fn text_edits_are_minimal_and_utf16() {
    assert_eq!(text_splice("café", "cafés"), Some((4, 0, "s".into())));
    // L'emoji compte deux unités UTF-16 : la modification après lui commence à 7.
    assert_eq!(
        text_splice("Fête 🌿 a", "Fête 🌿 b"),
        Some((8, 1, "b".into()))
    );
    // Accent combiné : e + U+0301 compte deux caractères.
    assert_eq!(
        text_splice("e\u{301}t\u{e9}", "e\u{301}t\u{e9}s"),
        Some((4, 0, "s".into()))
    );
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let id = nb
        .add(Place::day(d("2026-11-05")), task("Fête 🌿 a"))
        .unwrap();
    nb.splice_text(&id, 8, 1, "b").unwrap();
    assert_eq!(nb.get(&id).unwrap().text, "Fête 🌿 b");
    assert!(nb.splice_text(&id, 9, 1, "x").is_err());
}

#[test]
fn concurrent_text_edits_keep_both() {
    let c = clock(0.0);
    let (mut a, mut b) = (notebook(1, &c), notebook(2, &c));
    let id = a
        .add(Place::day(d("2026-11-05")), task("Rappeler le plombier"))
        .unwrap();
    sync(&mut a, &mut b);
    a.set_text(&id, "Rappeler le plombier demain").unwrap();
    b.set_text(&id, "Vite : Rappeler le plombier").unwrap();
    sync(&mut a, &mut b);
    assert_eq!(
        a.get(&id).unwrap().text,
        "Vite : Rappeler le plombier demain"
    );
    assert_eq!(a.all(), b.all());
}

#[test]
fn migration_keeps_identity_and_leaves_a_departed_line() {
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let (mon, tue) = (d("2026-11-02"), d("2026-11-03"));
    let id = nb.add(Place::day(mon), task("Réserver le train")).unwrap();
    nb.migrate(&id, Place::day(tue)).unwrap();
    let e = nb.get(&id).unwrap();
    assert_eq!(e.place, Place::day(tue));
    assert_eq!(e.trail.len(), 1);
    assert_eq!(e.trail[0].from, Place::day(mon));
    let monday = nb.day_view(mon, tue, 5);
    assert!(monday.lines.is_empty());
    assert_eq!(monday.departed.len(), 1);
    assert_eq!(monday.departed[0].departed_to, Some(Place::day(tue)));
    // Éditer la ligne déplacée modifie la même entrée.
    nb.set_text(&id, "Réserver le train de 8 h").unwrap();
    assert_eq!(
        nb.day_view(mon, tue, 5).departed[0].entry.text,
        "Réserver le train de 8 h"
    );
    // Migrer vers la même place ne laisse pas de trace.
    nb.migrate(&id, Place::day(tue)).unwrap();
    assert_eq!(nb.get(&id).unwrap().trail.len(), 1);
}

#[test]
fn concurrent_migrations_converge_on_one_day_and_keep_both_departures() {
    let c = clock(0.0);
    let (mut a, mut b) = (notebook(1, &c), notebook(2, &c));
    let mon = d("2026-11-02");
    let id = a.add(Place::day(mon), task("Payer la cantine")).unwrap();
    sync(&mut a, &mut b);
    a.migrate(&id, Place::day(d("2026-11-03"))).unwrap();
    b.migrate(&id, Place::day(d("2026-11-05"))).unwrap();
    sync(&mut a, &mut b);
    let (ea, eb) = (a.get(&id).unwrap(), b.get(&id).unwrap());
    assert_eq!(ea, eb);
    assert!(ea.place == Place::day(d("2026-11-03")) || ea.place == Place::day(d("2026-11-05")));
    assert_eq!(
        ea.trail
            .iter()
            .filter(|x| x.from == Place::day(mon))
            .count(),
        2
    );
}

#[test]
fn carry_and_plan_suggestions_migrate_on_keep() {
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let today = d("2026-11-05");
    let old = nb
        .add(Place::day(d("2026-11-04")), task("Rappeler le plombier"))
        .unwrap();
    let done = nb
        .add(Place::day(d("2026-11-04")), task("Acheter du café"))
        .unwrap();
    nb.set_state(&done, State::Done).unwrap();
    let too_old = nb
        .add(Place::day(d("2026-10-01")), task("Trop vieux"))
        .unwrap();
    let plan = nb
        .add(
            Place {
                scope: Scope::Month(today.month()),
                day: Some(today),
            },
            NewEntry {
                kind: Some(Kind::Event),
                text: "Dentiste".into(),
                time: Some("14:00".into()),
                ..Default::default()
            },
        )
        .unwrap();
    let v = nb.day_view(today, today, 5);
    let kinds: Vec<(SuggestionKind, &str)> = v
        .suggestions
        .iter()
        .map(|s| (s.kind, s.entry_id.as_str()))
        .collect();
    assert_eq!(
        kinds,
        [
            (SuggestionKind::Plan, plan.as_str()),
            (SuggestionKind::Carry, old.as_str())
        ]
    );
    assert!(!kinds.iter().any(|(_, i)| *i == too_old || *i == done));
    // Pas de report proposé sur un autre jour qu'aujourd'hui.
    assert!(nb
        .day_view(d("2026-11-06"), today, 5)
        .suggestions
        .is_empty());

    let kept = nb.keep(&format!("carry:{old}"), today).unwrap();
    assert_eq!(kept, old);
    assert_eq!(nb.get(&old).unwrap().place, Place::day(today));
    nb.keep(&format!("plan:{plan}"), today).unwrap();
    let after = nb.day_view(today, today, 5);
    assert!(after.suggestions.is_empty());
    assert_eq!(after.lines.len(), 2);
    assert_eq!(after.lines[0].entry.id, plan); // à heure : 14:00, avant les entrées sans heure
}

#[test]
fn year_ago_on_leap_days_and_dismiss() {
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let leap = nb
        .add(
            Place::day(d("2024-02-29")),
            NewEntry {
                kind: Some(Kind::Event),
                text: "Neige".into(),
                ..Default::default()
            },
        )
        .unwrap();
    let v = nb.day_view(d("2025-02-28"), d("2025-02-28"), 5);
    assert_eq!(v.suggestions.len(), 1);
    assert_eq!(v.suggestions[0].kind, SuggestionKind::YearAgo);
    assert_eq!(v.suggestions[0].entry_id, leap);
    let note = nb.keep(&v.suggestions[0].key, d("2025-02-28")).unwrap();
    assert_eq!(nb.get(&note).unwrap().text, "Il y a un an : Neige");
    assert!(nb
        .day_view(d("2025-02-28"), d("2025-02-28"), 5)
        .suggestions
        .is_empty());
    // Écartée sur un jour, toujours proposée sur un autre (la clé porte le jour).
    nb.add(
        Place::day(d("2024-03-01")),
        NewEntry {
            text: "Dégel".into(),
            ..Default::default()
        },
    )
    .unwrap();
    let k = nb.day_view(d("2025-03-01"), d("2025-03-01"), 5).suggestions[0]
        .key
        .clone();
    nb.dismiss(&k).unwrap();
    assert!(nb
        .day_view(d("2025-03-01"), d("2025-03-01"), 5)
        .suggestions
        .is_empty());
}

#[test]
fn trash_restore_and_purge_after_thirty_days() {
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let day = d("2026-11-05");
    let id = nb.add(Place::day(day), task("À jeter")).unwrap();
    nb.delete(&id).unwrap();
    assert!(nb.day_view(day, day, 5).lines.is_empty());
    assert!(nb.set_text(&id, "non").is_err());
    nb.restore(&id).unwrap();
    assert_eq!(nb.day_view(day, day, 5).lines.len(), 1);
    nb.delete(&id).unwrap();
    assert_eq!(nb.purge().unwrap(), 0);
    c.set(c.get() + TRASH_MS + 10.0);
    assert_eq!(nb.purge().unwrap(), 1);
    assert!(nb.get(&id).is_none());
}

#[test]
fn week_and_month_views() {
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let today = d("2026-11-05");
    let week_note = nb
        .add(
            Place {
                scope: Scope::Week(d("2026-11-02")),
                day: None,
            },
            NewEntry {
                text: "Garder le jeudi soir libre".into(),
                ..Default::default()
            },
        )
        .unwrap();
    assert!(
        nb.add(
            Place {
                scope: Scope::Week(d("2026-11-03")),
                day: None
            },
            NewEntry::default()
        )
        .is_err(),
        "une semaine commence un lundi"
    );
    let w = nb.week_view(today, today);
    assert_eq!(w.monday, d("2026-11-02"));
    assert_eq!(w.days.len(), 7);
    assert_eq!(w.notes[0].entry.id, week_note);

    let oct = Month { y: 2026, m: 10 };
    let left = nb
        .add(
            Place {
                scope: Scope::Month(oct),
                day: None,
            },
            task("Trier les photos de l'été"),
        )
        .unwrap();
    let nov = today.month();
    nb.add(
        Place {
            scope: Scope::Month(nov),
            day: Some(d("2026-11-14")),
        },
        NewEntry {
            kind: Some(Kind::Event),
            text: "Concert".into(),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(nb
        .add(
            Place {
                scope: Scope::Month(nov),
                day: Some(d("2026-12-01"))
            },
            NewEntry::default()
        )
        .is_err());
    let m = nb.month_view(nov, today);
    assert_eq!(m.calendar.len(), 30);
    assert_eq!(m.calendar[13].headline.as_deref(), Some("Concert"));
    assert_eq!(m.suggestions.len(), 1);
    assert_eq!(m.suggestions[0].entry_id, left);
    nb.keep(&m.suggestions[0].key, today).unwrap();
    let m2 = nb.month_view(nov, today);
    assert!(m2.suggestions.is_empty());
    assert_eq!(m2.lines.len(), 2);
    assert_eq!(nb.month_view(oct, today).departed.len(), 1);
}

#[test]
fn persisted_updates_rebuild_the_same_notebook() {
    let c = clock(0.0);
    let mut a = notebook(1, &c);
    let id = a
        .add(Place::day(d("2026-11-05")), task("Écrire à Camille"))
        .unwrap();
    a.set_text(&id, "Écrire à Camille 🌿").unwrap();
    a.cycle_state(&id).unwrap();
    a.migrate(&id, Place::day(d("2026-11-06"))).unwrap();
    let log = a.take_updates();
    assert_eq!(log.len(), 4);
    assert!(a.take_updates().is_empty());
    let mut b = notebook(7, &c);
    // Journal appliqué à l'envers puis à l'endroit : même résultat (ordre et doublons indifférents).
    for u in log.iter().rev().chain(log.iter()) {
        b.apply_update(u).unwrap();
    }
    assert_eq!(a.all(), b.all());
    // Un checkpoint complet aussi.
    let mut c2 = notebook(8, &c);
    c2.apply_update(&a.encode_state()).unwrap();
    assert_eq!(a.all(), c2.all());
    assert!(b.apply_update(&[1, 2, 3]).is_err());
}

#[test]
fn import_v0_merges_copy_chains_and_is_idempotent() {
    let json = r#"{"v":1,"sample":true,"dismissed":["carry:z1"],"entries":[
      {"id":"a1","day":"2026-11-03","week":null,"kind":"task","state":"migrated","marks":[],"text":"Rappeler le plombier","time":"","createdAt":100,"migratedTo":"a2"},
      {"id":"a2","day":"2026-11-04","week":null,"kind":"task","state":"migrated","marks":["priority"],"text":"Rappeler le plombier","time":"","createdAt":200,"migratedTo":"a3"},
      {"id":"a3","day":"2026-11-05","week":null,"kind":"task","state":"open","marks":["priority"],"text":"Rappeler le plombier","time":"","createdAt":300},
      {"id":"b1","day":"2026-11-05","week":null,"kind":"event","state":"open","marks":[],"text":"Course, 6 km","time":"07:45","createdAt":50},
      {"id":"n1","day":null,"week":"2026-11-02","kind":"note","state":"open","marks":[],"text":"Garder le jeudi soir libre","time":"","createdAt":60}
    ]}"#;
    let c = clock(0.0);
    let mut nb = notebook(1, &c);
    let r = nb.import_v0(json).unwrap();
    assert_eq!((r.imported, r.merged_copies, r.skipped), (3, 2, 0));
    let e = nb.get("a3").unwrap();
    assert!(e.priority);
    assert_eq!(e.created_at, 100.0);
    let from: Vec<String> = e
        .trail
        .iter()
        .map(|t| t.from.day.unwrap().to_string())
        .collect();
    assert_eq!(from, ["2026-11-03", "2026-11-04"]);
    assert_eq!(nb.get("b1").unwrap().time.as_deref(), Some("07:45"));
    assert_eq!(
        nb.get("n1").unwrap().place.scope,
        Scope::Week(d("2026-11-02"))
    );
    assert!(nb.is_dismissed("carry:z1"));
    let r2 = nb.import_v0(json).unwrap();
    assert_eq!((r2.imported, r2.skipped), (0, 3));
    assert!(nb.import_v0("{ pas du json").is_err());
}

#[test]
fn big_checkpoint_fills_the_cache() {
    // Au-delà de 32 Ko, la mise à jour est appliquée sans observateur et le cache relu en entier.
    let c = clock(1_700_000_000_000.0);
    let mut a = notebook(1, &c);
    let mut ids = Vec::new();
    for i in 0..600 {
        let day = d("2026-11-02").add_days(i % 30);
        ids.push(
            a.add(
                Place::day(day),
                NewEntry {
                    kind: Some(Kind::Task),
                    text: format!("tâche {i} — une ligne assez longue pour peser"),
                    ..Default::default()
                },
            )
            .unwrap(),
        );
    }
    a.migrate(&ids[0], Place::day(d("2026-12-24"))).unwrap();
    let state = a.encode_state();
    assert!(
        state.len() > 32 * 1024,
        "checkpoint trop petit pour le test : {}",
        state.len()
    );

    let mut b = notebook(2, &c);
    let early = b
        .add(
            Place::day(d("2026-11-03")),
            NewEntry {
                text: "déjà là".into(),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(b.all().len(), 1); // cache rempli avant l'arrivée du checkpoint
    b.apply_update(&state).unwrap();
    assert_eq!(b.all(), b.all_uncached());
    assert_eq!(b.all().len(), 601);
    assert!(b.get(&early).is_some());
    assert_eq!(b.get(&ids[0]).unwrap().place.day, Some(d("2026-12-24")));
    // Après l'arrivée en bloc, l'observateur suit de nouveau les petites modifications.
    b.set_text(&ids[1], "renommée").unwrap();
    assert_eq!(b.get(&ids[1]).unwrap().text, "renommée");
    assert_eq!(b.all(), b.all_uncached());
}

#[test]
fn newer_schema_is_read_only() {
    let c = clock(1_700_000_000_000.0);
    let mut a = notebook(1, &c);
    a.stamp_schema().unwrap();
    assert_eq!(a.schema(), carnet_core::SCHEMA);
    let id = a.add(Place::day(d("2026-11-08")), task("lire")).unwrap();
    // Une version future marque le document d'un schéma plus récent (simulé en écrivant la clé).
    let mut b = notebook(2, &c);
    b.apply_update(&a.encode_state()).unwrap();
    b.force_schema_for_tests(carnet_core::SCHEMA + 1);
    a.apply_update(&b.encode_state()).unwrap();
    assert!(!a.writable());
    assert!(matches!(
        a.set_text(&id, "écrire"),
        Err(carnet_core::Error::NewerSchema(_))
    ));
    assert_eq!(a.get(&id).unwrap().text, "lire"); // la lecture reste possible
    assert!(a
        .week_view(d("2026-11-08"), d("2026-11-08"))
        .days
        .iter()
        .any(|v| !v.lines.is_empty()));
}

#[test]
fn collections_hold_entries_that_migrate() {
    let c = clock(1_700_000_000_000.0);
    let mut a = notebook(1, &c);
    let books = a.create_collection("  Livres à lire  ").unwrap();
    let films = a.create_collection("Films et séries").unwrap();
    assert!(a.create_collection("   ").is_err());
    let here = Place {
        scope: Scope::Collection(books.clone()),
        day: None,
    };
    let t1 = a.add(here.clone(), task("Le Bleu du ciel")).unwrap();
    a.add(here.clone(), task("Les Années")).unwrap();
    let t3 = a.add(here.clone(), task("Middlemarch")).unwrap();
    a.set_state(&t3, State::Done).unwrap();
    let cols = a.collections();
    assert_eq!(
        cols.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(),
        ["Livres à lire", "Films et séries"]
    );
    assert_eq!((cols[0].count, cols[0].open), (3, 2));

    // Une tâche de collection part dans la journée : même entrée, trace « > » dans la collection.
    a.migrate(&t1, Place::day(d("2026-11-08"))).unwrap();
    let v = a.collection_view(&books).unwrap();
    assert_eq!(v.lines.len(), 2);
    assert_eq!(
        v.lines.last().unwrap().entry.id,
        t3,
        "les tâches faites passent après les ouvertes"
    );
    assert_eq!(v.departed.len(), 1);
    assert_eq!(v.departed[0].entry.id, t1);
    assert!(a
        .day_view(d("2026-11-08"), d("2026-11-08"), 3)
        .lines
        .iter()
        .any(|l| l.entry.id == t1));

    // Renommer en même temps sur deux appareils : un seul nom gagne, partout.
    let mut b = notebook(2, &c);
    b.apply_update(&a.encode_state()).unwrap();
    a.rename_collection(&films, "Films").unwrap();
    b.rename_collection(&films, "Séries").unwrap();
    sync(&mut a, &mut b);
    assert_eq!(a.collections(), b.collections());

    // Corbeille et retour.
    a.delete_collection(&books).unwrap();
    assert!(a.collection_view(&books).is_none());
    assert_eq!(a.collections().len(), 1);
    a.restore_collection(&books).unwrap();
    assert_eq!(a.collection_view(&books).unwrap().lines.len(), 2);
}
