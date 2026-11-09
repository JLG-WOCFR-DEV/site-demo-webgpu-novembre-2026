//! Recherche dans le carnet, et vue de l'année (le « future log » du bullet journal).

use serde::Serialize;

use crate::date::{Day, Month};
use crate::notebook::{Entry, Kind, Notebook, Scope, State};
use crate::view::Line;

/* ───── Recherche ───── */

/// Une lettre repliée : minuscule, sans accent (œ → oe). Couvre le français et les langues latines courantes.
fn fold_char(c: char) -> &'static str {
    match c {
        'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => "a",
        'ç' | 'Ç' => "c",
        'è' | 'é' | 'ê' | 'ë' | 'È' | 'É' | 'Ê' | 'Ë' => "e",
        'ì' | 'í' | 'î' | 'ï' | 'Ì' | 'Í' | 'Î' | 'Ï' => "i",
        'ñ' | 'Ñ' => "n",
        'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'ø' | 'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' | 'Ø' => "o",
        'ù' | 'ú' | 'û' | 'ü' | 'Ù' | 'Ú' | 'Û' | 'Ü' => "u",
        'ý' | 'ÿ' | 'Ý' | 'Ÿ' => "y",
        'œ' | 'Œ' => "oe",
        'æ' | 'Æ' => "ae",
        'ß' => "ss",
        '’' | '‘' | '`' => "'",
        _ => "",
    }
}

/// Texte replié, et pour chaque octet replié la position UTF-16 de la lettre d'origine (début, fin).
fn fold(s: &str) -> (String, Vec<(u32, u32)>) {
    let mut out = String::with_capacity(s.len());
    let mut map = Vec::with_capacity(s.len());
    let mut u16pos = 0u32;
    for c in s.chars() {
        let w = c.len_utf16() as u32;
        let f = fold_char(c);
        let start = out.len();
        if !f.is_empty() {
            out.push_str(f);
        } else {
            out.extend(c.to_lowercase());
        }
        for _ in start..out.len() {
            map.push((u16pos, u16pos + w));
        }
        u16pos += w;
    }
    (out, map)
}

/// Les mots d'une requête, repliés ; les guillemets gardent une expression entière.
fn terms(q: &str) -> Vec<String> {
    let mut out = Vec::new();
    for (i, part) in q.split('"').enumerate() {
        if i % 2 == 1 {
            let t = fold(part.trim()).0;
            if !t.is_empty() {
                out.push(t);
            }
        } else {
            out.extend(
                part.split_whitespace()
                    .map(|w| fold(w).0)
                    .filter(|w| !w.is_empty()),
            );
        }
    }
    out
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    #[serde(flatten)]
    pub entry: Entry,
    /// Passages trouvés dans le texte, en positions UTF-16 `[début, fin)` (pour les surligner).
    pub ranges: Vec<(u32, u32)>,
}

impl Notebook {
    /// Entrées vivantes contenant tous les mots de `query` (sans tenir compte des accents ni de la casse).
    /// Les plus récentes d'abord (jour de la place, sinon création).
    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchHit> {
        let ts = terms(query);
        if ts.is_empty() {
            return Vec::new();
        }
        let mut hits: Vec<(f64, SearchHit)> = Vec::new();
        for e in self.all() {
            if e.deleted_at.is_some() {
                continue;
            }
            let (f, map) = fold(&e.text);
            let mut ranges = Vec::new();
            let mut all = true;
            for t in &ts {
                let found: Vec<usize> = f.match_indices(t.as_str()).map(|(i, _)| i).collect();
                if found.is_empty() {
                    all = false;
                    break;
                }
                for i in found {
                    ranges.push((map[i].0, map[i + t.len() - 1].1));
                }
            }
            if !all {
                continue;
            }
            ranges.sort_unstable();
            ranges.dedup();
            // Récence : le jour de la place (rendez-vous à venir compris), sinon la création.
            let when = e
                .place
                .day
                .map(|d| d.to_days() as f64 * 86_400_000.0)
                .unwrap_or(e.created_at);
            hits.push((when, SearchHit { entry: e, ranges }));
        }
        hits.sort_by(|a, b| {
            b.0.total_cmp(&a.0)
                .then_with(|| a.1.entry.id.cmp(&b.1.entry.id))
        });
        hits.into_iter().take(limit).map(|(_, h)| h).collect()
    }

    /// L'année : pour chaque mois, la page du mois (future log) et l'activité de chaque jour.
    pub fn year_view(&self, year: i32, today: Day) -> YearView {
        let live: Vec<Entry> = self
            .all()
            .into_iter()
            .filter(|e| e.deleted_at.is_none())
            .collect();
        let months = (1..=12)
            .map(|m| {
                let mo = Month { y: year, m };
                let mut page: Vec<&Entry> = live
                    .iter()
                    .filter(|e| e.place.scope == Scope::Month(mo))
                    .collect();
                page.sort_by(|a, b| {
                    a.place
                        .day
                        .is_none()
                        .cmp(&b.place.day.is_none())
                        .then_with(|| a.place.day.cmp(&b.place.day))
                        .then_with(|| a.time.cmp(&b.time))
                        .then_with(|| a.created_at.total_cmp(&b.created_at))
                        .then_with(|| a.id.cmp(&b.id))
                });
                let mut days = vec![0u32; mo.days() as usize];
                let mut events = 0;
                for e in &live {
                    if let Some(d) = e.place.day {
                        if d.y == year
                            && d.m == m
                            && matches!(e.place.scope, Scope::Day | Scope::Month(_))
                        {
                            days[(d.d - 1) as usize] += 1;
                            if e.kind == Kind::Event {
                                events += 1;
                            }
                        }
                    }
                }
                let mut moods = vec![0u8; mo.days() as usize];
                for (d, l) in self.moods(
                    mo.first(),
                    Day {
                        y: year,
                        m,
                        d: mo.days(),
                    },
                ) {
                    moods[(d.d - 1) as usize] = l;
                }
                let open = page
                    .iter()
                    .filter(|e| e.kind == Kind::Task && e.state == State::Open)
                    .count();
                YearMonth {
                    month: mo,
                    lines: page
                        .into_iter()
                        .map(|e| Line {
                            entry: e.clone(),
                            departed_to: None,
                        })
                        .collect(),
                    days,
                    moods,
                    events,
                    open,
                    past: (year, m) < (today.y, today.m),
                    current: (year, m) == (today.y, today.m),
                }
            })
            .collect();
        YearView { year, months }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YearMonth {
    pub month: Month,
    /// La page du mois : rendez-vous datés d'abord, puis le reste.
    pub lines: Vec<Line>,
    /// Entrées par jour (log du jour et rendez-vous datés).
    pub days: Vec<u32>,
    /// Humeur de chaque jour (0 : pas notée, 1 … 5).
    pub moods: Vec<u8>,
    pub events: usize,
    /// Tâches encore ouvertes sur la page du mois.
    pub open: usize,
    pub past: bool,
    pub current: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YearView {
    pub year: i32,
    pub months: Vec<YearMonth>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repli_et_positions() {
        let (f, map) = fold("Œuf à Noël");
        assert_eq!(f, "oeuf a noel");
        // « oe » vient tout entier du « Œ » (UTF-16 0..1).
        assert_eq!(map[0], (0, 1));
        assert_eq!(map[1], (0, 1));
        assert_eq!(
            terms("  Noël \"rendez vous\" "),
            vec!["noel", "rendez vous"]
        );
    }
}
