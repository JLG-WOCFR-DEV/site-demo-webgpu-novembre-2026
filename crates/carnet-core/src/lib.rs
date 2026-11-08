//! `carnet-core` : le modèle, les règles et les vues de Carnet, sans E/S.
//!
//! Voir `ROADMAP_CARNET.md`, § 3.2 (modèle de données) et § 4.3 (tests de convergence).

mod collection;
pub mod date;
pub mod id;
mod import;
pub mod notebook;
pub mod page;
mod tracker;
pub mod view;
mod weather;

pub use collection::{Collection, CollectionView};
pub use date::{Day, Month};
pub use import::ImportReport;
pub use notebook::{
    text_splice, Departure, Entry, Env, Error, Kind, NewEntry, Notebook, Place, Scope, State,
    SCHEMA, TRASH_MS,
};
pub use page::{Anchor, Item, Page};
pub use tracker::TrackerRow;
pub use view::{CalendarDay, DayView, Line, MonthView, Suggestion, SuggestionKind, WeekView};
pub use weather::Weather;
