//! Humeur du jour (P4c) : une note de 1 à 5, une par jour, pour l'« année en pixels ».
//!
//! `meta.moods` : jour → nombre (1 très difficile … 5 très bien). La dernière écriture gagne (CRDT) ;
//! effacer retire la clé. Rien n'est noté d'office : c'est un geste, jamais une obligation.

use yrs::{Any, Map, MapPrelim, Out};

use crate::date::Day;
use crate::notebook::{Error, Notebook};

impl Notebook {
    /// Note (1…5) ou efface (0) l'humeur d'un jour. Rend vrai si quelque chose a changé.
    pub fn set_mood(&mut self, day: Day, level: u8) -> Result<bool, Error> {
        if level > 5 {
            return Err(Error::Invalid("humeur de 1 à 5".into()));
        }
        let key = day.to_string();
        self.write(|txn, _, meta| {
            let all = match meta.get(txn, "moods") {
                Some(Out::YMap(m)) => m,
                _ => meta.insert(txn, "moods", MapPrelim::default()),
            };
            let cur = match all.get(txn, &key) {
                Some(Out::Any(Any::Number(n))) => n.as_f64().unwrap_or(0.0) as u8,
                _ => 0,
            };
            if cur == level {
                return Ok(false);
            }
            if level == 0 {
                all.remove(txn, &key);
            } else {
                all.insert(txn, key.as_str(), Any::from(level as f64));
            }
            Ok(true)
        })
    }

    /// L'humeur d'un jour (0 : pas notée).
    pub fn mood(&self, day: Day) -> u8 {
        self.moods(day, day).first().map(|m| m.1).unwrap_or(0)
    }

    /// Les humeurs notées entre deux jours (inclus), dans l'ordre.
    pub fn moods(&self, from: Day, to: Day) -> Vec<(Day, u8)> {
        let t = self.read_txn();
        let Some(Out::YMap(all)) = self.meta_ref().get(&t, "moods") else {
            return Vec::new();
        };
        let mut v: Vec<(Day, u8)> = all
            .iter(&t)
            .filter_map(|(k, v)| {
                let day: Day = k.parse().ok()?;
                if day < from || day > to {
                    return None;
                }
                let Out::Any(Any::Number(n)) = v else {
                    return None;
                };
                let x = n.as_f64()?;
                (1.0..=5.0).contains(&x).then_some((day, x as u8))
            })
            .collect();
        v.sort_by_key(|m| m.0);
        v
    }
}
