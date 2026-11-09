//! Sauvegarde chiffrée par phrase (décision D10 : l'export `.carnet` peut partir vers un cloud).
//!
//! Format : `"CNS" ‖ format (1) ‖ profil Argon2id ‖ sel (16) ‖ enveloppe nature 6` (§ 4 de sync.md),
//! clé = `KEK_pass` dérivée de la phrase (mêmes fonctions que le coffre de synchro), contexte = `"sauvegarde"`.
//! Le contenu est la sauvegarde `.carnet` ordinaire (un zip), intacte : ouvrir redonne le fichier d'origine.
//! La taille n'est pas cachée (elle dit à peu près la taille du carnet).

use crate::envelope::{self, Kind};
use crate::keys::{derive_phrase, KdfProfile, Rng, KDF_P1};
use crate::Error;

pub const MAGIC: &[u8; 3] = b"CNS";
pub const FORMAT: u8 = 1;
const CTX: &[u8] = b"sauvegarde";
const NB: [u8; 16] = [0; 16];

/// Le fichier est-il une sauvegarde chiffrée ?
pub fn is_sealed(bytes: &[u8]) -> bool {
    bytes.len() > 21 && &bytes[..3] == MAGIC
}

pub fn seal(
    zip: &[u8],
    phrase: &str,
    kdf: KdfProfile,
    rng: &mut dyn Rng,
) -> Result<Vec<u8>, Error> {
    let mut salt = [0u8; 16];
    rng.fill(&mut salt);
    let (kek, _) = derive_phrase(kdf, phrase, &salt)?;
    let mut out = MAGIC.to_vec();
    out.push(FORMAT);
    out.push(kdf.id);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&envelope::seal_raw(
        &kek,
        Kind::Backup,
        0,
        &NB,
        CTX,
        zip,
        rng,
    ));
    Ok(out)
}

pub fn open(bytes: &[u8], phrase: &str) -> Result<Vec<u8>, Error> {
    if !is_sealed(bytes) {
        return Err(Error::Format("ce n'est pas une sauvegarde chiffrée"));
    }
    if bytes[3] != FORMAT {
        return Err(Error::Unsupported(
            "sauvegarde chiffrée d'une version plus récente",
        ));
    }
    let kdf = KdfProfile::by_id(bytes[4])?;
    let salt: [u8; 16] = bytes[5..21].try_into().unwrap();
    let (kek, _) = derive_phrase(kdf, phrase, &salt)?;
    envelope::open_raw(&kek, Kind::Backup, &NB, CTX, &bytes[21..]).map_err(|_| Error::WrongSecret)
}

/// Le profil des vraies sauvegardes.
pub fn seal_p1(zip: &[u8], phrase: &str, rng: &mut dyn Rng) -> Result<Vec<u8>, Error> {
    seal(zip, phrase, KDF_P1, rng)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::KDF_TEST;

    struct Seq(u8);
    impl Rng for Seq {
        fn fill(&mut self, out: &mut [u8]) {
            for b in out {
                self.0 = self.0.wrapping_mul(31).wrapping_add(7);
                *b = self.0;
            }
        }
    }

    #[test]
    fn aller_retour_mauvaise_phrase_falsification() {
        let zip = b"PK\x03\x04 contenu du carnet".to_vec();
        let s = seal(&zip, "cheval agrafe lune pompe", KDF_TEST, &mut Seq(1)).unwrap();
        assert!(is_sealed(&s));
        assert!(!is_sealed(&zip));
        assert_eq!(open(&s, "  cheval  agrafe lune pompe ").unwrap(), zip);
        assert_eq!(open(&s, "cheval agrafe lune"), Err(Error::WrongSecret));
        let mut t = s.clone();
        let n = t.len() - 3;
        t[n] ^= 1;
        assert_eq!(
            open(&t, "cheval agrafe lune pompe"),
            Err(Error::WrongSecret)
        );
        let mut v = s.clone();
        v[3] = 9;
        assert!(matches!(open(&v, "x"), Err(Error::Unsupported(_))));
    }
}
