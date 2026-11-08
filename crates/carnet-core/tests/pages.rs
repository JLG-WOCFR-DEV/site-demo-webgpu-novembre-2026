//! Pages graphiques : autocollants et traits (roadmap P4b).
mod common;

use carnet_core::{Anchor, Item, Page};
use common::{clock, env};
use proptest::prelude::*;

fn page(client: u64, c: &std::rc::Rc<std::cell::Cell<f64>>) -> Page {
    Page::new(client, env(client, c))
}
fn at(x: f64, y: f64) -> Anchor {
    Anchor { x, y, w: 400.0 }
}
fn sync(a: &mut Page, b: &mut Page) {
    for u in a.take_updates() {
        b.apply_update(&u).unwrap();
    }
    for u in b.take_updates() {
        a.apply_update(&u).unwrap();
    }
    a.apply_update(&b.encode_state()).unwrap();
    b.apply_update(&a.encode_state()).unwrap();
}

#[test]
fn stickers_and_strokes_round_trip() {
    let c = clock(1_700_000_000_000.0);
    let mut p = page(1, &c);
    assert!(p.is_empty());
    let leaf = p
        .add_sticker("saison/feuille", "automne", at(40.0, 12.0), 15.0, 1.2)
        .unwrap();
    c.set(c.get() + 1.0);
    let pts = [0.0, 0.0, 0.5, 10.0, 4.0, 0.7, 20.0, 2.0, 0.4];
    let line = p
        .add_stroke("encre", "#1d2840", 2.5, at(10.0, 10.0), &pts)
        .unwrap();
    assert!(p
        .add_stroke("encre", "#000", 2.0, at(0.0, 0.0), &[1.0, 2.0])
        .is_err());
    assert!(p
        .add_sticker(
            "x",
            "ete",
            Anchor {
                x: 0.0,
                y: 0.0,
                w: 0.0
            },
            0.0,
            1.0
        )
        .is_err());
    let items = p.items();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].id(), leaf, "posé d'abord, dessous");
    match &items[1] {
        Item::Stroke { points, width, .. } => {
            assert_eq!(points.as_slice(), &pts);
            assert_eq!(*width, 2.5);
        }
        _ => panic!("trait attendu"),
    }
    // Rejoué depuis l'état : identique.
    let mut q = page(2, &c);
    q.apply_update(&p.encode_state()).unwrap();
    assert_eq!(q.items(), p.items());
    // Déplacer passe au premier plan ; supprimer, restaurer.
    p.move_item(&leaf, at(100.0, 30.0)).unwrap();
    assert_eq!(p.items().last().unwrap().id(), leaf);
    p.delete_item(&line).unwrap();
    assert_eq!(p.items().len(), 1);
    p.restore_item(&line).unwrap();
    assert_eq!(p.items().len(), 2);
    let _ = line;
}

#[test]
fn concurrent_move_and_rotate_merge() {
    let c = clock(1_700_000_000_000.0);
    let mut a = page(1, &c);
    let mut b = page(2, &c);
    let id = a
        .add_sticker("activite/cuisine", "ete", at(10.0, 10.0), 0.0, 1.0)
        .unwrap();
    sync(&mut a, &mut b);
    // Téléphone : déplace ; ordinateur : tourne et agrandit. Les deux gestes survivent.
    a.move_item(&id, at(200.0, 50.0)).unwrap();
    b.transform(&id, 30.0, 2.0).unwrap();
    sync(&mut a, &mut b);
    assert_eq!(a.items(), b.items());
    match &a.items()[0] {
        Item::Sticker {
            anchor, rot, scale, ..
        } => {
            assert_eq!((anchor.x, anchor.y), (200.0, 50.0));
            assert_eq!((*rot, *scale), (30.0, 2.0));
        }
        _ => panic!(),
    }
    // Bornes : la taille reste dans [0,25 ; 4], l'angle dans [0 ; 360).
    a.transform(&id, -30.0, 99.0).unwrap();
    match &a.items()[0] {
        Item::Sticker { rot, scale, .. } => assert_eq!((*rot, *scale), (330.0, 4.0)),
        _ => panic!(),
    }
}

#[derive(Debug, Clone)]
enum Op {
    Add(u8, u16, u16),
    Move(u8, u16, u16, u16),
    Turn(u8, u16, u16),
    Delete(u8, u16),
    Deliver(u8, u16),
}
fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        (0u8..3, 0u16..400, 0u16..300).prop_map(|(r, x, y)| Op::Add(r, x, y)),
        (0u8..3, any::<u16>(), 0u16..400, 0u16..300).prop_map(|(r, i, x, y)| Op::Move(r, i, x, y)),
        (0u8..3, any::<u16>(), 0u16..360).prop_map(|(r, i, a)| Op::Turn(r, i, a)),
        (0u8..3, any::<u16>()).prop_map(|(r, i)| Op::Delete(r, i)),
        (0u8..3, any::<u16>()).prop_map(|(r, i)| Op::Deliver(r, i)),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 300, ..ProptestConfig::default() })]
    /// Trois appareils, livraison dans le désordre et en double : ils finissent identiques.
    #[test]
    fn pages_converge(script in prop::collection::vec(op(), 1..60)) {
        let c = clock(1_700_000_000_000.0);
        let mut reps: Vec<Page> = (1..=3).map(|i| page(i, &c)).collect();
        let mut net: Vec<Vec<u8>> = Vec::new();
        for o in &script {
            c.set(c.get() + 1.0);
            match *o {
                Op::Add(r, x, y) => { reps[r as usize].add_sticker("s", "ete", at(x as f64, y as f64), 0.0, 1.0).unwrap(); }
                Op::Move(r, i, x, y) => {
                    let ids: Vec<String> = reps[r as usize].items().iter().map(|it| it.id().to_string()).collect();
                    if !ids.is_empty() { reps[r as usize].move_item(&ids[i as usize % ids.len()], at(x as f64, y as f64)).unwrap(); }
                }
                Op::Turn(r, i, a) => {
                    let ids: Vec<String> = reps[r as usize].items().iter().map(|it| it.id().to_string()).collect();
                    if !ids.is_empty() { reps[r as usize].transform(&ids[i as usize % ids.len()], a as f64, 1.5).unwrap(); }
                }
                Op::Delete(r, i) => {
                    let ids: Vec<String> = reps[r as usize].items().iter().map(|it| it.id().to_string()).collect();
                    if !ids.is_empty() { reps[r as usize].delete_item(&ids[i as usize % ids.len()]).unwrap(); }
                }
                Op::Deliver(r, i) => {
                    if !net.is_empty() { let u = net[i as usize % net.len()].clone(); reps[r as usize].apply_update(&u).unwrap(); }
                }
            }
            for rep in reps.iter_mut() { net.extend(rep.take_updates()); }
        }
        // Livraison complète, à l'envers et en double.
        for rep in reps.iter_mut() {
            for u in net.iter().rev() { rep.apply_update(u).unwrap(); }
            for u in net.iter() { rep.apply_update(u).unwrap(); }
        }
        for rep in &reps { prop_assert!(!rep.has_pending()); }
        prop_assert_eq!(reps[0].items(), reps[1].items());
        prop_assert_eq!(reps[1].items(), reps[2].items());
    }
}

#[test]
fn photos_reference_media() {
    let c = clock(1_700_000_000_000.0);
    let mut p = page(1, &c);
    let sha = "a".repeat(64);
    let id = p
        .add_photo(&sha, 1.5, true, at(120.0, 80.0), -3.0, 1.0)
        .unwrap();
    assert!(p
        .add_photo("pas-un-sha", 1.0, false, at(0.0, 0.0), 0.0, 1.0)
        .is_err());
    assert!(p
        .add_photo(&sha, 0.0, false, at(0.0, 0.0), 0.0, 1.0)
        .is_err());
    match &p.items()[0] {
        Item::Photo {
            sha: s,
            ratio,
            approx,
            ..
        } => assert_eq!((s.as_str(), *ratio, *approx), (sha.as_str(), 1.5, true)),
        _ => panic!("photo attendue"),
    }
    // Les références restent connues même à la corbeille : la corbeille se restaure, le fichier doit rester.
    p.delete_item(&id).unwrap();
    assert_eq!(p.media(), vec![sha]);
}
