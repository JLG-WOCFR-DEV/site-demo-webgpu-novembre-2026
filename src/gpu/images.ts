import { BLIT } from "./wgsl.ts";

/**
 * Photos : décodage hors du thread principal (createImageBitmap), copie
 * directe vers la texture (copyExternalImageToTexture, sans getImageData),
 * puis chaîne de mipmaps générée sur le GPU par réductions successives.
 */
export type Plate = {
  img: HTMLImageElement;
  texture: GPUTexture | null;
  bind: GPUBindGroup | null;
  width: number;
  height: number;
  radius: number;
  quad: boolean;
  hover: number;
  /** Décollement lissé de l'épreuve (chapitre 02). */
  peel: number;
  /** Plaque de l'encre fraîche (chapitre 08.2) : dessinée depuis le colorant du fluide. */
  fluid: boolean;
};

export class ImageLayer {
  plates: Plate[] = [];
  private blitPipe: GPURenderPipeline;
  private blitSampler: GPUSampler;
  bytes = 0;
  private device: GPUDevice;
  private texLayout: GPUBindGroupLayout;
  private sampler: GPUSampler;

  constructor(device: GPUDevice, texLayout: GPUBindGroupLayout, sampler: GPUSampler) {
    this.device = device;
    this.texLayout = texLayout;
    this.sampler = sampler;
    const mod = device.createShaderModule({ label: "blit", code: BLIT });
    this.blitPipe = device.createRenderPipeline({
      label: "mip-blit",
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
    });
    this.blitSampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
  }

  collect() {
    const imgs = [...document.querySelectorAll<HTMLImageElement>("img[data-gl-img]")];
    this.plates = imgs.map((img) => ({
      img,
      texture: null,
      bind: null,
      width: img.naturalWidth || Number(img.getAttribute("width")) || 1,
      height: img.naturalHeight || Number(img.getAttribute("height")) || 1,
      radius: Number.parseFloat(getComputedStyle(img.parentElement ?? img).borderTopLeftRadius) || 0,
      quad: img.hasAttribute("data-gl-quad"),
      hover: 0,
      peel: 0,
      fluid: img.hasAttribute("data-gl-fluid"),
    }));
    for (const p of this.plates) void this.load(p);
  }

  private async load(p: Plate) {
    const res = await fetch(p.img.currentSrc || p.img.src);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const levels = Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height))) + 1;
    const texture = this.device.createTexture({
      label: p.img.alt.slice(0, 40),
      size: [bitmap.width, bitmap.height],
      format: "rgba8unorm",
      mipLevelCount: levels,
      usage:
        GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture, premultipliedAlpha: false },
      [bitmap.width, bitmap.height],
    );
    this.mips(texture, levels);
    p.width = bitmap.width;
    p.height = bitmap.height;
    bitmap.close();
    p.texture = texture;
    p.bind = this.bindFor(texture);
    // Estimation : 4 octets par texel, ×4/3 pour la chaîne de mips.
    this.bytes += Math.round(p.width * p.height * 4 * (4 / 3));
  }

  bindFor(texture: GPUTexture) {
    return this.device.createBindGroup({
      layout: this.texLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });
  }

  private mips(texture: GPUTexture, levels: number) {
    const enc = this.device.createCommandEncoder({ label: "mips" });
    for (let i = 1; i < levels; i++) {
      const bind = this.device.createBindGroup({
        layout: this.blitPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.blitSampler },
          { binding: 1, resource: texture.createView({ baseMipLevel: i - 1, mipLevelCount: 1 }) },
        ],
      });
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView({ baseMipLevel: i, mipLevelCount: 1 }),
            loadOp: "clear",
            storeOp: "store",
            clearValue: [0, 0, 0, 0],
          },
        ],
      });
      pass.setPipeline(this.blitPipe);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
    }
    this.device.queue.submit([enc.finish()]);
  }

  destroy() {
    for (const p of this.plates) p.texture?.destroy();
    this.plates = [];
  }
}

/** Recadrage object-fit: cover, en coordonnées de texture. */
export function coverUV(boxW: number, boxH: number, texW: number, texH: number) {
  const box = boxW / Math.max(1, boxH);
  const tex = texW / Math.max(1, texH);
  if (tex > box) {
    const w = box / tex;
    return [0.5 - w / 2, 0, 0.5 + w / 2, 1] as const;
  }
  const h = tex / box;
  return [0, 0.5 - h / 2, 1, 0.5 + h / 2] as const;
}
