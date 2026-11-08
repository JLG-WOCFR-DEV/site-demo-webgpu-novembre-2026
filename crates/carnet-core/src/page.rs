//! Pages graphiques (roadmap § 3.2, P4b) : autocollants et traits posés sur un bloc du carnet.
//!
//! Un document yrs par bloc — `day:AAAA-MM-JJ`, `week:<lundi>` (notes de la semaine),
//! `month:AAAA-MM` (page libre), `cal:AAAA-MM` (calendrier), `collection:<ulid>` — créé au premier
//! autocollant : les traits sont lourds, ils ne chargent pas le carnet ; et le même jour montre les
//! mêmes autocollants en vue semaine et en vue jour.
//!
//! Position : pixels CSS relatifs au coin du bloc, mesurés quand le bloc avait la largeur `w`. À
//! l'affichage, tout est mis à l'échelle `largeur actuelle / w` : le dessin garde ses proportions
//! sur un téléphone comme sur un écran large.
//!
//! Chaque objet est une `Y.Map` (ULID → champs) : déplacer, tourner, agrandir sur deux appareils à la
//! fois fusionne champ par champ ; un trait est immuable une fois posé (ses points en un tampon).

use std::sync::Arc;

use serde::Serialize;
use yrs::updates::decoder::Decode;
use yrs::{
    uuid_v4_from, Any, ClientID, Doc, Map, MapPrelim, MapRef, Options, Out, ReadTxn, StateVector,
    Transact, TransactionMut, Update, WriteTxn,
};

use crate::id::Ulid;
use crate::notebook::{Env, Error};

/// Où un objet est posé dans son bloc.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, serde::Deserialize)]
pub struct Anchor {
    pub x: f64,
    pub y: f64,
    /// Largeur du bloc au moment de la pose (px CSS).
    pub w: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum Item {
    #[serde(rename_all = "camelCase")]
    Sticker {
        id: String,
        /// Identifiant du dessin dans le catalogue (`saison/feuille`…).
        sticker: String,
        /// Palette de saison au moment de la pose (`printemps`, `ete`, `automne`, `hiver`).
        tint: String,
        anchor: Anchor,
        /// Rotation en degrés, taille relative (1 : taille du catalogue).
        rot: f64,
        scale: f64,
        created_at: f64,
        z: f64,
    },
    /// Photo collée : le fichier vit à part (OPFS, adressé par son SHA-256), la page n'a que la référence.
    #[serde(rename_all = "camelCase")]
    Photo {
        id: String,
        sha: String,
        /// Largeur / hauteur de l'image.
        ratio: f64,
        /// Date approximative (pas de date de prise de vue lisible) : on le dit.
        approx: bool,
        anchor: Anchor,
        rot: f64,
        scale: f64,
        created_at: f64,
        z: f64,
    },
    #[serde(rename_all = "camelCase")]
    Stroke {
        id: String,
        tool: String,
        color: String,
        /// Épaisseur de base (px CSS à la largeur de référence).
        width: f64,
        anchor: Anchor,
        /// Points (x, y, pression) relatifs à l'ancre, à plat.
        points: Vec<f32>,
        created_at: f64,
        z: f64,
    },
}

impl Item {
    pub fn id(&self) -> &str {
        match self {
            Item::Sticker { id, .. } | Item::Photo { id, .. } | Item::Stroke { id, .. } => id,
        }
    }
    fn z(&self) -> f64 {
        match self {
            Item::Sticker { z, .. } | Item::Photo { z, .. } | Item::Stroke { z, .. } => *z,
        }
    }
}

/// Une page graphique : ses objets et la plomberie de mises à jour (comme le carnet).
pub struct Page {
    doc: Doc,
    items: MapRef,
    env: Box<dyn Env>,
    outbox: Vec<Vec<u8>>,
    deferred: Vec<Vec<u8>>,
}

fn num<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> Option<f64> {
    match m.get(t, k) {
        Some(Out::Any(Any::Number(n))) => n.as_f64(),
        _ => None,
    }
}
fn text<T: ReadTxn>(m: &MapRef, t: &T, k: &str) -> Option<String> {
    match m.get(t, k) {
        Some(Out::Any(Any::String(s))) => Some(s.to_string()),
        _ => None,
    }
}

fn read_item<T: ReadTxn>(id: &str, m: &MapRef, t: &T) -> Option<Item> {
    if num(m, t, "deletedAt").is_some() {
        return None;
    }
    let anchor = Anchor {
        x: num(m, t, "x")?,
        y: num(m, t, "y")?,
        w: num(m, t, "w").filter(|w| *w > 0.0)?,
    };
    let created_at = num(m, t, "createdAt").unwrap_or(0.0);
    let z = num(m, t, "z").unwrap_or(created_at);
    match text(m, t, "type")?.as_str() {
        "sticker" => Some(Item::Sticker {
            id: id.to_string(),
            sticker: text(m, t, "sticker")?,
            tint: text(m, t, "tint").unwrap_or_default(),
            anchor,
            rot: num(m, t, "rot").unwrap_or(0.0),
            scale: num(m, t, "scale").unwrap_or(1.0),
            created_at,
            z,
        }),
        "photo" => Some(Item::Photo {
            id: id.to_string(),
            sha: text(m, t, "sha")?,
            ratio: num(m, t, "ratio").filter(|r| *r > 0.0).unwrap_or(1.0),
            approx: matches!(m.get(t, "approx"), Some(Out::Any(Any::Bool(true)))),
            anchor,
            rot: num(m, t, "rot").unwrap_or(0.0),
            scale: num(m, t, "scale").unwrap_or(1.0),
            created_at,
            z,
        }),
        "stroke" => {
            let points = match m.get(t, "points") {
                Some(Out::Any(Any::Buffer(b))) => b
                    .chunks_exact(4)
                    .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect(),
                _ => return None,
            };
            Some(Item::Stroke {
                id: id.to_string(),
                tool: text(m, t, "tool").unwrap_or_else(|| "encre".into()),
                color: text(m, t, "color").unwrap_or_default(),
                width: num(m, t, "width").unwrap_or(2.0),
                anchor,
                points,
                created_at,
                z,
            })
        }
        _ => None,
    }
}

fn check_anchor(a: &Anchor) -> Result<(), Error> {
    if !(a.x.is_finite() && a.y.is_finite() && a.w.is_finite() && a.w > 0.0) {
        return Err(Error::Invalid("position invalide".into()));
    }
    Ok(())
}

impl Page {
    pub fn new(client_id: u64, mut env: Box<dyn Env>) -> Page {
        let o = Options::with_guid_and_client_id(
            uuid_v4_from(env.random()),
            ClientID::new(client_id & ((1 << 53) - 1)),
        );
        let doc = Doc::with_options(o);
        let items = doc.get_or_insert_map("items");
        Page {
            doc,
            items,
            env,
            outbox: Vec::new(),
            deferred: Vec::new(),
        }
    }

    fn write<R>(
        &mut self,
        f: impl FnOnce(&mut TransactionMut, &MapRef) -> Result<R, Error>,
    ) -> Result<R, Error> {
        let items = self.items.clone();
        let mut txn = self.doc.transact_mut();
        let r = f(&mut txn, &items);
        let update = txn.encode_update_v1();
        drop(txn);
        if update.len() > 2 {
            self.outbox.push(update);
        }
        r
    }

    fn item_map<T: ReadTxn>(items: &MapRef, t: &T, id: &str) -> Result<MapRef, Error> {
        match items.get(t, id) {
            Some(Out::YMap(m)) => Ok(m),
            _ => Err(Error::NotFound(id.to_string())),
        }
    }

    fn next_z<T: ReadTxn>(items: &MapRef, t: &T) -> f64 {
        items
            .iter(t)
            .filter_map(|(_, v)| match v {
                Out::YMap(m) => num(&m, t, "z"),
                _ => None,
            })
            .fold(0.0, f64::max)
            + 1.0
    }

    /* ───── Mises à jour (mêmes règles que le carnet) ───── */

    pub fn take_updates(&mut self) -> Vec<Vec<u8>> {
        std::mem::take(&mut self.outbox)
    }

    pub fn apply_update(&mut self, bytes: &[u8]) -> Result<(), Error> {
        let u = Update::decode_v1(bytes).map_err(|e| Error::Update(e.to_string()))?;
        let missing = {
            let mut txn = self.doc.transact_mut();
            txn.apply_update(u)
                .map_err(|e| Error::Update(e.to_string()))?;
            txn.has_missing_updates()
        };
        if missing {
            self.deferred.push(bytes.to_vec());
        }
        for _ in 0..8 {
            if self.deferred.is_empty() {
                break;
            }
            let missing = {
                let mut txn = self.doc.transact_mut();
                let _ = txn.prune_pending();
                for raw in &self.deferred {
                    let u = Update::decode_v1(raw).map_err(|e| Error::Update(e.to_string()))?;
                    txn.apply_update(u)
                        .map_err(|e| Error::Update(e.to_string()))?;
                }
                txn.has_missing_updates()
            };
            if !missing {
                self.deferred.clear();
            }
        }
        Ok(())
    }

    pub fn encode_state(&self) -> Vec<u8> {
        self.doc
            .transact()
            .encode_state_as_update_v1(&StateVector::default())
    }

    pub fn has_pending(&self) -> bool {
        self.doc.transact().has_missing_updates()
    }

    /* ───── Commandes ───── */

    fn new_id(&mut self) -> (String, f64) {
        let now = self.env.now_ms();
        (Ulid::new(now as u64, self.env.random()).to_string(), now)
    }

    /// Pose un autocollant ; rend son identifiant. Il passe au-dessus de tout ce qui est déjà posé.
    pub fn add_sticker(
        &mut self,
        sticker: &str,
        tint: &str,
        at: Anchor,
        rot: f64,
        scale: f64,
    ) -> Result<String, Error> {
        check_anchor(&at)?;
        if sticker.is_empty() {
            return Err(Error::Invalid("autocollant sans dessin".into()));
        }
        let (id, now) = self.new_id();
        let (id2, sticker, tint) = (id.clone(), sticker.to_string(), tint.to_string());
        self.write(move |txn, items| {
            let z = Self::next_z(items, txn);
            let m = items.insert(txn, id2.as_str(), MapPrelim::default());
            m.insert(txn, "type", "sticker");
            m.insert(txn, "sticker", sticker);
            m.insert(txn, "tint", tint);
            m.insert(txn, "x", at.x);
            m.insert(txn, "y", at.y);
            m.insert(txn, "w", at.w);
            m.insert(txn, "rot", rot);
            m.insert(txn, "scale", scale.clamp(0.25, 4.0));
            m.insert(txn, "createdAt", now);
            m.insert(txn, "z", z);
            Ok(())
        })?;
        Ok(id)
    }

    /// Colle une photo (déjà écrite et confirmée dans le stockage des médias : règle § 3.3).
    pub fn add_photo(
        &mut self,
        sha: &str,
        ratio: f64,
        approx: bool,
        at: Anchor,
        rot: f64,
        scale: f64,
    ) -> Result<String, Error> {
        check_anchor(&at)?;
        if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Invalid("référence de photo invalide".into()));
        }
        if !(ratio.is_finite() && ratio > 0.0) {
            return Err(Error::Invalid("proportions de photo invalides".into()));
        }
        let (id, now) = self.new_id();
        let (id2, sha) = (id.clone(), sha.to_ascii_lowercase());
        self.write(move |txn, items| {
            let z = Self::next_z(items, txn);
            let m = items.insert(txn, id2.as_str(), MapPrelim::default());
            m.insert(txn, "type", "photo");
            m.insert(txn, "sha", sha);
            m.insert(txn, "ratio", ratio);
            if approx {
                m.insert(txn, "approx", true);
            }
            m.insert(txn, "x", at.x);
            m.insert(txn, "y", at.y);
            m.insert(txn, "w", at.w);
            m.insert(txn, "rot", rot);
            m.insert(txn, "scale", scale.clamp(0.25, 4.0));
            m.insert(txn, "createdAt", now);
            m.insert(txn, "z", z);
            Ok(())
        })?;
        Ok(id)
    }

    /// Les photos référencées par cette page (balayage des médias).
    pub fn media(&self) -> Vec<String> {
        let t = self.doc.transact();
        self.items
            .iter(&t)
            .filter_map(|(_, v)| match v {
                Out::YMap(m) if text(&m, &t, "type").as_deref() == Some("photo") => {
                    text(&m, &t, "sha")
                }
                _ => None,
            })
            .collect()
    }

    /// Pose un trait (points x, y, pression à plat, relatifs à l'ancre).
    pub fn add_stroke(
        &mut self,
        tool: &str,
        color: &str,
        width: f64,
        at: Anchor,
        points: &[f32],
    ) -> Result<String, Error> {
        check_anchor(&at)?;
        if points.len() < 3 || points.len() % 3 != 0 || points.iter().any(|v| !v.is_finite()) {
            return Err(Error::Invalid("trait sans points".into()));
        }
        let (id, now) = self.new_id();
        let bytes: Vec<u8> = points.iter().flat_map(|v| v.to_le_bytes()).collect();
        let (id2, tool, color) = (id.clone(), tool.to_string(), color.to_string());
        self.write(move |txn, items| {
            let z = Self::next_z(items, txn);
            let m = items.insert(txn, id2.as_str(), MapPrelim::default());
            m.insert(txn, "type", "stroke");
            m.insert(txn, "tool", tool);
            m.insert(txn, "color", color);
            m.insert(txn, "width", width);
            m.insert(txn, "x", at.x);
            m.insert(txn, "y", at.y);
            m.insert(txn, "w", at.w);
            m.insert(txn, "points", Any::Buffer(Arc::from(bytes)));
            m.insert(txn, "createdAt", now);
            m.insert(txn, "z", z);
            Ok(())
        })?;
        Ok(id)
    }

    /// Déplace un objet (nouvelle ancre) et le passe au premier plan.
    pub fn move_item(&mut self, id: &str, at: Anchor) -> Result<(), Error> {
        check_anchor(&at)?;
        self.write(|txn, items| {
            let z = Self::next_z(items, txn);
            let m = Self::item_map(items, txn, id)?;
            m.insert(txn, "x", at.x);
            m.insert(txn, "y", at.y);
            m.insert(txn, "w", at.w);
            m.insert(txn, "z", z);
            Ok(())
        })
    }

    /// Tourne et met à l'échelle un autocollant.
    pub fn transform(&mut self, id: &str, rot: f64, scale: f64) -> Result<(), Error> {
        if !(rot.is_finite() && scale.is_finite()) {
            return Err(Error::Invalid("transformation invalide".into()));
        }
        self.write(|txn, items| {
            let m = Self::item_map(items, txn, id)?;
            m.insert(txn, "rot", rot.rem_euclid(360.0));
            m.insert(txn, "scale", scale.clamp(0.25, 4.0));
            Ok(())
        })
    }

    pub fn delete_item(&mut self, id: &str) -> Result<(), Error> {
        let now = self.env.now_ms();
        self.write(|txn, items| {
            let m = Self::item_map(items, txn, id)?;
            m.insert(txn, "deletedAt", now);
            Ok(())
        })
    }

    pub fn restore_item(&mut self, id: &str) -> Result<(), Error> {
        self.write(|txn, items| {
            let m = Self::item_map(items, txn, id)?;
            m.remove(txn, "deletedAt");
            Ok(())
        })
    }

    /// Objets visibles, du fond vers le dessus (l'identifiant départage).
    pub fn items(&self) -> Vec<Item> {
        let t = self.doc.transact();
        let mut v: Vec<Item> = self
            .items
            .iter(&t)
            .filter_map(|(k, v)| match v {
                Out::YMap(m) => read_item(k, &m, &t),
                _ => None,
            })
            .collect();
        v.sort_by(|a, b| a.z().total_cmp(&b.z()).then_with(|| a.id().cmp(b.id())));
        v
    }

    /// Le document a-t-il jamais reçu un objet ? (une page vide n'est pas enregistrée)
    pub fn is_empty(&self) -> bool {
        let t = self.doc.transact();
        self.items.len(&t) == 0
    }
}
