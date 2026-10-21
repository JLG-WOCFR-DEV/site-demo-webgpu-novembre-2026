#!/usr/bin/env python3
"""Rend les vrais shaders PLI avec wgpu-native, sans navigateur.

Prérequis : Python 3.10+, Node avec --experimental-strip-types,
           pip install wgpu==0.32.0 numpy Pillow
Exécution depuis le dépôt : python tools/validate-sampler.py

Le script importe COMPOSITE et HIC_SHADER depuis les sources TypeScript. Il
précompose uniquement la texture d'entrée sur le CPU ; les traitements et leur
comparaison sont ceux des shaders du dépôt. Aucun DOM, contrôle de navigateur,
drawElementImageToTexture, hit-testing ou rendu de l'interface n'est simulé.
La planche JPEG est une visualisation des résultats natifs, pas une capture UI.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
import wgpu


ROOT = Path(__file__).resolve().parents[1]
NAMES = [
    "Gravure", "Contours Sobel", "Relief simulé", "Kaléidoscope",
    "Facettes polygonales", "VHS sobre", "Chrome simulé", "Iridescence",
    "Palette de luminance", "Flou radial", "Courbes de luminance", "Aurores",
]
STATIC = {0, 1, 4, 8, 10}
CENTER = {2, 3, 6, 7, 9, 11}
HTML_SAFE = {0, 1, 2, 6, 7, 8, 10, 11}
SAMPLES = [1, 8, 5, 1, 1, 3, 5, 5, 1, 12, 3, 1]
FORMAT = "rgba16float"
TOLERANCE = 0.001


def sha(value: bytes | str) -> str:
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def export_shaders(skip_hic: bool) -> dict:
    code = """
    const g = await import('./src/gpu/wgsl.ts');
    const e = await import('./src/gpu/sampler-effects.wgsl.ts');
    let h = {};
    if (process.argv[1] !== 'skip') h = await import('./src/html-in-canvas.ts');
    console.log(JSON.stringify({COMPOSITE:g.COMPOSITE, SHARED:e.SAMPLER_EFFECTS,
      HIC_SHADER:h.HIC_SHADER ?? null, TRACE_LAYERS:g.TRACE_LAYERS}));
    """
    data = json.loads(subprocess.check_output(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", code,
         "skip" if skip_hic else "hic"], cwd=ROOT, text=True,
    ))
    if not skip_hic and not data["HIC_SHADER"]:
        raise RuntimeError("HIC_SHADER n'est pas exporté ; --skip-hic limite explicitement la portée.")
    return data


def vec4_layout(code: str, name: str) -> tuple[dict[str, tuple[int, int]], int]:
    """Le Post actuel ne contient que vec4f et array<vec4f, N> (alignement 16)."""
    body = re.search(r"struct\s+" + name + r"\s*\{(.*?)\};", code, re.S)
    if not body:
        raise ValueError(f"Structure {name} absente")
    body = re.sub(r"//[^\n]*", "", body.group(1))
    fields = re.findall(r"(\w+)\s*:\s*(vec4f|array<vec4f,\s*(\d+)>)\s*,", body)
    if len(fields) != body.count(":"):
        raise ValueError("Post a changé : adapter explicitement son layout, sans deviner les offsets.")
    layout = {}
    offset = 0
    for field, _, count in fields:
        length = 4 * int(count or 1)
        layout[field] = (offset, length)
        offset += length
    return layout, offset


def build_scene(size: tuple[int, int], stage: tuple[int, int, int, int], alternate=False) -> np.ndarray:
    width, height = size
    x, y, w, h = stage
    yy, xx = np.indices((height, width))
    checker = ((xx // 23 + yy // 19) % 2).astype(bool)
    colors = ((0.82, 0.12, 0.46), (0.17, 0.80, 0.19)) if alternate else (
        (0.76, 0.20, 0.15), (0.07, 0.39, 0.55))
    scene = np.ones((height, width, 4), dtype=np.float16)
    scene[..., :3] = np.where(checker[..., None], colors[0], colors[1])
    with Image.open(ROOT / "public/plates/fig.jpg") as photo:
        fitted = ImageOps.fit(photo.convert("RGB"), (w, h), method=Image.Resampling.LANCZOS)
        scene[y:y+h, x:x+w, :3] = np.asarray(fitted, dtype=np.float32) / 255.0
    return scene


def metrics(a: np.ndarray, b: np.ndarray, mask=None) -> dict:
    delta = np.abs(a[..., :3].astype(np.float32) - b[..., :3].astype(np.float32))
    if mask is not None:
        delta = delta[mask]
    return {
        "mean_abs_rgb": float(np.mean(delta)),
        "max_abs_rgb": float(np.max(delta)),
        "fraction_rgb_over_1_255": float(np.mean(delta > 1.0 / 255.0)),
    }


def masks(size, stage):
    width, height = size
    x, y, w, h = stage
    inside = np.zeros((height, width), dtype=bool)
    inside[y:y+h, x:x+w] = True
    left = np.zeros_like(inside)
    left[y:y+h, x:x+w//2-2] = True
    right = np.zeros_like(inside)
    right[y:y+h, x+w//2+2:x+w] = True
    return inside, ~inside, left, right


class Native:
    def __init__(self):
        self.adapter = wgpu.gpu.request_adapter_sync(power_preference="low-power")
        self.device = self.adapter.request_device_sync()
        self.sampler = self.device.create_sampler(
            address_mode_u="clamp-to-edge", address_mode_v="clamp-to-edge",
            min_filter="linear", mag_filter="linear", mipmap_filter="nearest")

    def pipeline(self, code):
        shader = self.device.create_shader_module(code=code)
        return self.device.create_render_pipeline(
            layout="auto", vertex={"module": shader, "entry_point": "vs"},
            fragment={"module": shader, "entry_point": "fs", "targets": [{"format": FORMAT}]},
            primitive={"topology": "triangle-list"})

    def texture(self, image, layers=1):
        height, width = image.shape[:2]
        texture = self.device.create_texture(
            size=(width, height, layers), format=FORMAT,
            usage=wgpu.TextureUsage.TEXTURE_BINDING | wgpu.TextureUsage.COPY_DST)
        for layer in range(layers):
            self.device.queue.write_texture(
                {"texture": texture, "origin": (0, 0, layer)}, image.astype("<f2").tobytes(),
                {"bytes_per_row": width * 8, "rows_per_image": height}, (width, height, 1))
        return texture

    def target(self, size):
        return self.device.create_texture(size=(*size, 1), format=FORMAT,
            usage=wgpu.TextureUsage.RENDER_ATTACHMENT | wgpu.TextureUsage.COPY_SRC)

    def draw(self, pipeline, bind, target, size):
        encoder = self.device.create_command_encoder()
        render = encoder.begin_render_pass(color_attachments=[{
            "view": target.create_view(), "load_op": "clear", "store_op": "store",
            "clear_value": (0.0, 0.0, 0.0, 0.0),
        }])
        render.set_pipeline(pipeline)
        render.set_bind_group(0, bind)
        render.draw(3)
        render.end()
        self.device.queue.submit([encoder.finish()])
        width, height = size
        pitch = ((width * 8 + 255) // 256) * 256
        raw = self.device.queue.read_texture({"texture": target},
            {"bytes_per_row": pitch, "rows_per_image": height}, (width, height, 1))
        rows = np.frombuffer(raw, dtype=np.uint8).reshape(height, pitch)
        return rows[:, :width * 8].copy().view("<f2").reshape(height, width, 4).astype(np.float32)


class Composite:
    def __init__(self, gpu, code, size, stage, dpr, trace_layers):
        self.gpu, self.size, self.stage, self.dpr = gpu, size, stage, dpr
        self.layout, floats = vec4_layout(code, "Post")
        self.values = np.zeros(floats, dtype="<f4")
        self.pipeline = gpu.pipeline(code)
        self.uniform = gpu.device.create_buffer(size=self.values.nbytes,
            usage=wgpu.BufferUsage.UNIFORM | wgpu.BufferUsage.COPY_DST)
        self.scene_data = build_scene(size, stage)
        self.scene = gpu.texture(self.scene_data)
        self.dummy = gpu.texture(np.zeros((1, 1, 4), dtype=np.float16))
        self.trace = gpu.texture(np.zeros((1, 1, 4), dtype=np.float16), layers=trace_layers)
        self.target = gpu.target(size)
        self.bind = gpu.device.create_bind_group(layout=self.pipeline.get_bind_group_layout(0), entries=[
            {"binding": 0, "resource": {"buffer": self.uniform}},
            {"binding": 1, "resource": gpu.sampler},
            {"binding": 2, "resource": self.scene.create_view()},
            {"binding": 3, "resource": self.dummy.create_view()},
            {"binding": 4, "resource": self.dummy.create_view()},
            {"binding": 5, "resource": self.trace.create_view(dimension="2d-array")},
        ])

    def set(self, field, values):
        start, length = self.layout[field]
        if len(values) > length:
            raise ValueError(f"{field} dépasse sa capacité")
        self.values[start:start+len(values)] = values

    def upload_scene(self, scene):
        width, height = self.size
        self.gpu.device.queue.write_texture({"texture": self.scene}, scene.astype("<f2").tobytes(),
            {"bytes_per_row": width * 8, "rows_per_image": height}, (*self.size, 1))

    def render(self, mode=0, amount=1.0, time=1.25, scale=0.5, compare=False, point=(0.5, 0.5), global_time=0.0):
        self.values.fill(0.0)
        self.set("res", [*self.size, self.dpr, global_time])
        self.set("paper", [0.937, 0.933, 0.91, 0.0])
        self.set("stages", self.stage)
        self.set("kinds", [11.0])
        self.set("print", [0.0, 1.0, 0.0, 0.0])
        self.set("casse", [1.0, 1.0, 1.0, 16.0])
        self.set("explore", [mode, amount, scale, time])
        self.set("exploreCtl", [float(compare), 0.5, *point])
        self.gpu.device.queue.write_buffer(self.uniform, 0, self.values)
        return self.gpu.draw(self.pipeline, self.bind, self.target, self.size)


class HtmlShader:
    def __init__(self, gpu, code, image, dpr=1.0):
        self.gpu = gpu
        self.size = (image.shape[1], image.shape[0])
        self.dpr = dpr
        self.pipeline = gpu.pipeline(code)
        self.uniform = gpu.device.create_buffer(size=48,
            usage=wgpu.BufferUsage.UNIFORM | wgpu.BufferUsage.COPY_DST)
        self.texture = gpu.texture(image)
        self.target = gpu.target(self.size)
        self.bind = gpu.device.create_bind_group(layout=self.pipeline.get_bind_group_layout(0), entries=[
            {"binding": 0, "resource": gpu.sampler},
            {"binding": 1, "resource": self.texture.create_view()},
            {"binding": 2, "resource": {"buffer": self.uniform}},
        ])

    def render(self, mode=0, amount=1.0, force_raw=False, compare=False, active=True, time=1.25):
        values = np.zeros(12, dtype="<f4")
        values[:4] = [self.size[0]/self.dpr, self.size[1]/self.dpr, time, 0.5]
        values[4:8] = [amount, 0.5, float(compare), float(force_raw)]
        values[8:10] = [0.5, 0.5]
        values.view("<u4")[10:12] = [mode, int(active)]
        self.gpu.device.queue.write_buffer(self.uniform, 0, values)
        return self.gpu.draw(self.pipeline, self.bind, self.target, self.size)


def contact_sheet(source, results, stage, output, adapter):
    x, y, w, h = stage
    tile_w, tile_h = 248, round(248 * h / w)
    gap, label_h, top = 16, 29, 92
    sheet = Image.new("RGB", (4 * tile_w + 5 * gap, top + 4 * (tile_h + label_h + gap) + 38), "#eeeae1")
    draw = ImageDraw.Draw(sheet)
    try:
        title = ImageFont.truetype("DejaVuSans.ttf", 24)
        label = ImageFont.truetype("DejaVuSans.ttf", 14)
        small = ImageFont.truetype("DejaVuSans.ttf", 12)
    except OSError:
        title = label = small = ImageFont.load_default()
    draw.text((gap, 16), "PLI · Douze effets WGSL", font=title, fill="#182b35")
    draw.text((gap, 51), "Rendus natifs hors navigateur · photo fig.jpg · quantité 100 % · échelle 50 %", font=small, fill="#304955")
    backend = adapter.get("backend_type", "inconnu")
    kind = "adaptateur logiciel" if adapter.get("adapter_type") == "CPU" else "adaptateur natif"
    draw.text((gap, 69), f"COMPOSITE réel, stage 11 · wgpu-native / {backend} · {kind} · aucun DOM", font=small, fill="#304955")
    for index, (name, array) in enumerate([("Source", source)] + list(zip(NAMES, results))):
        col, row = index % 4, index // 4
        left, upper = gap + col * (tile_w + gap), top + row * (tile_h + label_h + gap)
        rgb = np.rint(np.clip(array[y:y+h, x:x+w, :3], 0, 1) * 255).astype(np.uint8)
        tile = Image.fromarray(rgb).resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        sheet.paste(tile, (left, upper))
        draw.text((left, upper + tile_h + 7), name, font=label, fill="#182b35")
    left = gap + tile_w + gap
    upper = top + 3 * (tile_h + label_h + gap) + 16
    notes = ["Les images proviennent du pipeline WGSL natif,",
             "pas des captures du site ou d'un navigateur.", "",
             "Relief et chrome : hauteur issue de la luminance.",
             "Iridescence et aurores : interprétations graphiques.",
             "Aucune mesure de performances matérielles."]
    for line in notes:
        draw.text((left, upper), line, font=label, fill="#304955")
        upper += 23
    for quality in (89, 85, 80, 75, 68):
        sheet.save(output, "JPEG", quality=quality, optimize=True, progressive=True)
        if output.stat().st_size < 400_000:
            break
    return {"path": "docs/sampler-apercu.jpg", "bytes": output.stat().st_size,
            "dimensions": list(sheet.size), "jpeg_quality": quality}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "docs")
    parser.add_argument("--skip-hic", action="store_true", help="Limite explicitement la QA à COMPOSITE.")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    shaders = export_shaders(args.skip_hic)
    gpu = Native()
    report = {
        "schema_version": 1,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "scope": "Native rendering of full COMPOSITE stage kind 11 and HIC_SHADER; no browser",
        "adapter": dict(gpu.adapter.info),
        "versions": {"wgpu": wgpu.__version__, "numpy": np.__version__},
        "formats": {"scene": FORMAT, "render_target": FORMAT, "readback": "float16 converted to float32"},
        "fixture": {"photo": "public/plates/fig.jpg", "sha256": sha((ROOT / "public/plates/fig.jpg").read_bytes()),
                    "precomposition": "CPU cover crop of the repository photo; contrasting checker margins"},
        "shader_sha256": {key: sha(value) for key, value in shaders.items() if isinstance(value, str)},
        "source_sha256": {path: sha((ROOT / path).read_bytes()) for path in [
            "src/gpu/wgsl.ts", "src/gpu/sampler-effects.wgsl.ts", "src/html-in-canvas.ts", "tools/validate-sampler.py"]},
        "checks": [], "modes": [], "tolerance": TOLERANCE,
        "limits": [
            "No browser execution, screenshot, DOM capture or drawElementImageToTexture validation.",
            "No keyboard, pointer hit-testing, accessibility-tree or fallback lifecycle validation.",
            "The scene is CPU-precomposed; the JavaScript engine's uniform upload and layout are not exercised.",
            "COMPOSITE samples the visible viewport scene; partially offscreen photographs may repeat the visible edge during distortions.",
            "Native adapter only; no physical GPU, cross-browser or hardware performance claim.",
            "Only sampler kind 11 is exercised; unrelated COMPOSITE effects are disabled and dummy textures are bound.",
            "JPEG is a visual preview; numeric checks use uncompressed float16 GPU readbacks.",
        ],
    }

    def check(name, passed, **details):
        report["checks"].append({"name": name, "passed": bool(passed), **details})

    size, stage = (640, 560), (32, 40, 576, 480)
    renderer = Composite(gpu, shaders["COMPOSITE"], size, stage, 1.0, shaders["TRACE_LAYERS"])
    inside, outside, left, right = masks(size, stage)
    reference = renderer.render(amount=0.0)
    raw_metric = metrics(reference, renderer.scene_data)
    check("composite_amount0_matches_uploaded_scene", raw_metric["max_abs_rgb"] <= TOLERANCE, **raw_metric)
    report["post_layout"] = {"bytes": renderer.values.nbytes,
        "fields_float_offsets": {key: list(value) for key, value in renderer.layout.items()}}
    report["primary"] = {"pixels": list(size), "stage_pixels": list(stage), "dpr": 1.0,
        "time_seconds": 1.25, "scale": 0.5, "point": [0.5, 0.5], "amount": 1.0}
    print("COMPOSITE complet compilé ; rendu des douze modes.", flush=True)
    results = []
    for mode, name in enumerate(NAMES):
        image = renderer.render(mode=mode)
        results.append(image)
        change = metrics(image, reference, inside)
        check(f"mode_{mode}_finite", np.isfinite(image).all())
        check(f"mode_{mode}_visible_difference", change["mean_abs_rgb"] > 0.001, **change)
        outer = metrics(image, reference, outside)
        check(f"mode_{mode}_outside_unchanged", outer["max_abs_rgb"] == 0.0, **outer)
        zero = metrics(renderer.render(mode=mode, amount=0), reference)
        check(f"mode_{mode}_amount0_exact", zero["max_abs_rgb"] == 0.0, **zero)
        split = renderer.render(mode=mode, compare=True)
        left_metric, right_metric = metrics(split, reference, left), metrics(split, image, right)
        check(f"mode_{mode}_split_left_exact", left_metric["max_abs_rgb"] == 0.0, **left_metric)
        check(f"mode_{mode}_split_right_exact", right_metric["max_abs_rgb"] == 0.0, **right_metric)
        later = metrics(renderer.render(mode=mode, time=3.75), image, inside)
        expected = later["max_abs_rgb"] == 0.0 if mode in STATIC else later["mean_abs_rgb"] > 0.00001
        check(f"mode_{mode}_time_contract", expected, expected="static" if mode in STATIC else "animated", **later)
        paused = metrics(renderer.render(mode=mode, global_time=1200.0), image, inside)
        check(f"mode_{mode}_local_clock_frozen", paused["max_abs_rgb"] == 0.0, **paused)
        if mode in CENTER:
            point_metric = metrics(renderer.render(mode=mode, point=(0.23, 0.31)), image, inside)
            check(f"mode_{mode}_center_responds", point_metric["mean_abs_rgb"] > 0.00001, **point_metric)
        report["modes"].append({"id": mode, "name": name, "static": mode in STATIC,
            "max_source_samples": SAMPLES[mode], "difference_from_source": change, "time_difference": later})

    pairwise = [{"a": a, "b": b, **metrics(results[a], results[b], inside)}
                for a in range(12) for b in range(a + 1, 12)]
    closest = min(pairwise, key=lambda item: item["mean_abs_rgb"])
    report["pairwise"] = pairwise
    check("all_12_modes_distinct", closest["mean_abs_rgb"] > 0.001, closest_pair=closest)
    renderer.upload_scene(build_scene(size, stage, alternate=True))
    for mode in range(12):
        leakage = metrics(renderer.render(mode=mode), results[mode], inside)
        check(f"mode_{mode}_does_not_sample_margins", leakage["max_abs_rgb"] <= TOLERANCE, **leakage)
    renderer.upload_scene(renderer.scene_data)
    print("Identités, comparaison, temps et clamp vérifiés ; contrôle DPR 2 / ratio portrait.", flush=True)

    second_size, second_stage = (576, 768), (48, 48, 480, 672)
    second = Composite(gpu, shaders["COMPOSITE"], second_size, second_stage, 2.0, shaders["TRACE_LAYERS"])
    _, second_outside, _, _ = masks(second_size, second_stage)
    second_reference = second.render(amount=0.0)
    report["secondary"] = {"pixels": list(second_size), "stage_pixels": list(second_stage),
        "dpr": 2.0, "scales": [0.0, 1.0], "point": [0.0, 1.0]}
    for mode in range(12):
        for scale in (0.0, 1.0):
            image = second.render(mode=mode, scale=scale, point=(0.0, 1.0))
            outer = metrics(image, second_reference, second_outside)
            check(f"mode_{mode}_dpr2_scale_{scale:g}", np.isfinite(image).all() and outer["max_abs_rgb"] == 0.0,
                  finite=bool(np.isfinite(image).all()), outside=outer)

    if args.skip_hic:
        report["html_in_canvas"] = {"status": "explicitly_skipped"}
    else:
        print("Compilation et garde-fous du shader HTML-in-Canvas, sans capture DOM.", flush=True)
        x, y, w, h = stage
        html = HtmlShader(gpu, shaders["HIC_SHADER"], renderer.scene_data[y:y+h, x:x+w], dpr=1.0)
        html_raw = html.render(force_raw=True)
        html_legacy = html.render(active=False)
        legacy_delta = metrics(html_legacy, html_raw)
        check("hic_inactive_keeps_legacy_trame", legacy_delta["mean_abs_rgb"] > 0.001, **legacy_delta)
        report["html_in_canvas"] = {"status": "native_shader_only", "pixels": [w, h], "uniform_bytes": 48,
            "safe_modes": sorted(HTML_SAFE), "unsafe_modes": sorted(set(range(12)) - HTML_SAFE),
            "inactive_behavior": "The historical halftone is preserved; forceRaw overrides it",
            "input": "Opaque repository photo, not a browser-captured DOM element"}
        for mode in range(12):
            full = html.render(mode=mode)
            delta = metrics(full, html_raw)
            check(f"hic_mode_{mode}_finite", np.isfinite(full).all())
            if mode in HTML_SAFE:
                check(f"hic_mode_{mode}_treatment", delta["mean_abs_rgb"] > 0.001, **delta)
            else:
                check(f"hic_mode_{mode}_unsafe_raw", delta["max_abs_rgb"] == 0.0, **delta)
            for label, params in [("amount0", {"amount": 0.0}), ("focus_raw", {"force_raw": True}),
                                  ("inactive_focus_raw", {"active": False, "force_raw": True})]:
                delta = metrics(html.render(mode=mode, **params), html_raw)
                check(f"hic_mode_{mode}_{label}", delta["max_abs_rgb"] == 0.0, **delta)
            delta = metrics(html.render(mode=mode, active=False), html_legacy)
            check(f"hic_mode_{mode}_inactive_legacy", delta["max_abs_rgb"] == 0.0, **delta)
            split = html.render(mode=mode, compare=True)
            delta = metrics(split[:, :w//2-2], html_raw[:, :w//2-2])
            check(f"hic_mode_{mode}_split_left_raw", delta["max_abs_rgb"] == 0.0, **delta)

    latest = export_shaders(args.skip_hic)
    check("shader_sources_unchanged_during_run", all(
        latest[key] == value for key, value in shaders.items() if isinstance(value, str)))
    report["source_sha256"] = {path: sha((ROOT / path).read_bytes()) for path in report["source_sha256"]}
    report["preview"] = contact_sheet(reference, results, stage, args.output_dir / "sampler-apercu.jpg", report["adapter"])
    check("preview_under_400000_bytes", report["preview"]["bytes"] < 400_000)
    report["status"] = "passed" if all(item["passed"] for item in report["checks"]) else "failed"
    report["check_count"] = len(report["checks"])
    report["failed_checks"] = [item["name"] for item in report["checks"] if not item["passed"]]
    path = args.output_dir / "sampler-validation.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "checks": report["check_count"],
        "failed": report["failed_checks"], "preview_bytes": report["preview"]["bytes"],
        "report": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)}, ensure_ascii=False), flush=True)
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
