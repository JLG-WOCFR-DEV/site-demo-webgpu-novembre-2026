/**
 * Un tableau de textures pour une série de photos, avec sa chaîne de mipmaps
 * (une vignette lue dans une grande texture ne scintille pas).
 *
 * Chemin rapide (feuille de route A6) : la chaîne a été filtrée à la
 * construction et rangée en bande dans une seule image AVIF (data-gl-mips,
 * tools/images.py) ; on la décode une fois, hors du thread principal, et on
 * copie chaque niveau à sa place. Sinon, repli : l'original est réduit par le
 * navigateur, une fois par niveau.
 */
const STRIP: [number, number, number] = [768, 512, 4];

async function fromStrip(device: GPUDevice, tex: GPUTexture, url: string, layer: number, width: number, height: number, mips: number) {
  if (width !== STRIP[0] || height !== STRIP[1] || mips > STRIP[2]) return false;
  const res = await fetch(url);
  if (!res.ok) return false;
  const bmp = await createImageBitmap(await res.blob());
  let x = 0;
  for (let m = 0; m < mips; m++) {
    const w = width >> m;
    const h = height >> m;
    device.queue.copyExternalImageToTexture({ source: bmp, origin: [x, 0] }, { texture: tex, mipLevel: m, origin: [0, 0, layer] }, [w, h]);
    x += w;
  }
  bmp.close();
  return true;
}

/** Une image (déjà dans la page ou déposée) dans une couche du tableau. */
export async function fromImage(device: GPUDevice, tex: GPUTexture, img: HTMLImageElement, layer: number, width: number, height: number, mips: number) {
  // Une image paresseuse cachée ne se charge jamais d'elle-même.
  if (img.loading === "lazy") img.loading = "eager";
  await img.decode().catch(() => undefined);
  for (let m = 0; m < mips; m++) {
    const w = width >> m;
    const h = height >> m;
    const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex, mipLevel: m, origin: [0, 0, layer] }, [w, h]);
    bmp.close();
  }
}

const USAGE = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT;

/**
 * Agrandit un tableau de photos (des photos ajoutées en cours de route) :
 * un nouveau tableau, où l'on recopie les couches déjà là, sur le GPU.
 */
export function growPhotoArray(device: GPUDevice, tex: GPUTexture, layers: number) {
  if (layers <= tex.depthOrArrayLayers) return tex;
  const next = device.createTexture({ size: [tex.width, tex.height, layers], mipLevelCount: tex.mipLevelCount, format: tex.format, usage: USAGE });
  const enc = device.createCommandEncoder();
  for (let m = 0; m < tex.mipLevelCount; m++) {
    enc.copyTextureToTexture({ texture: tex, mipLevel: m }, { texture: next, mipLevel: m }, [tex.width >> m, tex.height >> m, tex.depthOrArrayLayers]);
  }
  device.queue.submit([enc.finish()]);
  tex.destroy();
  return next;
}

export async function loadPhotoArray(device: GPUDevice, imgs: HTMLImageElement[], width = 768, height = 512, mips = 4, capacity = imgs.length) {
  const tex = device.createTexture({
    size: [width, height, Math.max(1, capacity, imgs.length)],
    mipLevelCount: mips,
    format: "rgba8unorm",
    usage: USAGE,
  });
  let fast = 0;
  await Promise.all(
    imgs.map(async (img, layer) => {
      const strip = img.dataset.glMips;
      const ok = strip ? await fromStrip(device, tex, strip, layer, width, height, mips).catch(() => false) : false;
      if (ok) fast++;
      else await fromImage(device, tex, img, layer, width, height, mips);
    }),
  );
  return { tex, width, height, mips, fast };
}
