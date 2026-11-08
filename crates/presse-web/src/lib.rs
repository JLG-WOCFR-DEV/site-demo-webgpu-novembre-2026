//! `presse-web` : presse-rs dans le navigateur (WebGPU par wgpu), second module wasm de Carnet.
//!
//! L'hôte TypeScript garde ce qui dépend du DOM : mise en page des glyphes (TextLayer), boîtes des
//! éléments à chaque image, boucle à la demande. Ce module ne reçoit que des octets : pixels
//! d'atlas, instances de glyphes, boîtes ; et peint une image quand on le lui demande.
//!
//! Perte de l'appareil : `lost()` passe à vrai ; l'hôte jette l'objet, en crée un neuf sur le même
//! canvas et lui rend ce qu'il a gardé (atlas, glyphes). Rien n'est perdu côté données.

use std::cell::{Cell, RefCell};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use presse_rs::{Frame, Renderer};
use wasm_bindgen::prelude::*;

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub struct PresseWeb {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: RefCell<wgpu::SurfaceConfiguration>,
    renderer: RefCell<Renderer>,
    lost: Arc<AtomicBool>,
    info: String,
    frames: Cell<u32>,
    light: Cell<[f32; 8]>,
}

#[wasm_bindgen]
impl PresseWeb {
    /// Ouvre WebGPU sur `canvas`. Échoue (sans rien casser) si le navigateur n'a pas d'adaptateur.
    pub async fn create(canvas: web_sys::HtmlCanvasElement) -> Result<PresseWeb, JsError> {
        let (w, h) = (canvas.width().max(1), canvas.height().max(1));
        let mut desc = wgpu::InstanceDescriptor::new_without_display_handle();
        desc.backends = wgpu::Backends::BROWSER_WEBGPU;
        let instance = wgpu::Instance::new(desc);
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(err)?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::LowPower,
                force_fallback_adapter: false,
                compatible_surface: Some(&surface),
                apply_limit_buckets: false,
            })
            .await
            .map_err(err)?;
        let ai = adapter.get_info();
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("presse"),
                required_features: wgpu::Features::empty(),
                // Les limites par défaut de WebGPU (et pas celles de l'adaptateur) : ce qui tourne ici
                // tourne sur le téléphone de référence.
                required_limits: wgpu::Limits::defaults(),
                ..Default::default()
            })
            .await
            .map_err(err)?;
        let lost = Arc::new(AtomicBool::new(false));
        let l = lost.clone();
        device.set_device_lost_callback(move |_, _| l.store(true, Ordering::SeqCst));
        // Couleurs déjà encodées sRGB : une cible non sRGB, comme le moteur TypeScript.
        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| !f.is_srgb())
            .unwrap_or(caps.formats[0]);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: w,
            height: h,
            present_mode: wgpu::PresentMode::Fifo,
            desired_maximum_frame_latency: 2,
            alpha_mode: wgpu::CompositeAlphaMode::Opaque,
            view_formats: vec![],
            color_space: wgpu::SurfaceColorSpace::Auto,
        };
        surface.configure(&device, &config);
        let renderer = Renderer::new(&device, format);
        Ok(PresseWeb {
            surface,
            device,
            queue,
            config: RefCell::new(config),
            renderer: RefCell::new(renderer),
            lost,
            info: format!("{} · {} · {:?}", ai.name, ai.driver, format),
            frames: Cell::new(0),
            light: Cell::new([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.15]),
        })
    }

    /// Taille du canvas en pixels physiques.
    pub fn resize(&self, w: u32, h: u32) {
        let mut c = self.config.borrow_mut();
        let (w, h) = (w.max(1), h.max(1));
        if c.width != w || c.height != h {
            c.width = w;
            c.height = h;
            self.surface.configure(&self.device, &c);
        }
    }

    #[wasm_bindgen(js_name = writeAtlas)]
    pub fn write_atlas(&self, x: u32, y: u32, w: u32, h: u32, data: &[u8]) {
        self.renderer
            .borrow()
            .write_atlas(&self.queue, x, y, w, h, data);
    }

    #[wasm_bindgen(js_name = setMsdf)]
    pub fn set_msdf(&self, w: u32, h: u32, rgba: &[u8]) {
        self.renderer
            .borrow_mut()
            .set_msdf(&self.device, &self.queue, w, h, rgba);
    }

    #[wasm_bindgen(js_name = setGlyphs)]
    pub fn set_glyphs(&self, data: &[u8]) {
        self.renderer
            .borrow_mut()
            .set_glyphs(&self.device, &self.queue, data);
    }

    #[wasm_bindgen(js_name = setElems)]
    pub fn set_elems(&self, data: &[f32]) {
        self.renderer
            .borrow_mut()
            .set_elems(&self.device, &self.queue, data);
    }

    /// Carnet, papier éclairé : direction (x, y), relief, 0 ; chaleur, flaque, centre (u, v).
    #[wasm_bindgen(js_name = setLight)]
    #[allow(clippy::too_many_arguments)]
    pub fn set_light(&self, lx: f32, ly: f32, relief: f32, l3: f32, warm: f32, pool: f32, pu: f32, pv: f32) {
        self.light.set([lx, ly, relief, l3, warm, pool, pu, pv]);
    }

    /// Peint une image. `false` : image sautée (surface pas prête), à redemander.
    #[allow(clippy::too_many_arguments)]
    pub fn render(
        &self,
        css_w: f32,
        css_h: f32,
        dpr: f32,
        time: f32,
        reduced: bool,
        motion: f32,
        paper_r: f32,
        paper_g: f32,
        paper_b: f32,
        grain: f32,
    ) -> Result<bool, JsError> {
        if self.lost.load(Ordering::SeqCst) {
            return Err(err("appareil GPU perdu"));
        }
        let tex = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t)
            | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                self.surface.configure(&self.device, &self.config.borrow());
                return Ok(false);
            }
            _ => return Ok(false),
        };
        let view = tex.texture.create_view(&Default::default());
        let size = (tex.texture.width(), tex.texture.height());
        let f = Frame {
            css: [css_w, css_h],
            dpr,
            time,
            reduced,
            motion,
            paper: [paper_r, paper_g, paper_b],
            grain,
            light: {
                let l = self.light.get();
                [l[0], l[1], l[2], l[3]]
            },
            lamp: {
                let l = self.light.get();
                [l[4], l[5], l[6], l[7]]
            },
        };
        self.renderer
            .borrow_mut()
            .render(&self.device, &self.queue, &view, size, &f);
        self.queue.present(tex);
        self.frames.set(self.frames.get() + 1);
        Ok(true)
    }

    /// L'appareil a été perdu : recréer un `PresseWeb` et lui rendre atlas et glyphes.
    pub fn lost(&self) -> bool {
        self.lost.load(Ordering::SeqCst)
    }

    /// Provoque la perte de l'appareil (test de reconstruction).
    #[wasm_bindgen(js_name = loseDevice)]
    pub fn lose_device(&self) {
        self.device.destroy();
    }

    pub fn info(&self) -> String {
        self.info.clone()
    }

    pub fn frames(&self) -> u32 {
        self.frames.get()
    }

    #[wasm_bindgen(js_name = glyphCount)]
    pub fn glyph_count(&self) -> u32 {
        self.renderer.borrow().glyph_count()
    }
}
