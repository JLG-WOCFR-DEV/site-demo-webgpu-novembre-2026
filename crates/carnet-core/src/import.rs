//! Import des données de la v0 (`localStorage` `carnet.v0`).
//!
//! La v0 migrait par copie : l'original passait à `migrated` avec `migratedTo`. Ici, une chaîne de
//! copies devient **une** entrée (la dernière, qui garde son identifiant v0) dont `trail` reprend les
//! jours quittés. Import idempotent : une entrée dont l'identifiant existe déjà est ignorée.
//! L'hôte garde l'original tant que le résultat n'est pas enregistré et vérifié (roadmap § 3.3).

use std::collections::HashMap;

use serde::Deserialize;
use yrs::{Any, Array, ArrayPrelim, Map, MapPrelim, TextPrelim};

use crate::date::{parse_time, Day};
use crate::notebook::{Error, Notebook, Place, Scope};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct V0Entry {
    id: String,
    day: Option<String>,
    week: Option<String>,
    kind: String,
    state: String,
    #[serde(default)]
    marks: Vec<String>,
    #[serde(default)]
    text: String,
    #[serde(default)]
    time: String,
    #[serde(default)]
    created_at: f64,
    migrated_to: Option<String>,
}

#[derive(Deserialize)]
struct V0Store {
    #[serde(default)]
    entries: Vec<V0Entry>,
    #[serde(default)]
    dismissed: Vec<String>,
}

#[derive(Debug, Default, PartialEq, Eq, serde::Serialize)]
pub struct ImportReport {
    pub imported: usize,
    pub merged_copies: usize,
    pub skipped: usize,
}

fn place_of(e: &V0Entry) -> Option<Place> {
    if let Some(d) = e.day.as_deref().and_then(|d| d.parse::<Day>().ok()) {
        return Some(Place::day(d));
    }
    let w: Day = e.week.as_deref()?.parse().ok()?;
    Some(Place {
        scope: Scope::Week(w.monday()),
        day: None,
    })
}

impl Notebook {
    pub fn import_v0(&mut self, json: &str) -> Result<ImportReport, Error> {
        let store: V0Store = serde_json::from_str(json)
            .map_err(|e| Error::Invalid(format!("données v0 illisibles : {e}")))?;
        let by_id: HashMap<&str, &V0Entry> =
            store.entries.iter().map(|e| (e.id.as_str(), e)).collect();
        // Prédécesseur de chaque copie.
        let mut pred: HashMap<&str, &V0Entry> = HashMap::new();
        for e in &store.entries {
            if let Some(to) = e.migrated_to.as_deref() {
                if by_id.contains_key(to) {
                    pred.insert(to, e);
                }
            }
        }
        let mut report = ImportReport::default();
        let existing: std::collections::HashSet<String> =
            self.all().into_iter().map(|e| e.id).collect();
        // Les têtes : ce qui n'a pas été recopié ailleurs (ou dont la copie a disparu).
        let heads: Vec<&V0Entry> = store
            .entries
            .iter()
            .filter(|e| {
                e.migrated_to
                    .as_deref()
                    .is_none_or(|to| !by_id.contains_key(to))
            })
            .collect();
        report.merged_copies = store.entries.len() - heads.len();
        for head in heads {
            if existing.contains(&head.id) {
                report.skipped += 1;
                continue;
            }
            let Some(place) = place_of(head) else {
                report.skipped += 1;
                continue;
            };
            // Jours quittés, du plus ancien au plus récent ; l'instant du départ est la création de la copie.
            let mut trail: Vec<(Place, f64)> = Vec::new();
            let mut cur = head;
            let mut guard = 0;
            while let Some(p) = pred.get(cur.id.as_str()) {
                if let Some(pl) = place_of(p) {
                    trail.push((pl, cur.created_at));
                }
                cur = p;
                guard += 1;
                if guard > 1000 {
                    break;
                }
            }
            trail.reverse();
            let created = cur.created_at;
            let kind = match head.kind.as_str() {
                "task" | "event" => head.kind.clone(),
                _ => "note".to_string(),
            };
            let state = match head.state.as_str() {
                "done" | "cancelled" => head.state.clone(),
                _ => "open".to_string(),
            };
            let time = parse_time(&head.time);
            self.write(|txn, entries, _| {
                let m = entries.insert(txn, head.id.as_str(), MapPrelim::default());
                m.insert(txn, "text", TextPrelim::new(head.text.clone()));
                m.insert(txn, "kind", kind);
                m.insert(txn, "state", state);
                m.insert(txn, "scope", String::from(place.scope.clone()));
                if let Some(d) = place.day {
                    m.insert(txn, "day", d.to_string());
                }
                if let Some(t) = time {
                    m.insert(txn, "time", t);
                }
                if head.marks.iter().any(|x| x == "priority") {
                    m.insert(txn, "priority", true);
                }
                if head.marks.iter().any(|x| x == "idea") {
                    m.insert(txn, "idea", true);
                }
                m.insert(txn, "createdAt", created);
                let a = m.insert(txn, "trail", ArrayPrelim::default());
                for (p, at) in &trail {
                    let mut h: HashMap<String, Any> = HashMap::new();
                    h.insert(
                        "scope".into(),
                        Any::String(String::from(p.scope.clone()).into()),
                    );
                    if let Some(d) = p.day {
                        h.insert("day".into(), Any::String(d.to_string().into()));
                    }
                    h.insert("at".into(), Any::Number(yrs::any::Number::Float(*at)));
                    a.push_back(txn, Any::Map(h.into()));
                }
                Ok(())
            })?;
            report.imported += 1;
        }
        // Suggestions écartées : les clés v0 de reports et d'exemples restent valables.
        for k in &store.dismissed {
            if k.starts_with("carry:") {
                self.dismiss(k)?;
            }
        }
        Ok(report)
    }
}
