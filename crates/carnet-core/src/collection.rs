//! Collections (roadmap P4a) : des pages libres nommées — livres, films et séries, recettes, idées.
//!
//! Métadonnées dans `meta.collections` (ULID → `Y.Map` : `name`, `createdAt`, `deletedAt`) ; les
//! entrées vivent dans `entries` avec la portée `collection:<ulid>`, comme toutes les autres : une
//! tâche de collection se migre vers un jour (et inversement) sans changer d'identité.
//! Supprimer une collection la met à la corbeille ; ses entrées restent, invisibles avec elle.

use serde::Serialize;
use yrs::{Any, Map, MapPrelim, MapRef, Out};

use crate::id::Ulid;
use crate::notebook::{Error, Notebook, Place, Scope};
use crate::view::Line;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    /// Entrées vivantes, et tâches encore ouvertes parmi elles.
    pub count: usize,
    pub open: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionView {
    pub collection: Collection,
    pub lines: Vec<Line>,
    pub departed: Vec<Line>,
}

fn num(m: &MapRef, t: &impl yrs::ReadTxn, k: &str) -> Option<f64> {
    match m.get(t, k) {
        Some(Out::Any(Any::Number(n))) => n.as_f64(),
        _ => None,
    }
}
fn text(m: &MapRef, t: &impl yrs::ReadTxn, k: &str) -> Option<String> {
    match m.get(t, k) {
        Some(Out::Any(Any::String(s))) => Some(s.to_string()),
        _ => None,
    }
}

fn clean(name: &str) -> Result<String, Error> {
    let n = name.trim();
    if n.is_empty() {
        return Err(Error::Invalid("une collection a un nom".into()));
    }
    Ok(n.chars().take(80).collect())
}

impl Notebook {
    fn collections_map(meta: &MapRef, txn: &mut yrs::TransactionMut) -> MapRef {
        match meta.get(txn, "collections") {
            Some(Out::YMap(m)) => m,
            _ => meta.insert(txn, "collections", MapPrelim::default()),
        }
    }

    /// Crée une collection ; rend son identifiant.
    pub fn create_collection(&mut self, name: &str) -> Result<String, Error> {
        let name = clean(name)?;
        let now = self.env_now();
        let id = Ulid::new(now as u64, self.env_random()).to_string();
        let id2 = id.clone();
        self.write(move |txn, _, meta| {
            let cols = Self::collections_map(meta, txn);
            let c = cols.insert(txn, id2.as_str(), MapPrelim::default());
            c.insert(txn, "name", name);
            c.insert(txn, "createdAt", now);
            Ok(())
        })?;
        Ok(id)
    }

    pub fn rename_collection(&mut self, id: &str, name: &str) -> Result<(), Error> {
        let name = clean(name)?;
        self.write(|txn, _, meta| {
            let cols = Self::collections_map(meta, txn);
            let Some(Out::YMap(c)) = cols.get(txn, id) else {
                return Err(Error::NotFound(id.to_string()));
            };
            c.insert(txn, "name", name);
            Ok(())
        })
    }

    /// À la corbeille (règle des 30 jours, comme les entrées) ; `restore_collection` la rend.
    pub fn delete_collection(&mut self, id: &str) -> Result<(), Error> {
        let now = self.env_now();
        self.write(|txn, _, meta| {
            let cols = Self::collections_map(meta, txn);
            let Some(Out::YMap(c)) = cols.get(txn, id) else {
                return Err(Error::NotFound(id.to_string()));
            };
            c.insert(txn, "deletedAt", now);
            Ok(())
        })
    }

    pub fn restore_collection(&mut self, id: &str) -> Result<(), Error> {
        self.write(|txn, _, meta| {
            let cols = Self::collections_map(meta, txn);
            let Some(Out::YMap(c)) = cols.get(txn, id) else {
                return Err(Error::NotFound(id.to_string()));
            };
            c.remove(txn, "deletedAt");
            Ok(())
        })
    }

    /// Collections vivantes, par date de création (l'identifiant départage).
    pub fn collections(&self) -> Vec<Collection> {
        let raw: Vec<(String, String, f64)> = {
            let t = self.read_txn();
            match self.meta_ref().get(&t, "collections") {
                Some(Out::YMap(cols)) => cols
                    .iter(&t)
                    .filter_map(|(k, v)| match v {
                        Out::YMap(c) if num(&c, &t, "deletedAt").is_none() => Some((
                            k.to_string(),
                            text(&c, &t, "name").unwrap_or_default(),
                            num(&c, &t, "createdAt").unwrap_or(0.0),
                        )),
                        _ => None,
                    })
                    .collect(),
                _ => Vec::new(),
            }
        };
        let live: Vec<_> = self
            .all()
            .into_iter()
            .filter(|e| e.deleted_at.is_none())
            .collect();
        let mut v: Vec<Collection> = raw
            .into_iter()
            .map(|(id, name, created_at)| {
                let scope = Scope::Collection(id.clone());
                let mine = live.iter().filter(|e| e.place.scope == scope);
                let (count, open) = mine.fold((0, 0), |(c, o), e| {
                    (
                        c + 1,
                        o + usize::from(
                            e.kind == crate::Kind::Task && e.state == crate::State::Open,
                        ),
                    )
                });
                Collection {
                    id,
                    name,
                    created_at,
                    count,
                    open,
                }
            })
            .collect();
        v.sort_by(|a, b| {
            a.created_at
                .total_cmp(&b.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        v
    }

    /// Une collection et ses lignes : tâches ouvertes d'abord, puis par création.
    pub fn collection_view(&self, id: &str) -> Option<CollectionView> {
        let collection = self.collections().into_iter().find(|c| c.id == id)?;
        let here = Place {
            scope: Scope::Collection(id.to_string()),
            day: None,
        };
        let live: Vec<_> = self
            .all()
            .into_iter()
            .filter(|e| e.deleted_at.is_none())
            .collect();
        let mut mine: Vec<_> = live
            .iter()
            .filter(|e| e.place.scope == here.scope)
            .cloned()
            .collect();
        mine.sort_by(|a, b| {
            let done =
                |e: &crate::Entry| e.kind == crate::Kind::Task && e.state != crate::State::Open;
            done(a)
                .cmp(&done(b))
                .then_with(|| a.created_at.total_cmp(&b.created_at))
                .then_with(|| a.id.cmp(&b.id))
        });
        Some(CollectionView {
            collection,
            lines: mine
                .into_iter()
                .map(|entry| Line {
                    entry,
                    departed_to: None,
                })
                .collect(),
            departed: crate::view::departed_from(&live, &here),
        })
    }
}
