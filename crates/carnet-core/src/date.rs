//! Dates de journal : une date civile sans fuseau (`AAAA-MM-JJ`).
//!
//! Règle produit : une entrée du 7 novembre à 14:00 le reste, quel que soit le fuseau de l'appareil.
//! Le core ne lit donc jamais l'horloge pour fabriquer une date : l'hôte lui donne « aujourd'hui ».

use std::fmt;
use std::str::FromStr;

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(into = "String", try_from = "String")]
pub struct Day {
    pub y: i32,
    pub m: u32,
    pub d: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DateError(pub String);

impl fmt::Display for DateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "date invalide : {}", self.0)
    }
}
impl std::error::Error for DateError {}

pub fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

pub fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(y) => 29,
        _ => 28,
    }
}

impl Day {
    pub fn new(y: i32, m: u32, d: u32) -> Result<Day, DateError> {
        if !(1..=12).contains(&m) || d == 0 || d > days_in_month(y, m) {
            return Err(DateError(format!("{y:04}-{m:02}-{d:02}")));
        }
        Ok(Day { y, m, d })
    }

    /// Jours depuis le 1970-01-01 (algorithme civil de H. Hinnant).
    pub fn to_days(self) -> i64 {
        let y = self.y as i64 - if self.m <= 2 { 1 } else { 0 };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = y - era * 400;
        let mp = (self.m as i64 + 9) % 12;
        let doy = (153 * mp + 2) / 5 + self.d as i64 - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        era * 146097 + doe - 719468
    }

    pub fn from_days(z: i64) -> Day {
        let z = z + 719468;
        let era = if z >= 0 { z } else { z - 146096 } / 146097;
        let doe = z - era * 146097;
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
        let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
        let y = (yoe + era * 400 + if m <= 2 { 1 } else { 0 }) as i32;
        Day { y, m, d }
    }

    pub fn add_days(self, n: i64) -> Day {
        Day::from_days(self.to_days() + n)
    }

    /// 0 = lundi … 6 = dimanche.
    pub fn weekday(self) -> u32 {
        // Le 1970-01-01 était un jeudi (3).
        ((self.to_days() + 3).rem_euclid(7)) as u32
    }

    pub fn monday(self) -> Day {
        self.add_days(-(self.weekday() as i64))
    }

    pub fn month(self) -> Month {
        Month {
            y: self.y,
            m: self.m,
        }
    }

    /// Les jours que « il y a un an » montre pour `self`.
    ///
    /// Règle produit : un 28 février d'une année non bissextile montre aussi le 29 février de
    /// l'année d'avant quand elle en avait un ; un 29 février montre le 28 février d'il y a un an.
    pub fn year_ago(self) -> Vec<Day> {
        let py = self.y - 1;
        if self.m == 2 && self.d == 29 {
            return vec![Day { y: py, m: 2, d: 28 }];
        }
        let mut out = vec![Day {
            y: py,
            m: self.m,
            d: self.d,
        }];
        if self.m == 2 && self.d == 28 && !is_leap(self.y) && is_leap(py) {
            out.push(Day { y: py, m: 2, d: 29 });
        }
        out
    }
}

impl fmt::Display for Day {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}-{:02}", self.y, self.m, self.d)
    }
}

impl FromStr for Day {
    type Err = DateError;
    fn from_str(s: &str) -> Result<Day, DateError> {
        let bad = || DateError(s.to_string());
        let mut it = s.split('-');
        let (y, m, d) = (
            it.next().ok_or_else(bad)?,
            it.next().ok_or_else(bad)?,
            it.next().ok_or_else(bad)?,
        );
        if it.next().is_some() || y.len() != 4 || m.len() != 2 || d.len() != 2 {
            return Err(bad());
        }
        Day::new(
            y.parse().map_err(|_| bad())?,
            m.parse().map_err(|_| bad())?,
            d.parse().map_err(|_| bad())?,
        )
    }
}

impl From<Day> for String {
    fn from(d: Day) -> String {
        d.to_string()
    }
}
impl TryFrom<String> for Day {
    type Error = DateError;
    fn try_from(s: String) -> Result<Day, DateError> {
        s.parse()
    }
}

/// Un mois de journal (`AAAA-MM`).
#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(into = "String", try_from = "String")]
pub struct Month {
    pub y: i32,
    pub m: u32,
}

impl Month {
    pub fn first(self) -> Day {
        Day {
            y: self.y,
            m: self.m,
            d: 1,
        }
    }
    pub fn days(self) -> u32 {
        days_in_month(self.y, self.m)
    }
    pub fn prev(self) -> Month {
        if self.m == 1 {
            Month {
                y: self.y - 1,
                m: 12,
            }
        } else {
            Month {
                y: self.y,
                m: self.m - 1,
            }
        }
    }
    pub fn next(self) -> Month {
        if self.m == 12 {
            Month {
                y: self.y + 1,
                m: 1,
            }
        } else {
            Month {
                y: self.y,
                m: self.m + 1,
            }
        }
    }
}

impl fmt::Display for Month {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}", self.y, self.m)
    }
}

impl FromStr for Month {
    type Err = DateError;
    fn from_str(s: &str) -> Result<Month, DateError> {
        let bad = || DateError(s.to_string());
        let (y, m) = s.split_once('-').ok_or_else(bad)?;
        if y.len() != 4 || m.len() != 2 {
            return Err(bad());
        }
        let (y, m): (i32, u32) = (y.parse().map_err(|_| bad())?, m.parse().map_err(|_| bad())?);
        if !(1..=12).contains(&m) {
            return Err(bad());
        }
        Ok(Month { y, m })
    }
}

impl From<Month> for String {
    fn from(m: Month) -> String {
        m.to_string()
    }
}
impl TryFrom<String> for Month {
    type Error = DateError;
    fn try_from(s: String) -> Result<Month, DateError> {
        s.parse()
    }
}

/// Heure murale `HH:MM`, sans fuseau.
pub fn parse_time(s: &str) -> Option<String> {
    let (h, m) = s.split_once(':')?;
    let (h, m): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
    (h < 24 && m < 60 && s.len() <= 5).then(|| format!("{h:02}:{m:02}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_roundtrip_and_weekday() {
        let d: Day = "2026-11-07".parse().unwrap();
        assert_eq!(Day::from_days(d.to_days()), d);
        assert_eq!(d.weekday(), 5); // samedi
        assert_eq!(d.monday().to_string(), "2026-11-02");
        assert_eq!("1970-01-01".parse::<Day>().unwrap().to_days(), 0);
        assert_eq!(Day::from_days(-1).to_string(), "1969-12-31");
    }

    #[test]
    fn rejects_bad_dates() {
        assert!("2026-02-29".parse::<Day>().is_err());
        assert!("2024-02-29".parse::<Day>().is_ok());
        assert!("2026-13-01".parse::<Day>().is_err());
        assert!("26-1-1".parse::<Day>().is_err());
    }

    #[test]
    fn year_ago_around_leap_days() {
        let s = |v: Vec<Day>| v.iter().map(|d| d.to_string()).collect::<Vec<_>>();
        assert_eq!(
            s("2025-02-28".parse::<Day>().unwrap().year_ago()),
            ["2024-02-28", "2024-02-29"]
        );
        assert_eq!(
            s("2028-02-29".parse::<Day>().unwrap().year_ago()),
            ["2027-02-28"]
        );
        assert_eq!(
            s("2027-02-28".parse::<Day>().unwrap().year_ago()),
            ["2026-02-28"]
        );
        assert_eq!(
            s("2026-11-07".parse::<Day>().unwrap().year_ago()),
            ["2025-11-07"]
        );
    }

    #[test]
    fn times() {
        assert_eq!(parse_time("9:05").as_deref(), Some("09:05"));
        assert_eq!(parse_time("24:00"), None);
        assert_eq!(parse_time("12:5x"), None);
    }
}
