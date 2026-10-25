/**
 * Un tableau de textures pour une série de photos, avec sa chaîne de
 * mipmaps : chaque niveau est réduit par le navigateur (createImageBitmap),
 * pour qu'une vignette lue dans une grande texture ne scintille pas.
 */
export async function loadPhotoArray(device: GPUDevice, imgs: HTMLImageElement[], width = 768, height = 512, mips = 4) {
  const tex = device.createTexture({
    size: [width, height, imgs.length],
    mipLevelCount: mips,
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  await Promise.all(
    imgs.map(async (img, layer) => {
      await img.decode().catch(() => undefined);
      for (let m = 0; m < mips; m++) {
        const w = width >> m;
        const h = height >> m;
        const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
        device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex, mipLevel: m, origin: [0, 0, layer] }, [w, h]);
        bmp.close();
      }
    }),
  );
  return { tex, width, height, mips };
}
