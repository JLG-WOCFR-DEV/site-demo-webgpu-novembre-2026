//! `carnet-wasm` : la frontière entre `carnet-core` et la coquille web (roadmap § 3.4).
//!
//! Par lot : une commande, une vue ou un lot de mises à jour par appel, jamais un appel par
//! élément. Les modèles de vue passent par `serde-wasm-bindgen` en objets JSON compatibles
//! (`null` plutôt que `undefined`) ; les mises à jour yrs passent en `Uint8Array`.
//!
//! Le core ne fait aucune E/S : la coquille lit et écrit le stockage, et rend au core ce qu'elle lit.

use carnet_core::{Day, Env, Month, NewEntry, Notebook, Place, State};
use js_sys::{Array, Uint8Array};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Heure et aléa du navigateur. L'aléa vient de `crypto.getRandomValues` (identifiants d'entrée,
/// identifiant de session yrs) ; `Math.random` seulement si l'API manque.
struct WebEnv;

fn random_bytes(n: u32) -> Vec<u8> {
    let buf = Uint8Array::new_with_length(n);
    let crypto = js_sys::Reflect::get(&js_sys::global(), &"crypto".into()).ok();
    let filled = crypto
        .filter(|c| !c.is_undefined())
        .and_then(|c| {
            let f = js_sys::Reflect::get(&c, &"getRandomValues".into()).ok()?;
            let f: js_sys::Function = f.dyn_into().ok()?;
            f.call1(&c, &buf).ok()
        })
        .is_some();
    let mut v = buf.to_vec();
    if !filled {
        for b in v.iter_mut() {
            *b = (js_sys::Math::random() * 256.0) as u8;
        }
    }
    v
}

impl Env for WebEnv {
    fn now_ms(&mut self) -> f64 {
        js_sys::Date::now()
    }
    fn random(&mut self) -> u128 {
        let b = random_bytes(16);
        u128::from_le_bytes(b.try_into().unwrap_or([0; 16]))
    }
}

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

fn to_js<T: Serialize>(v: &T) -> Result<JsValue, JsError> {
    v.serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(err)
}

fn day(s: &str) -> Result<Day, JsError> {
    s.parse().map_err(|_| err(format!("date illisible : {s}")))
}

fn place(v: JsValue) -> Result<Place, JsError> {
    serde_wasm_bindgen::from_value(v).map_err(err)
}

fn bytes_array(v: Vec<Vec<u8>>) -> Array {
    v.into_iter()
        .map(|b| JsValue::from(Uint8Array::from(b.as_slice())))
        .collect()
}

/// Un carnet ouvert dans cette page. Un identifiant yrs neuf à chaque ouverture : deux onglets ou
/// une page rechargée ne réutilisent jamais le même (yrs l'exige pour converger).
#[wasm_bindgen]
pub struct Carnet {
    nb: Notebook,
}

#[wasm_bindgen]
impl Carnet {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Carnet {
        let id = random_bytes(8);
        let client = u64::from_le_bytes(id.try_into().unwrap_or([1; 8])) & ((1 << 53) - 1);
        Carnet {
            nb: Notebook::new(client.max(1), Box::new(WebEnv)),
        }
    }

    /* ───── Mises à jour et stockage ───── */

    /// Applique un lot de mises à jour (lecture du stockage au démarrage, réception d'un autre onglet).
    /// Une mise à jour illisible arrête le lot : rien n'est perdu côté stockage, l'erreur dit laquelle.
    pub fn apply(&mut self, updates: Array) -> Result<(), JsError> {
        for (i, u) in updates.iter().enumerate() {
            let u: Uint8Array = u
                .dyn_into()
                .map_err(|_| err(format!("mise à jour {i} : pas un Uint8Array")))?;
            self.nb
                .apply_update(&u.to_vec())
                .map_err(|e| err(format!("mise à jour {i} : {e}")))?;
        }
        Ok(())
    }

    /// Mises à jour produites par les commandes locales depuis le dernier appel, dans l'ordre.
    #[wasm_bindgen(js_name = takeUpdates)]
    pub fn take_updates(&mut self) -> Array {
        bytes_array(self.nb.take_updates())
    }

    /// Le document entier, en une mise à jour (checkpoint, sauvegarde `.carnet`).
    #[wasm_bindgen(js_name = encodeState)]
    pub fn encode_state(&self) -> Vec<u8> {
        self.nb.encode_state()
    }

    #[wasm_bindgen(js_name = stateVector)]
    pub fn state_vector(&self) -> Vec<u8> {
        self.nb.state_vector()
    }

    pub fn diff(&self, state_vector: &[u8]) -> Result<Vec<u8>, JsError> {
        self.nb.diff(state_vector).map_err(err)
    }

    /// Des mises à jour attendent encore celles dont elles dépendent.
    #[wasm_bindgen(js_name = hasPending)]
    pub fn has_pending(&self) -> bool {
        self.nb.has_pending()
    }

    /* ───── Commandes ───── */

    /// `place` : `{ scope: "day" | "week:AAAA-MM-JJ" | "month:AAAA-MM" | "collection:<id>", day: "AAAA-MM-JJ" | null }`.
    /// `entry` : `{ kind?: "task" | "event" | "note", text, time?: "HH:MM", priority?, idea? }`. Rend l'identifiant.
    pub fn add(&mut self, place_: JsValue, entry: JsValue) -> Result<String, JsError> {
        let e: NewEntry = serde_wasm_bindgen::from_value(entry).map_err(err)?;
        self.nb.add(place(place_)?, e).map_err(err)
    }

    /// Remplace le texte par un seul remplacement minimal (préfixe et suffixe communs gardés).
    #[wasm_bindgen(js_name = setText)]
    pub fn set_text(&mut self, id: &str, text: &str) -> Result<(), JsError> {
        self.nb.set_text(id, text).map_err(err)
    }

    /// Une modification telle que le navigateur la décrit, en offsets UTF-16.
    #[wasm_bindgen(js_name = spliceText)]
    pub fn splice_text(
        &mut self,
        id: &str,
        start: u32,
        delete: u32,
        insert: &str,
    ) -> Result<(), JsError> {
        self.nb.splice_text(id, start, delete, insert).map_err(err)
    }

    #[wasm_bindgen(js_name = setState)]
    pub fn set_state(&mut self, id: &str, state: &str) -> Result<(), JsError> {
        let s: State = serde_wasm_bindgen::from_value(state.into()).map_err(err)?;
        self.nb.set_state(id, s).map_err(err)
    }

    /// Ouverte → faite → annulée → ouverte. Rend le nouvel état.
    #[wasm_bindgen(js_name = cycleState)]
    pub fn cycle_state(&mut self, id: &str) -> Result<JsValue, JsError> {
        to_js(&self.nb.cycle_state(id).map_err(err)?)
    }

    #[wasm_bindgen(js_name = setTime)]
    pub fn set_time(&mut self, id: &str, time: Option<String>) -> Result<(), JsError> {
        self.nb.set_time(id, time.as_deref()).map_err(err)
    }

    #[wasm_bindgen(js_name = setMarks)]
    pub fn set_marks(&mut self, id: &str, priority: bool, idea: bool) -> Result<(), JsError> {
        self.nb.set_marks(id, priority, idea).map_err(err)
    }

    pub fn migrate(&mut self, id: &str, to: JsValue) -> Result<(), JsError> {
        self.nb.migrate(id, place(to)?).map_err(err)
    }

    pub fn delete(&mut self, id: &str) -> Result<(), JsError> {
        self.nb.delete(id).map_err(err)
    }

    pub fn restore(&mut self, id: &str) -> Result<(), JsError> {
        self.nb.restore(id).map_err(err)
    }

    /// Vide la corbeille des entrées de plus de 30 jours. Rend leur nombre.
    pub fn purge(&mut self) -> Result<u32, JsError> {
        self.nb.purge().map(|n| n as u32).map_err(err)
    }

    pub fn dismiss(&mut self, key: &str) -> Result<(), JsError> {
        self.nb.dismiss(key).map_err(err)
    }

    /// Garde une suggestion au crayon : elle passe à l'encre ce jour-là. Rend l'identifiant de l'entrée.
    pub fn keep(&mut self, key: &str, on: &str) -> Result<String, JsError> {
        self.nb.keep(key, day(on)?).map_err(err)
    }

    /// Importe le carnet v0 (`localStorage["carnet.v0"]`). Idempotent.
    #[wasm_bindgen(js_name = importV0)]
    pub fn import_v0(&mut self, json: &str) -> Result<JsValue, JsError> {
        to_js(&self.nb.import_v0(json).map_err(err)?)
    }

    /* ───── Collections ───── */

    #[wasm_bindgen(js_name = createCollection)]
    pub fn create_collection(&mut self, name: &str) -> Result<String, JsError> {
        self.nb.create_collection(name).map_err(err)
    }

    #[wasm_bindgen(js_name = renameCollection)]
    pub fn rename_collection(&mut self, id: &str, name: &str) -> Result<(), JsError> {
        self.nb.rename_collection(id, name).map_err(err)
    }

    #[wasm_bindgen(js_name = deleteCollection)]
    pub fn delete_collection(&mut self, id: &str) -> Result<(), JsError> {
        self.nb.delete_collection(id).map_err(err)
    }

    #[wasm_bindgen(js_name = restoreCollection)]
    pub fn restore_collection(&mut self, id: &str) -> Result<(), JsError> {
        self.nb.restore_collection(id).map_err(err)
    }

    pub fn collections(&self) -> Result<JsValue, JsError> {
        to_js(&self.nb.collections())
    }

    /// `null` si la collection n'existe pas (ou est à la corbeille).
    #[wasm_bindgen(js_name = collectionView)]
    pub fn collection_view(&self, id: &str) -> Result<JsValue, JsError> {
        to_js(&self.nb.collection_view(id))
    }

    /* ───── Vues ───── */

    #[wasm_bindgen(js_name = weekView)]
    pub fn week_view(&self, any_day: &str, today: &str) -> Result<JsValue, JsError> {
        to_js(&self.nb.week_view(day(any_day)?, day(today)?))
    }

    #[wasm_bindgen(js_name = dayView)]
    pub fn day_view(&self, d: &str, today: &str, limit: u32) -> Result<JsValue, JsError> {
        to_js(&self.nb.day_view(day(d)?, day(today)?, limit as usize))
    }

    #[wasm_bindgen(js_name = monthView)]
    pub fn month_view(&self, month: &str, today: &str) -> Result<JsValue, JsError> {
        let m: Month = month
            .parse()
            .map_err(|_| err(format!("mois illisible : {month}")))?;
        to_js(&self.nb.month_view(m, day(today)?))
    }

    pub fn get(&self, id: &str) -> Result<JsValue, JsError> {
        to_js(&self.nb.get(id))
    }

    pub fn all(&self) -> Result<JsValue, JsError> {
        to_js(&self.nb.all())
    }

    /// Schéma qui a écrit ce carnet, et celui que ce module sait écrire.
    pub fn schema(&self) -> u32 {
        self.nb.schema()
    }

    #[wasm_bindgen(js_name = supportedSchema)]
    pub fn supported_schema(&self) -> u32 {
        carnet_core::SCHEMA
    }

    pub fn writable(&self) -> bool {
        self.nb.writable()
    }

    #[wasm_bindgen(js_name = stampSchema)]
    pub fn stamp_schema(&mut self) -> Result<(), JsError> {
        self.nb.stamp_schema().map_err(err)
    }

    #[wasm_bindgen(js_name = isDismissed)]
    pub fn is_dismissed(&self, key: &str) -> bool {
        self.nb.is_dismissed(key)
    }
}

impl Default for Carnet {
    fn default() -> Self {
        Self::new()
    }
}
