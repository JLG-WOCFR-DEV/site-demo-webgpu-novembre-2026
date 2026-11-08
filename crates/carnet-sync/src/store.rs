//! Le stockage tel que la synchro le voit (§ 8.1) : cinq opérations sur des chemins.
//!
//! [`MemStore`] le simule en mémoire, avec de quoi le rendre malveillant ou en retard dans les tests.

use std::collections::BTreeMap;

/// Résultat d'une création conditionnelle.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Put {
    Created,
    /// La place est prise : voici ce qui s'y trouve (pour reconnaître un accusé de réception perdu).
    Exists(Vec<u8>),
}

/// Un stockage synchrone (tests, outils). Le navigateur passe par le pilote sans entrées-sorties.
pub trait Store {
    fn put_new(&mut self, path: &str, bytes: &[u8]) -> Put;
    fn get(&self, path: &str) -> Option<Vec<u8>>;
    /// Noms directs sous `prefix` (qui finit par « / »), triés.
    fn list(&self, prefix: &str) -> Vec<String>;
    fn delete(&mut self, path: &str);
    /// Écrase sans condition : seulement pour le coffre (§ 3.2), qui se réécrit.
    fn put(&mut self, path: &str, bytes: &[u8]);
}

#[derive(Default, Clone)]
pub struct MemStore {
    pub files: BTreeMap<String, Vec<u8>>,
}

impl MemStore {
    pub fn new() -> MemStore {
        MemStore::default()
    }
}

impl Store for MemStore {
    fn put_new(&mut self, path: &str, bytes: &[u8]) -> Put {
        match self.files.get(path) {
            Some(b) => Put::Exists(b.clone()),
            None => {
                self.files.insert(path.to_string(), bytes.to_vec());
                Put::Created
            }
        }
    }
    fn get(&self, path: &str) -> Option<Vec<u8>> {
        self.files.get(path).cloned()
    }
    fn list(&self, prefix: &str) -> Vec<String> {
        let mut out: Vec<String> = self
            .files
            .range(prefix.to_string()..)
            .take_while(|(k, _)| k.starts_with(prefix))
            .map(|(k, _)| {
                k[prefix.len()..]
                    .split('/')
                    .next()
                    .unwrap_or("")
                    .to_string()
            })
            .collect();
        out.dedup();
        out
    }
    fn delete(&mut self, path: &str) {
        self.files.remove(path);
    }
    fn put(&mut self, path: &str, bytes: &[u8]) {
        self.files.insert(path.to_string(), bytes.to_vec());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creation_seulement_et_listes() {
        let mut s = MemStore::new();
        assert_eq!(s.put_new("nb/a/log/x/1", b"un"), Put::Created);
        assert_eq!(
            s.put_new("nb/a/log/x/1", b"deux"),
            Put::Exists(b"un".to_vec())
        );
        s.put_new("nb/a/log/x/2", b"");
        s.put_new("nb/a/log/y/1", b"");
        s.put_new("nb/a/logz", b"");
        assert_eq!(s.list("nb/a/log/"), vec!["x", "y"]);
        assert_eq!(s.list("nb/a/log/x/"), vec!["1", "2"]);
        s.delete("nb/a/log/x/1");
        assert_eq!(s.list("nb/a/log/x/"), vec!["2"]);
    }
}
