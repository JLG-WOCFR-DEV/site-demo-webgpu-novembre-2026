//! `presse-rs` : le rendu de Presse en Rust (wgpu), périmètre Carnet (roadmap § 3.5, P3a).
//!
//! Aucune dépendance au DOM ni à Carnet : l'hôte (presse-web dans le navigateur, Rune sur ordinateur)
//! fournit les glyphes déjà placés (instances de 64 octets, même disposition que `struct Glyph` en
//! WGSL et que `TextLayer` en TypeScript), les boîtes des éléments à chaque image (32 octets), et les
//! pixels de l'atlas. Le moteur peint : papier, encre (SDF / MTSDF, apparition, morphing), grain.
//!
//! Couleurs : valeurs sRGB telles qu'en CSS, écrites sans conversion dans une cible non sRGB, comme
//! le moteur TypeScript (la parité se mesure à l'image).

use std::num::NonZeroU64;

use bytemuck::Zeroable;
use wgpu::util::DeviceExt;

/// Côté de l'atlas SDF (r8), en texels.
pub const ATLAS_SIZE: u32 = 2048;
/// Octets par glyphe (`struct Glyph`).
pub const GLYPH_STRIDE: usize = 64;
/// Flottants par élément (`struct Elem`).
pub const ELEM_FLOATS: usize = 8;
/// Format de la scène : demi-flottants, comme le moteur TypeScript.
pub const SCENE_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba16Float;

pub const TEXT_WGSL: &str = include_str!("../shaders/text.wgsl");
pub const POST_WGSL: &str = include_str!("../shaders/post.wgsl");

/// Ce que l'hôte donne à chaque image.
#[derive(Clone, Copy, Debug)]
pub struct Frame {
    /// Taille de la page visible, en pixels CSS.
    pub css: [f32; 2],
    /// Pixels physiques par pixel CSS (échelle du gouverneur comprise).
    pub dpr: f32,
    /// Secondes depuis le début (horloge virtuelle en capture).
    pub time: f32,
    pub reduced: bool,
    /// Intensité du mouvement (0,4 sobre … 1,6).
    pub motion: f32,
    /// Couleur du papier, sRGB 0…1.
    pub paper: [f32; 3],
    /// Amplitude du grain (0 : coupé).
    pub grain: f32,
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct FrameU {
    viewport: [f32; 4],
    pointer: [f32; 4],
    glyph: [f32; 4],
    misc: [f32; 4],
    motion: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct PostU {
    res: [f32; 4],
    paper: [f32; 4],
    opts: [f32; 4],
}

struct Storage {
    buf: wgpu::Buffer,
    cap: u64,
}

impl Storage {
    fn new(device: &wgpu::Device, label: &str, cap: u64) -> Storage {
        Storage {
            buf: device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(label),
                size: cap,
                usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }),
            cap,
        }
    }
    /// Écrit `data` ; rend vrai si le tampon a dû être recréé (les liaisons sont à refaire).
    fn write(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        label: &str,
        data: &[u8],
    ) -> bool {
        let need = (data.len() as u64).max(16).next_multiple_of(16);
        let grown = need > self.cap;
        if grown {
            *self = Storage::new(device, label, need + need / 4);
        }
        if !data.is_empty() {
            queue.write_buffer(&self.buf, 0, data);
        }
        grown
    }
}

pub struct Renderer {
    format: wgpu::TextureFormat,
    text_pipe: wgpu::RenderPipeline,
    post_pipe: wgpu::RenderPipeline,
    text_layout: wgpu::BindGroupLayout,
    post_layout: wgpu::BindGroupLayout,
    frame_buf: wgpu::Buffer,
    frame_bind: wgpu::BindGroup,
    post_buf: wgpu::Buffer,
    sampler: wgpu::Sampler,
    atlas: wgpu::Texture,
    msdf: wgpu::Texture,
    glyphs: Storage,
    elems: Storage,
    glyph_count: u32,
    text_bind: Option<wgpu::BindGroup>,
    scene: Option<(
        wgpu::Texture,
        wgpu::TextureView,
        wgpu::BindGroup,
        (u32, u32),
    )>,
}

fn storage_entry(binding: u32, vis: wgpu::ShaderStages) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: vis,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Storage { read_only: true },
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}
fn texture_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Texture {
            sample_type: wgpu::TextureSampleType::Float { filterable: true },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}
fn sampler_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
        count: None,
    }
}
fn uniform_entry(binding: u32, vis: wgpu::ShaderStages, size: u64) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: vis,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: NonZeroU64::new(size),
        },
        count: None,
    }
}

fn texture(
    device: &wgpu::Device,
    label: &str,
    w: u32,
    h: u32,
    format: wgpu::TextureFormat,
) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: Some(label),
        size: wgpu::Extent3d {
            width: w,
            height: h,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    })
}

#[allow(clippy::too_many_arguments)]
fn write_texture(
    queue: &wgpu::Queue,
    tex: &wgpu::Texture,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    bpp: u32,
    data: &[u8],
) {
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture: tex,
            mip_level: 0,
            origin: wgpu::Origin3d { x, y, z: 0 },
            aspect: wgpu::TextureAspect::All,
        },
        data,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(w * bpp),
            rows_per_image: Some(h),
        },
        wgpu::Extent3d {
            width: w,
            height: h,
            depth_or_array_layers: 1,
        },
    );
}

impl Renderer {
    /// `format` : celui de la surface, **non sRGB** (les couleurs sont déjà encodées sRGB).
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Renderer {
        let text_mod = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("presse-text"),
            source: wgpu::ShaderSource::Wgsl(TEXT_WGSL.into()),
        });
        let post_mod = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("presse-post"),
            source: wgpu::ShaderSource::Wgsl(POST_WGSL.into()),
        });
        let vf = wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT;
        let frame_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("presse-frame"),
            entries: &[uniform_entry(0, vf, std::mem::size_of::<FrameU>() as u64)],
        });
        let text_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("presse-glyphs"),
            entries: &[
                storage_entry(0, wgpu::ShaderStages::VERTEX),
                storage_entry(1, wgpu::ShaderStages::VERTEX),
                sampler_entry(2),
                texture_entry(3),
                texture_entry(4),
            ],
        });
        let post_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("presse-post"),
            entries: &[
                uniform_entry(
                    0,
                    wgpu::ShaderStages::FRAGMENT,
                    std::mem::size_of::<PostU>() as u64,
                ),
                texture_entry(1),
                sampler_entry(2),
            ],
        });
        let text_pipe = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("presse-glyphs"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("presse-glyphs"),
                    bind_group_layouts: &[Some(&frame_layout), Some(&text_layout)],
                    immediate_size: 0,
                }),
            ),
            vertex: wgpu::VertexState {
                module: &text_mod,
                entry_point: Some("vs"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleStrip,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: Default::default(),
            fragment: Some(wgpu::FragmentState {
                module: &text_mod,
                entry_point: Some("fs"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: SCENE_FORMAT,
                    blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            multiview_mask: None,
            cache: None,
        });
        let post_pipe = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("presse-post"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("presse-post"),
                    bind_group_layouts: &[Some(&post_layout)],
                    immediate_size: 0,
                }),
            ),
            vertex: wgpu::VertexState {
                module: &post_mod,
                entry_point: Some("vs"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            fragment: Some(wgpu::FragmentState {
                module: &post_mod,
                entry_point: Some("fs"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            multiview_mask: None,
            cache: None,
        });
        let frame_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("presse-frame"),
            contents: bytemuck::bytes_of(&FrameU::zeroed()),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        let frame_bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("presse-frame"),
            layout: &frame_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: frame_buf.as_entire_binding(),
            }],
        });
        let post_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("presse-post"),
            contents: bytemuck::bytes_of(&PostU::zeroed()),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("presse-lin"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        Renderer {
            format,
            text_pipe,
            post_pipe,
            text_layout,
            post_layout,
            frame_buf,
            frame_bind,
            post_buf,
            sampler,
            atlas: texture(
                device,
                "presse-atlas",
                ATLAS_SIZE,
                ATLAS_SIZE,
                wgpu::TextureFormat::R8Unorm,
            ),
            msdf: texture(device, "presse-msdf", 1, 1, wgpu::TextureFormat::Rgba8Unorm),
            glyphs: Storage::new(device, "presse-glyphs", 64 * 1024),
            elems: Storage::new(device, "presse-elems", 4 * 1024),
            glyph_count: 0,
            text_bind: None,
            scene: None,
        }
    }

    pub fn format(&self) -> wgpu::TextureFormat {
        self.format
    }

    /// Écrit un rectangle de l'atlas SDF (r8, une ligne = `w` octets).
    pub fn write_atlas(&self, queue: &wgpu::Queue, x: u32, y: u32, w: u32, h: u32, data: &[u8]) {
        if w == 0
            || h == 0
            || x + w > ATLAS_SIZE
            || y + h > ATLAS_SIZE
            || data.len() < (w * h) as usize
        {
            return;
        }
        write_texture(queue, &self.atlas, x, y, w, h, 1, data);
    }

    /// Remplace l'atlas MTSDF des titres (rgba8, sans prémultiplication).
    pub fn set_msdf(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        w: u32,
        h: u32,
        rgba: &[u8],
    ) {
        if w == 0 || h == 0 || rgba.len() < (w * h * 4) as usize {
            return;
        }
        self.msdf = texture(device, "presse-msdf", w, h, wgpu::TextureFormat::Rgba8Unorm);
        write_texture(queue, &self.msdf, 0, 0, w, h, 4, rgba);
        self.text_bind = None;
    }

    /// Glyphes placés, `GLYPH_STRIDE` octets chacun, relatifs à leur élément.
    pub fn set_glyphs(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, data: &[u8]) {
        self.glyph_count = (data.len() / GLYPH_STRIDE) as u32;
        if self.glyphs.write(device, queue, "presse-glyphs", data) {
            self.text_bind = None;
        }
    }

    /// Boîtes des éléments pour cette image : `ELEM_FLOATS` flottants chacun.
    pub fn set_elems(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, data: &[f32]) {
        if self
            .elems
            .write(device, queue, "presse-elems", bytemuck::cast_slice(data))
        {
            self.text_bind = None;
        }
    }

    pub fn glyph_count(&self) -> u32 {
        self.glyph_count
    }

    fn ensure_scene(&mut self, device: &wgpu::Device, w: u32, h: u32) {
        if self.scene.as_ref().is_some_and(|s| s.3 == (w, h)) {
            return;
        }
        let tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("presse-scene"),
            size: wgpu::Extent3d {
                width: w,
                height: h,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: SCENE_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let view = tex.create_view(&Default::default());
        let bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("presse-post"),
            layout: &self.post_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.post_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });
        self.scene = Some((tex, view, bind, (w, h)));
    }

    fn ensure_text_bind(&mut self, device: &wgpu::Device) {
        if self.text_bind.is_some() {
            return;
        }
        let atlas = self.atlas.create_view(&Default::default());
        let msdf = self.msdf.create_view(&Default::default());
        self.text_bind = Some(device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("presse-glyphs"),
            layout: &self.text_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.glyphs.buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.elems.buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::TextureView(&atlas),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::TextureView(&msdf),
                },
            ],
        }));
    }

    /// Peint une image dans `target` (`size` en pixels physiques).
    pub fn render(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        target: &wgpu::TextureView,
        size: (u32, u32),
        f: &Frame,
    ) {
        let (w, h) = (size.0.max(1), size.1.max(1));
        self.ensure_scene(device, w, h);
        self.ensure_text_bind(device);
        let fu = FrameU {
            viewport: [f.css[0], f.css[1], f.dpr, f.time],
            pointer: [0.0, 0.0, 0.0, if f.reduced { 1.0 } else { 0.0 }],
            glyph: [0.0; 4],
            misc: [ATLAS_SIZE as f32, 1.0, f.paper[0], 0.0],
            motion: [0.0, 0.0, f.motion, 0.0],
        };
        queue.write_buffer(&self.frame_buf, 0, bytemuck::bytes_of(&fu));
        let pu = PostU {
            res: [w as f32, h as f32, f.dpr, f.time],
            paper: [f.paper[0], f.paper[1], f.paper[2], 0.0],
            opts: [f.grain, if f.reduced { 1.0 } else { 0.0 }, 0.0, 0.0],
        };
        queue.write_buffer(&self.post_buf, 0, bytemuck::bytes_of(&pu));

        let (_, scene_view, post_bind, _) = self.scene.as_ref().expect("scène créée");
        let mut enc = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("presse"),
        });
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("presse-scene"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: scene_view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: f.paper[0] as f64,
                            g: f.paper[1] as f64,
                            b: f.paper[2] as f64,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            if self.glyph_count > 0 {
                pass.set_pipeline(&self.text_pipe);
                pass.set_bind_group(0, &self.frame_bind, &[]);
                pass.set_bind_group(1, self.text_bind.as_ref(), &[]);
                pass.draw(0..4, 0..self.glyph_count);
            }
        }
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("presse-post"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: target,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_pipeline(&self.post_pipe);
            pass.set_bind_group(0, post_bind, &[]);
            pass.draw(0..3, 0..1);
        }
        queue.submit([enc.finish()]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn validate(src: &str) {
        let module = naga::front::wgsl::parse_str(src)
            .unwrap_or_else(|e| panic!("{}", e.emit_to_string(src)));
        naga::valid::Validator::new(
            naga::valid::ValidationFlags::all(),
            naga::valid::Capabilities::empty(),
        )
        .validate(&module)
        .unwrap_or_else(|e| panic!("{e:?}"));
    }

    #[test]
    fn shaders_validate() {
        validate(TEXT_WGSL);
        validate(POST_WGSL);
    }

    #[test]
    fn struct_sizes_match_wgsl() {
        assert_eq!(std::mem::size_of::<FrameU>(), 80);
        assert_eq!(std::mem::size_of::<PostU>(), 48);
        // Glyph : 4 × vec2/vec4 + 6 scalaires = 64 octets, comme GLYPH_STRIDE côté TypeScript.
        assert_eq!(GLYPH_STRIDE, 64);
        assert_eq!(ELEM_FLOATS * 4, 32);
    }
}
