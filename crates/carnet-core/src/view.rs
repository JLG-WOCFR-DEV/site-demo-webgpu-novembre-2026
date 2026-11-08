//! Modèles de vue (jour, semaine, mois) et suggestions au crayon.
//!
//! Une entrée a une seule identité ; les vues la placent. Un jour quitté par migration montre la
//! ligne « > » à partir de `trail` (le rituel du bullet journal), avec le texte vivant de l'entrée.

use serde::Serialize;

use crate::date::{Day, Month};
use crate::notebook::{Entry, Error, Kind, NewEntry, Notebook, Place, Scope, State};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    #[serde(flatten)]
    pub entry: Entry,
    /// Pour une ligne « > » : la place actuelle de l'entrée.
    pub departed_to: Option<Place>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SuggestionKind {
    /// Tâche ouverte d'un jour passé (14 jours au plus).
    Carry,
    /// Entrée de la page du mois datée de ce jour.
    Plan,
    /// Il y a un an.
    YearAgo,
    /// Tâche ouverte de la page du mois précédent.
    MonthCarry,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub key: String,
    pub kind: SuggestionKind,
    pub entry_id: String,
    pub text: String,
    pub entry_kind: Kind,
    pub time: Option<String>,
    pub from: Place,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayView {
    pub day: Day,
    pub lines: Vec<Line>,
    pub departed: Vec<Line>,
    pub suggestions: Vec<Suggestion>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekView {
    pub monday: Day,
    pub days: Vec<DayView>,
    pub notes: Vec<Line>,
    pub departed_notes: Vec<Line>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDay {
    pub day: Day,
    pub count: usize,
    /// La ligne à montrer dans le calendrier : priorité, sinon événement, sinon la première.
    pub headline: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthView {
    pub month: Month,
    pub calendar: Vec<CalendarDay>,
    pub lines: Vec<Line>,
    pub departed: Vec<Line>,
    pub suggestions: Vec<Suggestion>,
}

fn line(e: &Entry) -> Line {
    Line {
        entry: e.clone(),
        departed_to: None,
    }
}

/// Ordre d'une journée : les entrées à heure d'abord, par heure ; puis par création ; l'identifiant
/// départage (ordre total, identique sur tous les appareils).
fn by_time(a: &Entry, b: &Entry) -> std::cmp::Ordering {
    a.time
        .is_none()
        .cmp(&b.time.is_none())
        .then_with(|| a.time.cmp(&b.time))
        .then_with(|| a.created_at.total_cmp(&b.created_at))
        .then_with(|| a.id.cmp(&b.id))
}

fn sort_day(v: &mut [Entry]) {
    v.sort_by(by_time);
}

fn sort_month(v: &mut [Entry]) {
    v.sort_by(|a, b| {
        a.place
            .day
            .is_none()
            .cmp(&b.place.day.is_none())
            .then_with(|| a.place.day.cmp(&b.place.day))
            .then_with(|| a.time.is_none().cmp(&b.time.is_none()))
            .then_with(|| a.time.cmp(&b.time))
            .then_with(|| a.created_at.total_cmp(&b.created_at))
            .then_with(|| a.id.cmp(&b.id))
    });
}

pub(crate) fn departed_from(live: &[Entry], here: &Place) -> Vec<Line> {
    departed(live, here)
}

fn departed(live: &[Entry], here: &Place) -> Vec<Line> {
    let mut v: Vec<Entry> = live
        .iter()
        .filter(|e| e.place != *here && e.trail.iter().any(|d| d.from == *here))
        .cloned()
        .collect();
    sort_day(&mut v);
    v.into_iter()
        .map(|e| Line {
            departed_to: Some(e.place.clone()),
            entry: e,
        })
        .collect()
}

impl Notebook {
    fn live(&self) -> Vec<Entry> {
        self.all()
            .into_iter()
            .filter(|e| e.deleted_at.is_none())
            .collect()
    }

    fn suggestions_for(&self, live: &[Entry], d: Day, today: Day, limit: usize) -> Vec<Suggestion> {
        let dismissed: std::collections::HashSet<String> = self.dismissed().into_iter().collect();
        let mut out = Vec::new();
        let mk = |key: String, kind: SuggestionKind, e: &Entry| Suggestion {
            key,
            kind,
            entry_id: e.id.clone(),
            text: e.text.clone(),
            entry_kind: e.kind,
            time: e.time.clone(),
            from: e.place.clone(),
        };
        // Prévu ce mois, daté de ce jour.
        let mut plans: Vec<&Entry> = live
            .iter()
            .filter(|e| e.place.scope == Scope::Month(d.month()) && e.place.day == Some(d))
            .filter(|e| !(e.kind == Kind::Task && e.state != State::Open))
            .collect();
        plans.sort_by(|a, b| by_time(a, b));
        out.extend(
            plans
                .into_iter()
                .map(|e| mk(format!("plan:{}", e.id), SuggestionKind::Plan, e)),
        );
        // Reportées : seulement aujourd'hui.
        if d == today {
            let from = today.add_days(-14);
            let mut carry: Vec<&Entry> = live
                .iter()
                .filter(|e| {
                    e.place.scope == Scope::Day && e.kind == Kind::Task && e.state == State::Open
                })
                .filter(|e| e.place.day.is_some_and(|x| x < today && x >= from))
                .collect();
            carry.sort_by(|a, b| a.place.day.cmp(&b.place.day).then_with(|| by_time(a, b)));
            out.extend(
                carry
                    .into_iter()
                    .map(|e| mk(format!("carry:{}", e.id), SuggestionKind::Carry, e)),
            );
        }
        // Il y a un an.
        let ago = d.year_ago();
        let mut olds: Vec<&Entry> = live
            .iter()
            .filter(|e| e.place.scope == Scope::Day && e.kind != Kind::Task)
            .filter(|e| e.place.day.is_some_and(|x| ago.contains(&x)))
            .collect();
        olds.sort_by(|a, b| by_time(a, b));
        out.extend(
            olds.into_iter()
                .map(|e| mk(format!("otd:{}:{d}", e.id), SuggestionKind::YearAgo, e)),
        );
        out.retain(|s| !dismissed.contains(&s.key));
        out.truncate(limit);
        out
    }

    pub fn day_view(&self, d: Day, today: Day, limit: usize) -> DayView {
        self.day_view_in(&self.live(), d, today, limit)
    }

    fn day_view_in(&self, live: &[Entry], d: Day, today: Day, limit: usize) -> DayView {
        let here = Place::day(d);
        let mut v: Vec<Entry> = live.iter().filter(|e| e.place == here).cloned().collect();
        sort_day(&mut v);
        DayView {
            day: d,
            lines: v.iter().map(line).collect(),
            departed: departed(live, &here),
            suggestions: self.suggestions_for(live, d, today, limit),
        }
    }

    /// Semaine : sept jours (3 suggestions au plus par jour) et notes de la semaine.
    pub fn week_view(&self, any_day: Day, today: Day) -> WeekView {
        let live = self.live();
        let monday = any_day.monday();
        let here = Place {
            scope: Scope::Week(monday),
            day: None,
        };
        let mut notes: Vec<Entry> = live.iter().filter(|e| e.place == here).cloned().collect();
        notes.sort_by(|a, b| {
            a.created_at
                .total_cmp(&b.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        WeekView {
            monday,
            days: (0..7)
                .map(|i| self.day_view_in(&live, monday.add_days(i), today, 3))
                .collect(),
            notes: notes.iter().map(line).collect(),
            departed_notes: departed(&live, &here),
        }
    }

    pub fn month_view(&self, m: Month, today: Day) -> MonthView {
        let live = self.live();
        let mut v: Vec<Entry> = live
            .iter()
            .filter(|e| e.place.scope == Scope::Month(m))
            .cloned()
            .collect();
        sort_month(&mut v);
        let calendar = (1..=m.days())
            .map(|i| {
                let d = Day {
                    y: m.y,
                    m: m.m,
                    d: i,
                };
                let mut those: Vec<Entry> = live
                    .iter()
                    .filter(|e| {
                        e.place.day == Some(d)
                            && matches!(e.place.scope, Scope::Day | Scope::Month(_))
                    })
                    .cloned()
                    .collect();
                sort_day(&mut those);
                let headline = those
                    .iter()
                    .find(|e| e.priority)
                    .or_else(|| those.iter().find(|e| e.kind == Kind::Event))
                    .or(those.first())
                    .map(|e| e.text.clone());
                CalendarDay {
                    day: d,
                    count: those.len(),
                    headline,
                }
            })
            .collect();
        // Migration mensuelle : tâches ouvertes de la page du mois précédent.
        let dismissed: std::collections::HashSet<String> = self.dismissed().into_iter().collect();
        let prev = m.prev();
        let mut carry: Vec<&Entry> = live
            .iter()
            .filter(|e| {
                e.place.scope == Scope::Month(prev)
                    && e.kind == Kind::Task
                    && e.state == State::Open
            })
            .collect();
        carry.sort_by(|a, b| {
            a.created_at
                .total_cmp(&b.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        let suggestions = carry
            .into_iter()
            .map(|e| Suggestion {
                key: format!("mcarry:{}:{m}", e.id),
                kind: SuggestionKind::MonthCarry,
                entry_id: e.id.clone(),
                text: e.text.clone(),
                entry_kind: e.kind,
                time: e.time.clone(),
                from: e.place.clone(),
            })
            .filter(|s| !dismissed.contains(&s.key))
            .take(5)
            .collect();
        let _ = today;
        MonthView {
            month: m,
            calendar,
            lines: v.iter().map(line).collect(),
            departed: departed(
                &live,
                &Place {
                    scope: Scope::Month(m),
                    day: None,
                },
            ),
            suggestions,
        }
    }

    /// Garder une suggestion. Renvoie l'identifiant de l'entrée qui porte désormais la ligne.
    ///
    /// - reportée, prévue ce mois : migration vers `day` (même entrée, place quittée dans `trail`) ;
    /// - il y a un an : une note nouvelle « Il y a un an : … » ;
    /// - mois précédent : migration vers la page du mois.
    pub fn keep(&mut self, key: &str, day: Day) -> Result<String, Error> {
        let mut parts = key.splitn(3, ':');
        let (kind, id) = (
            parts.next().unwrap_or(""),
            parts.next().unwrap_or("").to_string(),
        );
        let e = self.get(&id).ok_or_else(|| Error::NotFound(id.clone()))?;
        let out = match kind {
            "carry" | "plan" => {
                self.migrate(&id, Place::day(day))?;
                id
            }
            "otd" => self.add(
                Place::day(day),
                NewEntry {
                    kind: Some(Kind::Note),
                    text: format!("Il y a un an : {}", e.text),
                    ..Default::default()
                },
            )?,
            "mcarry" => {
                let m: Month = parts
                    .next()
                    .unwrap_or("")
                    .parse()
                    .map_err(|_| Error::Invalid(key.to_string()))?;
                self.migrate(
                    &id,
                    Place {
                        scope: Scope::Month(m),
                        day: None,
                    },
                )?;
                id
            }
            _ => return Err(Error::Invalid(format!("suggestion inconnue : {key}"))),
        };
        self.dismiss(key)?;
        Ok(out)
    }
}
