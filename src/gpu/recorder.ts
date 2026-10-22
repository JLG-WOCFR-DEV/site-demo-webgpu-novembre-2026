import { ArrayBufferTarget, Muxer } from "webm-muxer";

export type RecordOptions = {
  fps: number;
  seconds: number;
  onProgress?: (done: number, total: number) => void;
  onDone: (video: Blob | null, error?: string) => void;
};

type Slot = { buf: GPUBuffer; busy: boolean };

/** Enregistrement en cours, s'il y en a un : son horloge virtuelle remplace performance.now(). */
let active: Recorder | null = null;
/**
 * L'horloge des animations. Pendant une capture, elle avance d'un pas fixe par
 * image rendue ; sinon, c'est performance.now(). Toute animation qui veut
 * apparaître juste dans une vidéo doit lire l'heure ici.
 */
export function clockNow() {
  return active ? active.now : performance.now();
}

/**
 * Enregistreur à pas fixe. À chaque image, le moteur copie la texture du
 * canvas dans un tampon (copyTextureToBuffer), puis le recorder la lit et
 * l'encode en VP9, horodatée n / fps. L'horloge du moteur n'avance que si
 * l'image a pu être copiée : la vidéo dure exactement `seconds`, image par
 * image, même si le rendu réel a pris dix fois plus de temps.
 *
 * Pourquoi pas new VideoFrame(canvas) : sur un canvas WebGPU, l'image peut
 * déjà être rendue au compositeur ; selon le pilote, on lit du noir.
 */
export class Recorder {
  now: number;
  done = false;
  private n = 0;
  private queued = 0;
  private total: number;
  private step: number;
  private width: number;
  private height: number;
  private stride: number;
  private slots: Slot[] = [];
  private pending: Slot | null = null;
  private chain: Promise<void> = Promise.resolve();
  private encoder: VideoEncoder | null = null;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private reported = false;

  constructor(
    private device: GPUDevice,
    canvas: HTMLCanvasElement,
    private format: GPUTextureFormat,
    start: number,
    private o: RecordOptions,
  ) {
    this.now = start;
    active = this;
    this.total = Math.max(1, Math.round(o.fps * o.seconds));
    this.step = 1000 / o.fps;
    // VP9 exige des dimensions paires ; les lignes copiées sont alignées sur 256 octets.
    this.width = canvas.width & ~1;
    this.height = canvas.height & ~1;
    this.stride = Math.ceil((this.width * 4) / 256) * 256;
    if (typeof VideoEncoder === "undefined") {
      this.fail("WebCodecs absent de ce navigateur");
      return;
    }
    for (let i = 0; i < 4; i++) {
      this.slots.push({ buf: device.createBuffer({ size: this.stride * this.height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), busy: false });
    }
    this.muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "V_VP9", width: this.width, height: this.height, frameRate: o.fps } });
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          this.muxer?.addVideoChunk(chunk, meta);
        } catch (e) {
          this.fail(String(e));
        }
      },
      error: (e) => this.fail(String(e)),
    });
    this.encoder.configure({ codec: "vp09.00.10.08", width: this.width, height: this.height, bitrate: 12_000_000, framerate: o.fps });
  }

  /** Avant la fin de l'encodeur de commandes : copie de l'image du canvas, si un tampon est libre. */
  copy(enc: GPUCommandEncoder, tex: GPUTexture) {
    this.pending = null;
    if (this.done || this.queued >= this.total || tex.width < this.width || tex.height < this.height) return;
    const slot = this.slots.find((s) => !s.busy);
    if (!slot) return; // tous les tampons sont en lecture : on rejoue la même image
    slot.busy = true;
    enc.copyTextureToBuffer({ texture: tex }, { buffer: slot.buf, bytesPerRow: this.stride }, [this.width, this.height]);
    this.pending = slot;
  }

  /** Après submit : lecture asynchrone, encodage dans l'ordre, horloge avancée d'un pas. */
  afterSubmit() {
    const slot = this.pending;
    this.pending = null;
    if (!slot) return;
    const i = this.queued++;
    this.now += this.step;
    const read = slot.buf.mapAsync(GPUMapMode.READ);
    this.chain = this.chain.then(async () => {
      try {
        await read;
        if (this.reported) return;
        const data = new Uint8Array(slot.buf.getMappedRange()).slice();
        slot.buf.unmap();
        slot.busy = false;
        const frame = new VideoFrame(data, {
          format: this.format === "bgra8unorm" ? "BGRX" : "RGBX",
          codedWidth: this.width,
          codedHeight: this.height,
          layout: [{ offset: 0, stride: this.stride }],
          timestamp: Math.round((i * 1e6) / this.o.fps),
          duration: Math.round(1e6 / this.o.fps),
        });
        this.encoder?.encode(frame, { keyFrame: i % (this.o.fps * 2) === 0 });
        frame.close();
        this.n++;
        this.o.onProgress?.(this.n, this.total);
        if (this.n >= this.total) await this.finish();
      } catch (e) {
        this.fail(String(e));
      }
    });
    if (this.queued >= this.total) this.release();
  }

  private release() {
    this.done = true;
    if (active === this) active = null;
  }

  stop() {
    this.release();
    this.total = this.queued;
    this.chain = this.chain.then(() => this.finish());
  }

  private report(video: Blob | null, error?: string) {
    if (this.reported) return;
    this.reported = true;
    for (const s of this.slots) s.buf.destroy();
    this.o.onDone(video, error);
  }

  private fail(msg: string) {
    console.warn("[pli] capture :", msg);
    this.release();
    this.report(null, msg);
  }

  private async finish() {
    if (this.reported) return;
    try {
      await this.encoder?.flush();
      this.encoder?.close();
      this.muxer?.finalize();
      const buf = this.muxer?.target.buffer;
      this.report(buf && this.n ? new Blob([buf], { type: "video/webm" }) : null, buf && this.n ? undefined : "aucune image");
    } catch (e) {
      this.fail(String(e));
    }
  }
}

/**
 * Capture pour une page qui a sa propre boucle WebGPU (pages Kerguéhennec) :
 * copy() juste avant submit, after() juste après. Le canvas doit être
 * configuré avec GPUTextureUsage.COPY_SRC.
 */
export function recordable(device: GPUDevice, canvas: HTMLCanvasElement, format: GPUTextureFormat) {
  let rec: Recorder | null = null;
  return {
    copy(enc: GPUCommandEncoder, tex: GPUTexture) {
      rec?.copy(enc, tex);
    },
    after() {
      if (!rec) return;
      rec.afterSubmit();
      if (rec.done) rec = null;
    },
    caps: {
      record: (o: RecordOptions) => {
        if (rec) return false;
        rec = new Recorder(device, canvas, format, performance.now(), o);
        return true;
      },
      stopRecord: () => rec?.stop(),
    },
  };
}
