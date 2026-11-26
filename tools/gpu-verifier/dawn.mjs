// Vérificateur GPU — Dawn (paquet `webgpu`, WebGPU natif sans navigateur). Compile les modules WGSL pour de vrai et
// relit les messages du compilateur. Sans adaptateur (pas de GPU, pas de lavapipe) : { adaptateur: null }, l'appelant
// décide s'il s'agit d'un saut ou d'un échec.
import fs from "node:fs";
import os from "node:os";
import { trouverIcd } from "./coeur.ts";

const sonde = { existe: (p) => fs.existsSync(p), liste: (d) => { try { return fs.readdirSync(d); } catch { return []; } } };

export async function ouvrirDawn() {
  const icd = trouverIcd(process.env, process.platform, sonde, os.homedir());
  if (icd) process.env.VK_ICD_FILENAMES = process.env.VK_DRIVER_FILES = icd;
  let webgpu;
  try {
    webgpu = await import("webgpu");
  } catch {
    return { adaptateur: null, raison: "paquet `webgpu` absent (npm install)" };
  }
  try {
    Object.assign(globalThis, webgpu.globals);
    const gpu = webgpu.create([]);
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { adaptateur: null, raison: "aucun adaptateur WebGPU (installer lavapipe : apt install mesa-vulkan-drivers, ou npx vgpu install-software-renderer)" };
    const device = await adapter.requestDevice({ requiredFeatures: [...adapter.features] });
    const nom = adapter.info?.description || adapter.info?.device || "adaptateur inconnu";
    return { adaptateur: nom, device, fermer: () => device.destroy() };
  } catch (e) {
    return { adaptateur: null, raison: `Dawn indisponible : ${String(e?.message ?? e).split("\n")[0]}` };
  }
}

/** Map id → messages du compilateur pour chaque module. */
export async function compiler(device, modules) {
  const messages = new Map();
  for (const m of modules) {
    // Portée d'erreur : sinon Dawn recopie le shader entier sur stderr à chaque erreur (le rapport donne la ligne fautive).
    device.pushErrorScope("validation");
    const module = device.createShaderModule({ code: m.code });
    const info = await module.getCompilationInfo();
    await device.popErrorScope();
    messages.set(m.id, info.messages.map((x) => ({ type: x.type, lineNum: x.lineNum, offset: x.offset, length: x.length, message: x.message })));
  }
  return messages;
}
