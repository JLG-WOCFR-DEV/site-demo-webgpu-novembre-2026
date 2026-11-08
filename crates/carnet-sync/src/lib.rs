//! Carnet — synchro chiffrée de bout en bout entre les appareils d'une personne (docs/carnet/sync.md).
//!
//! Sans entrées-sorties : la crate ne parle à aucun réseau. Elle dit quoi écrire et quoi lire, et
//! interprète ce qu'on lui rend ; l'hôte (le navigateur, un test) fait les requêtes. Le même code sert
//! donc au relais, à un stockage de fichiers, aux tests déterministes.

pub mod codec;
pub mod device;
pub mod envelope;
pub mod keys;
pub mod store;

/// Ce qui peut mal tourner, en mots.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// Données mal formées (avant tout déchiffrement).
    Format(&'static str),
    /// Format, version ou profil inconnu : mettre Carnet à jour.
    Unsupported(&'static str),
    /// Le déchiffrement a échoué : mauvaise clé, enveloppe modifiée ou déplacée.
    Decrypt,
    /// Phrase secrète ou clé de récupération fausse.
    WrongSecret,
    /// Paramètres de dérivation refusés (mémoire, par exemple).
    Kdf(String),
    /// Le core a refusé une mise à jour.
    Core(String),
    /// Enveloppe sous une ancienne clé, au-delà de la borne figée par la rotation (appareil retiré).
    Stale,
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Format(s) => write!(f, "synchro : données mal formées ({s})"),
            Error::Unsupported(s) => write!(f, "synchro : {s}, mets Carnet à jour"),
            Error::Decrypt => write!(
                f,
                "synchro : une enveloppe ne se déchiffre pas (modifiée, déplacée ou mauvaise clé)"
            ),
            Error::WrongSecret => write!(f, "phrase secrète ou clé de récupération incorrecte"),
            Error::Kdf(s) => write!(f, "dérivation de clé impossible : {s}"),
            Error::Core(s) => write!(f, "synchro : {s}"),
            Error::Stale => write!(f, "synchro : écrit sous une clé retirée, ignoré"),
        }
    }
}

impl std::error::Error for Error {}
