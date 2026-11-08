//! Météo du jour (P4b) : ce qu'il a fait, gardé dans le carnet comme un souvenir.
//!
//! `meta.weather` : jour → `{ code, max, min }` (code météo OMM, températures en °C). Les jours passés
//! ne changent plus une fois notés ; aujourd'hui se met à jour jusqu'au lendemain. Les prévisions ne
//! sont pas écrites (elles ne sont pas un souvenir) : la coquille les affiche à part.

use std::collections::HashMap;
use std::sync::Arc;

use serde::Serialize;
use yrs::{Any, Map, MapPrelim, Out};

use crate::date::Day;
use crate::notebook::{Error, Notebook};

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Weather {
    pub day: Day,
    pub code: u8,
    pub max: f64,
    pub min: f64,
}

fn read(v: &Any) -> Option<(u8, f64, f64)> {
    let Any::Map(h) = v else { return None };
    let n = |k: &str| match h.get(k) {
        Some(Any::Number(n)) => n.as_f64(),
        _ => None,
    };
    Some((n("code")? as u8, n("max")?, n("min")?))
}

impl Notebook {
    /// Note la météo d'un jour passé ou d'aujourd'hui. Un jour passé déjà noté ne change plus.
    pub fn set_weather(&mut self, w: Weather, today: Day) -> Result<bool, Error> {
        if w.day > today {
            return Err(Error::Invalid(
                "une prévision ne s'écrit pas dans le carnet".into(),
            ));
        }
        if !(w.max.is_finite() && w.min.is_finite()) || w.code > 99 {
            return Err(Error::Invalid("météo illisible".into()));
        }
        let key = w.day.to_string();
        self.write(|txn, _, meta| {
            let all = match meta.get(txn, "weather") {
                Some(Out::YMap(m)) => m,
                _ => meta.insert(txn, "weather", MapPrelim::default()),
            };
            let same = match all.get(txn, &key) {
                Some(Out::Any(v)) => read(&v),
                _ => None,
            };
            let round = |x: f64| (x * 10.0).round() / 10.0;
            let next = (w.code, round(w.max), round(w.min));
            if same.is_some() && (w.day < today || same == Some(next)) {
                return Ok(false);
            }
            let mut h: HashMap<String, Any> = HashMap::new();
            h.insert("code".into(), Any::from(next.0 as f64));
            h.insert("max".into(), Any::from(next.1));
            h.insert("min".into(), Any::from(next.2));
            all.insert(txn, key.as_str(), Any::Map(Arc::new(h)));
            Ok(true)
        })
    }

    /// La météo notée entre deux jours (inclus).
    pub fn weather(&self, from: Day, to: Day) -> Vec<Weather> {
        let t = self.read_txn();
        let Some(Out::YMap(all)) = self.meta_ref().get(&t, "weather") else {
            return Vec::new();
        };
        let mut v: Vec<Weather> = all
            .iter(&t)
            .filter_map(|(k, v)| {
                let day: Day = k.parse().ok()?;
                if day < from || day > to {
                    return None;
                }
                let Out::Any(a) = v else { return None };
                let (code, max, min) = read(&a)?;
                Some(Weather {
                    day,
                    code,
                    max,
                    min,
                })
            })
            .collect();
        v.sort_by(|a, b| a.day.cmp(&b.day));
        v
    }
}
