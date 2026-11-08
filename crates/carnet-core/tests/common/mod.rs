#![allow(dead_code)]
use std::cell::Cell;
use std::rc::Rc;

use carnet_core::{Env, Notebook};

/// Horloge partagée (pour avancer le temps dans un test) et aléa déterministe.
pub struct TestEnv {
    pub clock: Rc<Cell<f64>>,
    state: u128,
}

impl Env for TestEnv {
    fn now_ms(&mut self) -> f64 {
        let t = self.clock.get() + 1.0;
        self.clock.set(t);
        t
    }
    fn random(&mut self) -> u128 {
        // xorshift128
        let mut x = self.state;
        x ^= x << 35;
        x ^= x >> 59;
        x ^= x << 23;
        self.state = x;
        x
    }
}

pub fn notebook(client: u64, clock: &Rc<Cell<f64>>) -> Notebook {
    Notebook::new(
        client,
        Box::new(TestEnv {
            clock: clock.clone(),
            state: 0x9E37_79B9_7F4A_7C15_F39C_C060_5CED_C834u128
                ^ (client as u128 * 0x1234_5678_9ABC_DEF1),
        }),
    )
}

/// Environnement de test pour un autre document (pages graphiques).
pub fn env(client: u64, clock: &Rc<Cell<f64>>) -> Box<TestEnv> {
    Box::new(TestEnv {
        clock: clock.clone(),
        state: 0x9E37_79B9_7F4A_7C15_F39C_C060_5CED_C834u128
            ^ (client as u128 * 0x1234_5678_9ABC_DEF1),
    })
}

pub fn clock(start: f64) -> Rc<Cell<f64>> {
    Rc::new(Cell::new(start))
}

/// Échange complet : chaque carnet reçoit tout ce qui lui manque des autres.
pub fn sync(a: &mut Notebook, b: &mut Notebook) {
    let da = a.diff(&b.state_vector()).unwrap();
    let db = b.diff(&a.state_vector()).unwrap();
    b.apply_update(&da).unwrap();
    a.apply_update(&db).unwrap();
}
