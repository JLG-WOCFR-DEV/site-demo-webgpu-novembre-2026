//! Encodages sans secret : paliers de taille (§ 4.3), charge d'une entrée (§ 5.1), base32 de Crockford (§ 3.3).

use crate::Error;
use std::collections::BTreeMap;

/* ───── Paliers de taille ───── */

/// Taille du texte clair après remplissage : 256 o, puis × 2 jusqu'à 64 Kio, puis multiples de 64 Kio.
pub fn bucket(len: usize) -> usize {
    const BIG: usize = 64 * 1024;
    if len > BIG {
        return len.div_ceil(BIG) * BIG;
    }
    let mut b = 256;
    while b < len {
        b *= 2;
    }
    b
}

/// `longueur (u32) ‖ charge ‖ zéros jusqu'au palier`.
pub fn pad(payload: &[u8]) -> Vec<u8> {
    let n = 4 + payload.len();
    let mut out = Vec::with_capacity(bucket(n));
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(payload);
    out.resize(bucket(n), 0);
    out
}

/// L'inverse de [`pad`] ; le remplissage doit être nul et la taille un palier exact.
pub fn unpad(mut plain: Vec<u8>) -> Result<Vec<u8>, Error> {
    if plain.len() < 4 {
        return Err(Error::Format("texte clair trop court"));
    }
    let n = u32::from_le_bytes(plain[..4].try_into().unwrap()) as usize;
    if 4 + n > plain.len() || plain.len() != bucket(4 + n) || plain[4 + n..].iter().any(|&b| b != 0)
    {
        return Err(Error::Format("remplissage invalide"));
    }
    plain.truncate(4 + n);
    plain.drain(..4);
    Ok(plain)
}

/* ───── Charge d'une entrée ───── */

pub const BATCH_FORMAT: u8 = 1;

/// `{ flux → dernier numéro }` (curseurs, couverture d'un instantané, ce qu'un écrivain avait vu).
pub type Covers = BTreeMap<[u8; 16], u64>;

/// Mises à jour d'un lot : `(clé du document, mise à jour yrs v1)`, clés uniques, dans l'ordre.
pub type Docs = Vec<(String, Vec<u8>)>;

/// Une entrée déchiffrée : ce que son auteur avait vu (`seen`, révèle les flux retenus) et ses mises à jour.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Batch {
    pub seen: Covers,
    pub docs: Docs,
}

pub fn encode_covers(o: &mut Vec<u8>, c: &Covers) {
    o.extend_from_slice(&(c.len() as u32).to_le_bytes());
    for (st, n) in c {
        o.extend_from_slice(st);
        o.extend_from_slice(&n.to_le_bytes());
    }
}
pub fn decode_covers(r: &mut Reader) -> Result<Covers, Error> {
    let mut c = Covers::new();
    for _ in 0..r.u32()? {
        let st: [u8; 16] = r.take(16)?.try_into().unwrap();
        c.insert(st, r.u64()?);
    }
    Ok(c)
}
pub fn encode_docs(o: &mut Vec<u8>, d: &Docs) {
    o.extend_from_slice(&(d.len() as u32).to_le_bytes());
    for (k, u) in d {
        o.extend_from_slice(&(k.len() as u16).to_le_bytes());
        o.extend_from_slice(k.as_bytes());
        o.extend_from_slice(&(u.len() as u32).to_le_bytes());
        o.extend_from_slice(u);
    }
}
pub fn decode_docs(r: &mut Reader) -> Result<Docs, Error> {
    let n = r.u32()? as usize;
    let mut out = Vec::with_capacity(n.min(1024));
    for _ in 0..n {
        let kl = r.u16()? as usize;
        let k = String::from_utf8(r.take(kl)?.to_vec())
            .map_err(|_| Error::Format("clé de document"))?;
        let ul = r.u32()? as usize;
        out.push((k, r.take(ul)?.to_vec()));
    }
    Ok(out)
}

/// `format (u8) ‖ seen ‖ docs` ; entiers petit-boutistes, `seen` = n (u32) × (flux 16 o ‖ numéro u64),
/// `docs` = n (u32) × (longueur u16 ‖ clé UTF-8 ‖ longueur u32 ‖ mise à jour).
pub fn encode_batch(b: &Batch) -> Vec<u8> {
    let mut out = vec![BATCH_FORMAT];
    encode_covers(&mut out, &b.seen);
    encode_docs(&mut out, &b.docs);
    out
}

pub fn decode_batch(bytes: &[u8]) -> Result<Batch, Error> {
    let mut r = Reader(bytes);
    if r.u8()? != BATCH_FORMAT {
        return Err(Error::Unsupported("format de lot inconnu"));
    }
    let seen = decode_covers(&mut r)?;
    let docs = decode_docs(&mut r)?;
    if !r.0.is_empty() {
        return Err(Error::Format("octets en trop dans le lot"));
    }
    Ok(Batch { seen, docs })
}

pub struct Reader<'a>(pub &'a [u8]);
impl<'a> Reader<'a> {
    pub fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
        if self.0.len() < n {
            return Err(Error::Format("données tronquées"));
        }
        let (a, b) = self.0.split_at(n);
        self.0 = b;
        Ok(a)
    }
    pub fn u8(&mut self) -> Result<u8, Error> {
        Ok(self.take(1)?[0])
    }
    pub fn u16(&mut self) -> Result<u16, Error> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }
    pub fn u32(&mut self) -> Result<u32, Error> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    pub fn u64(&mut self) -> Result<u64, Error> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
}

/* ───── Base32 de Crockford ───── */

const ALPHA: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

pub fn base32(bytes: &[u8]) -> String {
    let mut out = String::new();
    let (mut acc, mut bits) = (0u32, 0u32);
    for &b in bytes {
        acc = (acc << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHA[((acc >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(ALPHA[((acc << (5 - bits)) & 31) as usize] as char);
    }
    out
}

/// Tolère minuscules, espaces, tirets, et les confusions de lecture (O → 0, I et L → 1).
pub fn unbase32(s: &str, len: usize) -> Result<Vec<u8>, Error> {
    let mut out = Vec::with_capacity(len);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.chars().filter(|c| !c.is_whitespace() && *c != '-') {
        let c = match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            c => c,
        };
        let v = ALPHA
            .iter()
            .position(|&a| a as char == c)
            .ok_or(Error::Format("caractère hors base32"))? as u32;
        acc = (acc << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    if out.len() != len {
        return Err(Error::Format("longueur inattendue"));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paliers() {
        assert_eq!(bucket(1), 256);
        assert_eq!(bucket(256), 256);
        assert_eq!(bucket(257), 512);
        assert_eq!(bucket(65536), 65536);
        assert_eq!(bucket(65537), 131072);
        for n in [0, 1, 251, 252, 253, 5000, 70000] {
            let p = vec![7u8; n];
            let padded = pad(&p);
            assert_eq!(padded.len(), bucket(4 + n));
            assert_eq!(unpad(padded).unwrap(), p);
        }
        let mut bad = pad(b"abc");
        *bad.last_mut().unwrap() = 1;
        assert!(unpad(bad).is_err());
    }

    #[test]
    fn lots() {
        let b = Batch {
            seen: [([1u8; 16], 4u64)].into_iter().collect(),
            docs: vec![
                ("notebook".into(), vec![1, 2, 3]),
                ("day:2026-11-08".into(), vec![]),
            ],
        };
        assert_eq!(decode_batch(&encode_batch(&b)).unwrap(), b);
        let mut e = encode_batch(&b);
        e.push(0);
        assert!(decode_batch(&e).is_err());
    }

    #[test]
    fn crockford() {
        let k: Vec<u8> = (0..32).collect();
        let s = base32(&k);
        assert_eq!(s.len(), 52);
        assert_eq!(
            unbase32(&s.to_lowercase().replace('0', "o"), 32).unwrap(),
            k
        );
        assert!(unbase32("U", 1).is_err());
    }
}
