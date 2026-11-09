//! Sauvegarde chiffrée par phrase (carnet-sync::vault), pour la coquille web.
//!
//! Module à part : Argon2id et XChaCha20-Poly1305 ne pèsent sur le démarrage de personne, ils ne sont
//! chargés qu'à l'export ou à l'import d'une sauvegarde chiffrée. L'aléa vient de l'hôte
//! (`crypto.getRandomValues`), passé en argument : 40 octets (sel et nonce).

use carnet_sync::keys::Rng;
use carnet_sync::vault;
use wasm_bindgen::prelude::*;

struct Given<'a>(&'a [u8], usize);
impl Rng for Given<'_> {
    fn fill(&mut self, out: &mut [u8]) {
        for b in out {
            *b = self.0[self.1 % self.0.len()];
            self.1 += 1;
        }
    }
}

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

/// Chiffre une sauvegarde `.carnet` (zip) avec une phrase. `random` : au moins 40 octets aléatoires.
#[wasm_bindgen(js_name = sealBackup)]
pub fn seal_backup(zip: &[u8], phrase: &str, random: &[u8]) -> Result<Vec<u8>, JsError> {
    if random.len() < 40 {
        return Err(err("aléa insuffisant"));
    }
    vault::seal_p1(zip, phrase, &mut Given(random, 0)).map_err(err)
}

/// Déchiffre ; erreur « phrase secrète … incorrecte » si la phrase est fausse ou le fichier abîmé.
#[wasm_bindgen(js_name = openBackup)]
pub fn open_backup(bytes: &[u8], phrase: &str) -> Result<Vec<u8>, JsError> {
    vault::open(bytes, phrase).map_err(err)
}

#[wasm_bindgen(js_name = isSealed)]
pub fn is_sealed(bytes: &[u8]) -> bool {
    vault::is_sealed(bytes)
}

/// Force estimée d'une phrase, en bits (garde-fou : Carnet refuse sous 60).
#[wasm_bindgen(js_name = phraseBits)]
pub fn phrase_bits(p: &str) -> f64 {
    carnet_sync::keys::phrase_bits(p)
}
