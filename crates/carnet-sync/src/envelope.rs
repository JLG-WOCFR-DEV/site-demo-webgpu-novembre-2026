//! Enveloppe (§ 4) : XChaCha20-Poly1305, nonce aléatoire, AAD reconstruite depuis l'emplacement lu.

use crate::codec::{pad, unpad};
use crate::keys::{Id, Rng, RootKey};
use crate::Error;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};

pub const FORMAT: u8 = 1;
pub const HEADER: usize = 33;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Kind {
    Entry = 1,
    Snapshot = 2,
    Media = 3,
    Keybox = 4,
    /// Fiche d'un instantané : ce qu'il couvre, son schéma, l'empreinte de son corps (§ 6.1).
    SnapMeta = 5,
    /// Sauvegarde `.carnet` chiffrée par phrase (vault.rs).
    Backup = 6,
}

/// Contexte d'une entrée ou d'un instantané : `st (16) ‖ numéro (u64)`.
pub fn ctx_stream(st: &Id, n: u64) -> Vec<u8> {
    let mut c = st.to_vec();
    c.extend_from_slice(&n.to_le_bytes());
    c
}

fn header(kind: Kind, version: u32, nonce: &[u8; 24]) -> [u8; HEADER] {
    let mut h = [0u8; HEADER];
    h[..3].copy_from_slice(b"CNV");
    h[3] = FORMAT;
    h[4] = kind as u8;
    h[5..9].copy_from_slice(&version.to_le_bytes());
    h[9..33].copy_from_slice(nonce);
    h
}

fn aad(h: &[u8], nb: &Id, ctx: &[u8]) -> Vec<u8> {
    let mut a = h[..HEADER].to_vec();
    a.extend_from_slice(nb);
    a.extend_from_slice(ctx);
    a
}

/// Chiffre `plain` tel quel sous `key` (32 octets).
pub fn seal_raw(
    key: &[u8; 32],
    kind: Kind,
    version: u32,
    nb: &Id,
    ctx: &[u8],
    plain: &[u8],
    rng: &mut dyn Rng,
) -> Vec<u8> {
    let mut nonce = [0u8; 24];
    rng.fill(&mut nonce);
    let h = header(kind, version, &nonce);
    let ct = XChaCha20Poly1305::new(key.into())
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: plain,
                aad: &aad(&h, nb, ctx),
            },
        )
        .expect("chiffrement");
    let mut out = h.to_vec();
    out.extend_from_slice(&ct);
    out
}

/// En-tête lu : nature et version de clé (pour choisir la clé avant de déchiffrer).
pub fn peek(env: &[u8]) -> Result<(Kind, u32), Error> {
    if env.len() < HEADER + 16 || &env[..3] != b"CNV" {
        return Err(Error::Format("ce n'est pas une enveloppe Carnet"));
    }
    if env[3] != FORMAT {
        return Err(Error::Unsupported("format d'enveloppe inconnu"));
    }
    let kind = match env[4] {
        1 => Kind::Entry,
        2 => Kind::Snapshot,
        3 => Kind::Media,
        4 => Kind::Keybox,
        5 => Kind::SnapMeta,
        6 => Kind::Backup,
        _ => return Err(Error::Unsupported("nature d'enveloppe inconnue")),
    };
    Ok((kind, u32::from_le_bytes(env[5..9].try_into().unwrap())))
}

/// Déchiffre ; `kind` et `ctx` sont ceux que le lecteur attend à cet emplacement.
pub fn open_raw(
    key: &[u8; 32],
    kind: Kind,
    nb: &Id,
    ctx: &[u8],
    env: &[u8],
) -> Result<Vec<u8>, Error> {
    let (k, _) = peek(env)?;
    if k != kind {
        return Err(Error::Decrypt);
    }
    XChaCha20Poly1305::new(key.into())
        .decrypt(
            XNonce::from_slice(&env[9..33]),
            Payload {
                msg: &env[HEADER..],
                aad: &aad(env, nb, ctx),
            },
        )
        .map_err(|_| Error::Decrypt)
}

/// Chiffre une charge du carnet (entrée, instantané, média) : clé de données, remplissage par paliers.
pub fn seal(
    key: &RootKey,
    kind: Kind,
    nb: &Id,
    ctx: &[u8],
    payload: &[u8],
    rng: &mut dyn Rng,
) -> Vec<u8> {
    seal_raw(key.data(), kind, key.version, nb, ctx, &pad(payload), rng)
}

/// Déchiffre avec la bonne version du trousseau.
pub fn open(
    keys: &[RootKey],
    kind: Kind,
    nb: &Id,
    ctx: &[u8],
    env: &[u8],
) -> Result<Vec<u8>, Error> {
    let (_, v) = peek(env)?;
    let key = keys
        .iter()
        .find(|k| k.version == v)
        .ok_or(Error::Unsupported(
            "version de clé inconnue (rotation non reçue ?)",
        ))?;
    unpad(open_raw(key.data(), kind, nb, ctx, env)?)
}
