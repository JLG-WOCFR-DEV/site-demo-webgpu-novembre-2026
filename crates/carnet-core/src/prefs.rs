//! Préférences du carnet (P7-L0) : thème du mois, style des titres, fond, encre, rubans…
//!
//! `meta.prefs` : clé → chaîne. Elles voyagent avec le carnet (sauvegarde, versions, restauration),
//! contrairement aux réglages d'un appareil (stylet, lumière), qui restent dans le navigateur.
//! La dernière écriture gagne (CRDT) ; retirer une clé rend sa valeur par défaut.
//!
//! Ajout pur au document : les carnets d'avant n'ont simplement pas de `meta.prefs` ; le schéma ne
//! change pas (un ancien code lit et écrit sans y toucher).

use yrs::{Any, Map, MapPrelim, Out};

use crate::notebook::{Error, Notebook};

const KEY_MAX: usize = 64;
const VALUE_MAX: usize = 2000;

fn check_key(k: &str) -> Result<(), Error> {
    let ok = !k.is_empty()
        && k.len() <= KEY_MAX
        && k.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b":._-".contains(&b));
    if ok {
        Ok(())
    } else {
        Err(Error::Invalid(format!(
            "clé de préférence invalide : {k:?}"
        )))
    }
}

impl Notebook {
    /// Pose (Some) ou retire (None) une préférence. Rend vrai si quelque chose a changé.
    pub fn set_pref(&mut self, key: &str, value: Option<&str>) -> Result<bool, Error> {
        check_key(key)?;
        if let Some(v) = value {
            if v.chars().count() > VALUE_MAX {
                return Err(Error::Invalid(format!("préférence trop longue ({key})")));
            }
        }
        let cur = self.pref(key);
        if cur.as_deref() == value {
            return Ok(false);
        }
        self.write(|txn, _, meta| {
            let all = match meta.get(txn, "prefs") {
                Some(Out::YMap(m)) => m,
                _ => meta.insert(txn, "prefs", MapPrelim::default()),
            };
            match value {
                Some(v) => {
                    all.insert(txn, key, Any::from(v));
                }
                None => {
                    all.remove(txn, key);
                }
            }
            Ok(true)
        })
    }

    /// Une préférence, si elle est posée.
    pub fn pref(&self, key: &str) -> Option<String> {
        let t = self.read_txn();
        let Some(Out::YMap(all)) = self.meta_ref().get(&t, "prefs") else {
            return None;
        };
        match all.get(&t, key) {
            Some(Out::Any(Any::String(s))) => Some(s.to_string()),
            _ => None,
        }
    }

    /// Toutes les préférences posées, triées par clé.
    pub fn prefs(&self) -> Vec<(String, String)> {
        let t = self.read_txn();
        let Some(Out::YMap(all)) = self.meta_ref().get(&t, "prefs") else {
            return Vec::new();
        };
        let mut v: Vec<(String, String)> = all
            .iter(&t)
            .filter_map(|(k, v)| match v {
                Out::Any(Any::String(s)) => Some((k.to_string(), s.to_string())),
                _ => None,
            })
            .collect();
        v.sort();
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notebook::Env;

    struct E(f64, u128);
    impl Env for E {
        fn now_ms(&mut self) -> f64 {
            self.0 += 1.0;
            self.0
        }
        fn random(&mut self) -> u128 {
            self.1 = self
                .1
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            self.1
        }
    }
    fn nb(client: u64) -> Notebook {
        Notebook::new(client, Box::new(E(1_000.0, client as u128 * 977)))
    }

    #[test]
    fn poser_lire_retirer() {
        let mut n = nb(1);
        assert_eq!(n.pref("titres"), None);
        assert!(n.set_pref("titres", Some("banniere")).unwrap());
        assert!(!n.set_pref("titres", Some("banniere")).unwrap(), "inchangé");
        assert_eq!(n.pref("titres").as_deref(), Some("banniere"));
        n.set_pref("theme:2026-11", Some("brume")).unwrap();
        assert_eq!(
            n.prefs(),
            vec![
                ("theme:2026-11".into(), "brume".into()),
                ("titres".into(), "banniere".into())
            ]
        );
        assert!(n.set_pref("titres", None).unwrap());
        assert_eq!(n.pref("titres"), None);
        assert!(!n.set_pref("titres", None).unwrap());
    }

    #[test]
    fn bornes() {
        let mut n = nb(1);
        assert!(n.set_pref("", Some("x")).is_err());
        assert!(n.set_pref("Titres", Some("x")).is_err(), "majuscule");
        assert!(n.set_pref("a b", Some("x")).is_err());
        assert!(n.set_pref(&"k".repeat(65), Some("x")).is_err());
        assert!(n.set_pref("cle", Some(&"é".repeat(2001))).is_err());
        assert!(n.set_pref("cle", Some(&"é".repeat(2000))).is_ok());
        assert!(n.set_pref("suivi:01abc.forme", Some("cercle")).is_ok());
    }

    #[test]
    fn deux_appareils_convergent() {
        let mut a = nb(1);
        let mut b = nb(2);
        a.set_pref("fond", Some("lignes")).unwrap();
        b.set_pref("encre", Some("sepia")).unwrap();
        b.set_pref("fond", Some("carreaux")).unwrap();
        let ua = a.take_updates();
        let ub = b.take_updates();
        for u in &ub {
            a.apply_update(u).unwrap();
        }
        for u in &ua {
            b.apply_update(u).unwrap();
        }
        assert_eq!(a.prefs(), b.prefs());
        assert_eq!(a.pref("encre").as_deref(), Some("sepia"));
        assert!(matches!(
            a.pref("fond").as_deref(),
            Some("lignes") | Some("carreaux")
        ));
    }
}
