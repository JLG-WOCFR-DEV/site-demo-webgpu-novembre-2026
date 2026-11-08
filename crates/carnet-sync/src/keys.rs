//! Clés (§ 3) : clé racine du carnet, sous-clés dérivées, coffre, clé de récupération, rotation.

use crate::codec::{base32, unbase32, Reader};
use crate::envelope::{self, Kind};
use crate::Error;
use argon2::{Algorithm, Argon2, Params, Version};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Identifiant aléatoire de 128 bits (carnet, flux).
pub type Id = [u8; 16];

/// Source d'aléa, fournie par l'hôte (crypto.getRandomValues dans le navigateur, graine dans les tests).
pub trait Rng {
    fn fill(&mut self, out: &mut [u8]);
}

fn hkdf(ikm: &[u8], salt: &[u8], info: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    Hkdf::<Sha256>::new(Some(salt), ikm)
        .expand(info.as_bytes(), &mut out)
        .expect("32 octets");
    out
}

/// Une version de la clé racine, et ce qui en dérive (§ 3.1).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct RootKey {
    #[zeroize(skip)]
    pub version: u32,
    bytes: [u8; 32],
    data: [u8; 32],
    name: [u8; 32],
    auth: [u8; 32],
}

impl RootKey {
    pub fn from_bytes(nb: &Id, version: u32, bytes: [u8; 32]) -> RootKey {
        RootKey {
            version,
            data: hkdf(&bytes, nb, "carnet/v1/data"),
            name: hkdf(&bytes, nb, "carnet/v1/name"),
            auth: hkdf(&bytes, nb, "carnet/v1/auth"),
            bytes,
        }
    }
    pub fn generate(nb: &Id, version: u32, rng: &mut dyn Rng) -> RootKey {
        let mut b = [0u8; 32];
        rng.fill(&mut b);
        RootKey::from_bytes(nb, version, b)
    }
    pub fn bytes(&self) -> &[u8; 32] {
        &self.bytes
    }
    pub(crate) fn data(&self) -> &[u8; 32] {
        &self.data
    }
    /// Jeton du relais (§ 8.3) et son empreinte, que le relais garde.
    pub fn relay_token(&self) -> [u8; 32] {
        hkdf(&self.auth, b"", "carnet/v1/relay-token")
    }
    pub fn relay_verifier(&self) -> [u8; 32] {
        Sha256::digest(self.relay_token()).into()
    }
}

/// Identifiant opaque d'un média (§ 7) : `HMAC-SHA256(K_name de la **première** version, "media:" ‖ sha256 brut)[0..16]`.
/// La première version ne tourne jamais : une rotation ne change pas les noms des photos déjà envoyées.
pub fn media_id(keys: &[RootKey], sha256: &[u8; 32]) -> Id {
    let first = keys
        .iter()
        .min_by_key(|k| k.version)
        .expect("trousseau non vide");
    let mut m = Hmac::<Sha256>::new_from_slice(&first.name).expect("clé HMAC");
    m.update(b"media:");
    m.update(sha256);
    m.finalize().into_bytes()[..16].try_into().unwrap()
}

/// Code du carnet, pour la feuille de récupération et pour rejoindre : 26 caractères base32.
pub fn notebook_code(nb: &Id) -> String {
    base32(nb)
}
pub fn notebook_from_code(s: &str) -> Result<Id, Error> {
    Ok(unbase32(s, 16)?.try_into().unwrap())
}

/// Jeton d'administration du relais (changer le vérificateur, § 8.3) : dérivé de la clé de récupération,
/// qu'aucun appareil ne garde. Un appareil volé ne peut donc pas exclure son propriétaire.
pub fn admin_token(nb: &Id, recovery: &[u8; 32]) -> [u8; 32] {
    hkdf(recovery, nb, "carnet/v1/admin")
}

/* ───── Profil Argon2id (§ 3.2) ───── */

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KdfProfile {
    pub id: u8,
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
}

/// Le seul profil des vrais coffres (un appareil incapable de le calculer rejoint par appairage, § 9).
pub const KDF_P1: KdfProfile = KdfProfile {
    id: 1,
    m_kib: 64 * 1024,
    t: 3,
    p: 1,
};
/// Pour les tests seulement : rapide, refusé à l'ouverture d'un coffre hors tests.
pub const KDF_TEST: KdfProfile = KdfProfile {
    id: 255,
    m_kib: 8,
    t: 1,
    p: 1,
};

impl KdfProfile {
    pub fn by_id(id: u8) -> Result<KdfProfile, Error> {
        match id {
            1 => Ok(KDF_P1),
            255 => Ok(KDF_TEST),
            _ => Err(Error::Unsupported("profil de dérivation inconnu")),
        }
    }
}

/// Phrase → (clé qui protège la clé du carnet, jeton de lecture du coffre). Une seule passe d'Argon2id.
pub fn derive_phrase(
    kdf: KdfProfile,
    phrase: &str,
    salt: &[u8; 16],
) -> Result<([u8; 32], [u8; 32]), Error> {
    let params =
        Params::new(kdf.m_kib, kdf.t, kdf.p, Some(32)).map_err(|e| Error::Kdf(e.to_string()))?;
    let mut a = [0u8; 32];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(&norm_phrase(phrase), salt, &mut a)
        .map_err(|e| Error::Kdf(e.to_string()))?;
    let out = (
        hkdf(&a, salt, "carnet/v1/kek-pass"),
        hkdf(&a, salt, "carnet/v1/keybox-token"),
    );
    a.zeroize();
    Ok(out)
}

/// Espaces de bord retirés, espaces internes réduits à un. (La phrase proposée par Carnet est en
/// minuscules ASCII ; une phrase choisie est prise telle quelle, accents compris.)
fn norm_phrase(p: &str) -> Vec<u8> {
    p.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .into_bytes()
}

/// Force estimée d'une phrase (bits), volontairement grossière : un garde-fou, pas une mesure. Quatre mots
/// ou plus de 3 lettres comptent comme des mots d'une liste de 7 776 (12,9 bits) ; sinon 2 bits par caractère.
/// Carnet refuse en dessous de 60 et propose par défaut 6 mots tirés au hasard (≈ 77 bits).
pub fn phrase_bits(p: &str) -> f64 {
    let words: Vec<&str> = p.split_whitespace().collect();
    let chars = p.chars().filter(|c| !c.is_whitespace()).count() as f64;
    let by_words = if words.len() >= 4 && words.iter().all(|w| w.chars().count() >= 3) {
        words.len() as f64 * 12.9
    } else {
        0.0
    };
    by_words.max(chars * 2.0)
}

/* ───── Clé de récupération (§ 3.3) ───── */

/// 32 octets en base32 de Crockford (52 caractères, les 4 bits de fin à zéro), puis 4 caractères de contrôle
/// (les 20 premiers bits de SHA-256(clé)), en 14 groupes de 4 séparés par des tirets.
pub fn recovery_display(key: &[u8; 32]) -> String {
    let body = base32(key);
    let check = &base32(&Sha256::digest(key)[..3])[..4];
    let all = format!("{body}{check}");
    all.as_bytes()
        .chunks(4)
        .map(|c| std::str::from_utf8(c).unwrap())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn recovery_parse(s: &str) -> Result<[u8; 32], Error> {
    let clean: String = s
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            c => c,
        })
        .collect();
    if clean.len() != 56 {
        return Err(Error::Format("une clé de récupération a 56 caractères"));
    }
    let key: [u8; 32] = unbase32(&clean[..52], 32)?.try_into().unwrap();
    // Recalculer l'affichage vérifie à la fois le contrôle et les bits de fin.
    if recovery_display(&key).replace('-', "") != clean {
        return Err(Error::Format(
            "clé de récupération mal recopiée (contrôle faux)",
        ));
    }
    Ok(key)
}

/* ───── Coffre (§ 3.2) ───── */

/// Une version de la clé, protégée de deux façons. Après une rotation, les anciennes versions ne gardent
/// que `wrapped_prev` (le trousseau) : leurs protections par phrase et récupération sont effacées.
#[derive(Clone, Debug, PartialEq)]
pub struct KeyboxVersion {
    pub version: u32,
    pub wrapped_pass: Vec<u8>,
    pub wrapped_recovery: Vec<u8>,
    /// La version précédente, chiffrée par celle-ci ; vide pour la première.
    pub wrapped_prev: Vec<u8>,
}

/// Le coffre. Il se réécrit en **nouvel objet** (`keybox/<gen>`, création seule) : le plus grand `gen` gagne.
#[derive(Clone, Debug, PartialEq)]
pub struct Keybox {
    pub nb: Id,
    pub gen: u64,
    /// Profil et sel de la phrase courante : publics (`keyparams/<gen>`), il faut les lire avant d'avoir un jeton.
    pub kdf: u8,
    pub salt: [u8; 16],
    pub versions: Vec<KeyboxVersion>,
}

pub const KEYBOX_FORMAT: u8 = 1;

fn kek_recovery(nb: &Id, recovery: &[u8; 32]) -> [u8; 32] {
    hkdf(recovery, nb, "carnet/v1/recovery")
}

/// Contexte d'une clé enveloppée : son usage, sa version, la génération du coffre (§ 4.1, nature 4).
fn wrap_ctx(what: u8, version: u32) -> Vec<u8> {
    let mut c = vec![what];
    c.extend_from_slice(&version.to_le_bytes());
    c
}
const W_PASS: u8 = 1;
const W_RECOVERY: u8 = 2;
const W_PREV: u8 = 3;

/// Ce qu'un appareil obtient en ouvrant le coffre.
pub struct Opened {
    /// Trousseau, version courante d'abord.
    pub keys: Vec<RootKey>,
}

impl Keybox {
    /// Un carnet neuf : sa clé, son coffre, sa clé de récupération, le jeton de lecture du coffre.
    pub fn create(
        nb: Id,
        phrase: &str,
        kdf: KdfProfile,
        rng: &mut dyn Rng,
    ) -> Result<(Keybox, RootKey, [u8; 32], [u8; 32]), Error> {
        let root = RootKey::generate(&nb, 1, rng);
        let mut recovery = [0u8; 32];
        rng.fill(&mut recovery);
        let mut kb = Keybox {
            nb,
            gen: 1,
            kdf: kdf.id,
            salt: [0; 16],
            versions: Vec::new(),
        };
        let token = kb.seal_current(&root, None, phrase, &recovery, kdf, rng)?;
        Ok((kb, root, recovery, token))
    }

    /// (Ré)écrit la protection de la version courante : nouveau sel à chaque fois. Rend le jeton du coffre.
    fn seal_current(
        &mut self,
        root: &RootKey,
        prev: Option<&RootKey>,
        phrase: &str,
        recovery: &[u8; 32],
        kdf: KdfProfile,
        rng: &mut dyn Rng,
    ) -> Result<[u8; 32], Error> {
        rng.fill(&mut self.salt);
        self.kdf = kdf.id;
        let (kp, token) = derive_phrase(kdf, phrase, &self.salt)?;
        let kr = kek_recovery(&self.nb, recovery);
        let nb = self.nb;
        let v = KeyboxVersion {
            version: root.version,
            wrapped_pass: envelope::seal_raw(
                &kp,
                Kind::Keybox,
                root.version,
                &nb,
                &wrap_ctx(W_PASS, root.version),
                root.bytes(),
                rng,
            ),
            wrapped_recovery: envelope::seal_raw(
                &kr,
                Kind::Keybox,
                root.version,
                &nb,
                &wrap_ctx(W_RECOVERY, root.version),
                root.bytes(),
                rng,
            ),
            wrapped_prev: match prev {
                Some(p) => envelope::seal_raw(
                    root.bytes(),
                    Kind::Keybox,
                    root.version,
                    &nb,
                    &wrap_ctx(W_PREV, p.version),
                    p.bytes(),
                    rng,
                ),
                None => self
                    .versions
                    .iter()
                    .find(|x| x.version == root.version)
                    .map(|x| x.wrapped_prev.clone())
                    .unwrap_or_default(),
            },
        };
        match self.versions.iter_mut().find(|x| x.version == root.version) {
            Some(x) => *x = v,
            None => self.versions.push(v),
        }
        Ok(token)
    }

    /// Jeton de lecture du coffre pour une phrase (le relais garde son empreinte, § 8.3).
    pub fn phrase_token(&self, phrase: &str) -> Result<[u8; 32], Error> {
        Ok(derive_phrase(KdfProfile::by_id(self.kdf)?, phrase, &self.salt)?.1)
    }

    fn current(&self) -> Result<&KeyboxVersion, Error> {
        self.versions.last().ok_or(Error::Format("coffre vide"))
    }

    /// Ouvre le coffre : toutes les versions de la clé, de la plus récente à la plus ancienne.
    pub fn open_with_phrase(&self, phrase: &str) -> Result<Opened, Error> {
        let cur = self.current()?;
        let (kp, _) = derive_phrase(KdfProfile::by_id(self.kdf)?, phrase, &self.salt)?;
        let bytes = envelope::open_raw(
            &kp,
            Kind::Keybox,
            &self.nb,
            &wrap_ctx(W_PASS, cur.version),
            &cur.wrapped_pass,
        )
        .map_err(|_| Error::WrongSecret)?;
        self.chain(bytes)
    }
    pub fn open_with_recovery(&self, recovery: &[u8; 32]) -> Result<Opened, Error> {
        let cur = self.current()?;
        let kr = kek_recovery(&self.nb, recovery);
        let bytes = envelope::open_raw(
            &kr,
            Kind::Keybox,
            &self.nb,
            &wrap_ctx(W_RECOVERY, cur.version),
            &cur.wrapped_recovery,
        )
        .map_err(|_| Error::WrongSecret)?;
        self.chain(bytes)
    }

    /// Descend le trousseau depuis la version courante.
    fn chain(&self, current: Vec<u8>) -> Result<Opened, Error> {
        let mut keys = Vec::new();
        let mut bytes: [u8; 32] = current
            .try_into()
            .map_err(|_| Error::Format("clé de 32 octets"))?;
        for (i, v) in self.versions.iter().enumerate().rev() {
            keys.push(RootKey::from_bytes(&self.nb, v.version, bytes));
            if i == 0 {
                break;
            }
            let prev = &self.versions[i - 1];
            let b = envelope::open_raw(
                &bytes,
                Kind::Keybox,
                &self.nb,
                &wrap_ctx(W_PREV, prev.version),
                &v.wrapped_prev,
            )?;
            bytes = b
                .try_into()
                .map_err(|_| Error::Format("clé de 32 octets"))?;
        }
        Ok(Opened { keys })
    }

    /// Nouvelle phrase pour la version courante ; la clé ne change pas. Demande la clé de récupération
    /// (aucun appareil ne la garde). Rend le nouveau jeton du coffre.
    pub fn change_phrase(
        &mut self,
        keys: &[RootKey],
        phrase: &str,
        recovery: &[u8; 32],
        rng: &mut dyn Rng,
    ) -> Result<[u8; 32], Error> {
        let cur = keys.first().ok_or(Error::Format("trousseau vide"))?;
        self.open_with_recovery(recovery)?;
        self.gen += 1;
        self.seal_current(
            cur,
            None,
            phrase,
            recovery,
            KdfProfile::by_id(self.kdf)?,
            rng,
        )
    }

    /// Rotation (§ 3.4) : une nouvelle clé, qui garde l'accès aux anciennes. Nouvelle phrase obligatoire
    /// (l'appareil retiré connaissait l'ancienne) ; la clé de récupération est redemandée, ou renouvelée
    /// (`new_recovery`). Les protections des anciennes versions sont effacées. Rend le trousseau et le jeton.
    pub fn rotate(
        &mut self,
        keys: &[RootKey],
        phrase: &str,
        recovery: &[u8; 32],
        new_recovery: Option<&[u8; 32]>,
        rng: &mut dyn Rng,
    ) -> Result<(Vec<RootKey>, [u8; 32]), Error> {
        let cur = keys.first().ok_or(Error::Format("trousseau vide"))?;
        self.open_with_recovery(recovery)?;
        let next = RootKey::generate(&self.nb, cur.version + 1, rng);
        for v in &mut self.versions {
            v.wrapped_pass.clear();
            v.wrapped_recovery.clear();
        }
        self.gen += 1;
        let token = self.seal_current(
            &next,
            Some(cur),
            phrase,
            new_recovery.unwrap_or(recovery),
            kdf_or_p1(self.kdf),
            rng,
        )?;
        let mut all = vec![next];
        all.extend(keys.iter().cloned());
        Ok((all, token))
    }

    /// Partie publique : profil et sel (`keyparams/<gen>`).
    pub fn encode_params(&self) -> Vec<u8> {
        let mut o = vec![b'C', b'N', b'P', KEYBOX_FORMAT, self.kdf];
        o.extend_from_slice(&self.salt);
        o
    }
    pub fn decode_params(b: &[u8]) -> Result<(u8, [u8; 16]), Error> {
        if b.len() != 21 || &b[..3] != b"CNP" {
            return Err(Error::Format("paramètres de coffre"));
        }
        if b[3] != KEYBOX_FORMAT {
            return Err(Error::Unsupported("format de coffre inconnu"));
        }
        Ok((b[4], b[5..21].try_into().unwrap()))
    }

    /// Format binaire, petit-boutiste : « CNK » ‖ format ‖ nb ‖ gen (u64) ‖ profil ‖ sel ‖ n (u16) ‖
    /// { version (u32) ‖ 3 × (longueur u16 ‖ octets) }.
    pub fn encode(&self) -> Vec<u8> {
        let mut o = vec![b'C', b'N', b'K', KEYBOX_FORMAT];
        o.extend_from_slice(&self.nb);
        o.extend_from_slice(&self.gen.to_le_bytes());
        o.push(self.kdf);
        o.extend_from_slice(&self.salt);
        o.extend_from_slice(&(self.versions.len() as u16).to_le_bytes());
        for v in &self.versions {
            o.extend_from_slice(&v.version.to_le_bytes());
            for w in [&v.wrapped_pass, &v.wrapped_recovery, &v.wrapped_prev] {
                o.extend_from_slice(&(w.len() as u16).to_le_bytes());
                o.extend_from_slice(w);
            }
        }
        o
    }

    pub fn decode(bytes: &[u8]) -> Result<Keybox, Error> {
        let mut r = Reader(bytes);
        if r.take(3)? != b"CNK" {
            return Err(Error::Format("ce n'est pas un coffre Carnet"));
        }
        if r.u8()? != KEYBOX_FORMAT {
            return Err(Error::Unsupported("format de coffre inconnu"));
        }
        let nb: Id = r.take(16)?.try_into().unwrap();
        let gen = r.u64()?;
        let kdf = r.u8()?;
        let salt = r.take(16)?.try_into().unwrap();
        let n = r.u16()? as usize;
        let mut versions = Vec::with_capacity(n);
        for _ in 0..n {
            let version = r.u32()?;
            let mut w = || -> Result<Vec<u8>, Error> {
                let l = r.u16()? as usize;
                Ok(r.take(l)?.to_vec())
            };
            versions.push(KeyboxVersion {
                version,
                wrapped_pass: w()?,
                wrapped_recovery: w()?,
                wrapped_prev: w()?,
            });
        }
        if versions.is_empty() || !r.0.is_empty() {
            return Err(Error::Format("coffre mal formé"));
        }
        Ok(Keybox {
            nb,
            gen,
            kdf,
            salt,
            versions,
        })
    }
}

/// Le profil d'un coffre existant reste le sien (un coffre de test reste de test).
fn kdf_or_p1(id: u8) -> KdfProfile {
    KdfProfile::by_id(id).unwrap_or(KDF_P1)
}
