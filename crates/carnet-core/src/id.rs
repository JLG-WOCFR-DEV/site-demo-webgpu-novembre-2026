//! ULID : 48 bits d'horodatage (ms) + 80 bits d'aléa, en base32 de Crockford (26 caractères).
//! Le core ne tire pas son aléa lui-même : l'hôte le fournit (`Env::random`).

const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Ulid(pub u128);

impl Ulid {
    pub fn new(ms: u64, random: u128) -> Ulid {
        Ulid(((ms as u128 & 0xFFFF_FFFF_FFFF) << 80) | (random & ((1u128 << 80) - 1)))
    }
}

impl std::fmt::Display for Ulid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut out = [0u8; 26];
        let mut v = self.0;
        for c in out.iter_mut().rev() {
            *c = ALPHABET[(v & 31) as usize];
            v >>= 5;
        }
        f.write_str(std::str::from_utf8(&out).expect("ASCII"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_by_time_then_random() {
        let a = Ulid::new(1_700_000_000_000, 5).to_string();
        let b = Ulid::new(1_700_000_000_001, 0).to_string();
        assert_eq!(a.len(), 26);
        assert!(a < b);
        assert_eq!(Ulid::new(0, 0).to_string(), "00000000000000000000000000");
    }
}
