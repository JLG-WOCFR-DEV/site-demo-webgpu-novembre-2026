//! Suivis (habit trackers, roadmap P4b) : une grille par mois, une ligne par habitude.
//!
//! `meta.trackers` : ULID → `Y.Map` (`name`, `createdAt`, `deletedAt`, `done` : `Y.Map` jour → vrai).
//! Cocher sur deux appareils le même jour converge (une clé par jour) ; décocher retire la clé.

use serde::Serialize;
use yrs::{Any, Map, MapPrelim, MapRef, Out, ReadTxn};

use crate::date::{Day, Month};
use crate::id::Ulid;
use crate::notebook::{Error, Notebook};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerRow {
    pub id: String,
    pub name: String,
    /// Un booléen par jour du mois (index 0 : le 1er).
    pub days: Vec<bool>,
    pub count: usize,
}

fn num<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> Option<f64> {
    match m.get(t, k) {
        Some(Out::Any(Any::Number(n))) => n.as_f64(),
        _ => None,
    }
}

impl Notebook {
    fn trackers_map(meta: &MapRef, txn: &mut yrs::TransactionMut) -> MapRef {
        match meta.get(txn, "trackers") {
            Some(Out::YMap(m)) => m,
            _ => meta.insert(txn, "trackers", MapPrelim::default()),
        }
    }

    fn tracker<T: ReadTxn>(cols: &MapRef, t: &T, id: &str) -> Result<MapRef, Error> {
        match cols.get(t, id) {
            Some(Out::YMap(m)) => Ok(m),
            _ => Err(Error::NotFound(id.to_string())),
        }
    }

    pub fn create_tracker(&mut self, name: &str) -> Result<String, Error> {
        let name: String = name.trim().chars().take(60).collect();
        if name.is_empty() {
            return Err(Error::Invalid("un suivi a un nom".into()));
        }
        let now = self.env_now();
        let id = Ulid::new(now as u64, self.env_random()).to_string();
        let id2 = id.clone();
        self.write(move |txn, _, meta| {
            let all = Self::trackers_map(meta, txn);
            let m = all.insert(txn, id2.as_str(), MapPrelim::default());
            m.insert(txn, "name", name);
            m.insert(txn, "createdAt", now);
            m.insert(txn, "done", MapPrelim::default());
            Ok(())
        })?;
        Ok(id)
    }

    pub fn rename_tracker(&mut self, id: &str, name: &str) -> Result<(), Error> {
        let name: String = name.trim().chars().take(60).collect();
        if name.is_empty() {
            return Err(Error::Invalid("un suivi a un nom".into()));
        }
        self.write(|txn, _, meta| {
            let all = Self::trackers_map(meta, txn);
            Self::tracker(&all, txn, id)?.insert(txn, "name", name);
            Ok(())
        })
    }

    pub fn delete_tracker(&mut self, id: &str) -> Result<(), Error> {
        let now = self.env_now();
        self.write(|txn, _, meta| {
            let all = Self::trackers_map(meta, txn);
            Self::tracker(&all, txn, id)?.insert(txn, "deletedAt", now);
            Ok(())
        })
    }

    pub fn restore_tracker(&mut self, id: &str) -> Result<(), Error> {
        self.write(|txn, _, meta| {
            let all = Self::trackers_map(meta, txn);
            Self::tracker(&all, txn, id)?.remove(txn, "deletedAt");
            Ok(())
        })
    }

    /// Coche ou décoche un jour ; rend le nouvel état.
    pub fn toggle_tracker(&mut self, id: &str, day: Day) -> Result<bool, Error> {
        self.write(|txn, _, meta| {
            let all = Self::trackers_map(meta, txn);
            let t = Self::tracker(&all, txn, id)?;
            let done = match t.get(txn, "done") {
                Some(Out::YMap(d)) => d,
                _ => t.insert(txn, "done", MapPrelim::default()),
            };
            let k = day.to_string();
            if done.get(txn, &k).is_some() {
                done.remove(txn, &k);
                Ok(false)
            } else {
                done.insert(txn, k, true);
                Ok(true)
            }
        })
    }

    /// Les suivis vivants et leurs cases pour un mois, par date de création.
    pub fn trackers(&self, m: Month) -> Vec<TrackerRow> {
        let t = self.read_txn();
        let Some(Out::YMap(all)) = self.meta_ref().get(&t, "trackers") else {
            return Vec::new();
        };
        let mut rows: Vec<(f64, TrackerRow)> = all
            .iter(&t)
            .filter_map(|(id, v)| {
                let Out::YMap(tr) = v else { return None };
                if num(&tr, &t, "deletedAt").is_some() {
                    return None;
                }
                let name = match tr.get(&t, "name") {
                    Some(Out::Any(Any::String(s))) => s.to_string(),
                    _ => String::new(),
                };
                let done = match tr.get(&t, "done") {
                    Some(Out::YMap(d)) => Some(d),
                    _ => None,
                };
                let days: Vec<bool> = (1..=m.days())
                    .map(|d| {
                        let k = Day { y: m.y, m: m.m, d }.to_string();
                        done.as_ref().is_some_and(|x| x.get(&t, &k).is_some())
                    })
                    .collect();
                let count = days.iter().filter(|b| **b).count();
                Some((
                    num(&tr, &t, "createdAt").unwrap_or(0.0),
                    TrackerRow {
                        id: id.to_string(),
                        name,
                        days,
                        count,
                    },
                ))
            })
            .collect();
        rows.sort_by(|a, b| a.0.total_cmp(&b.0).then_with(|| a.1.id.cmp(&b.1.id)));
        rows.into_iter().map(|(_, r)| r).collect()
    }
}
