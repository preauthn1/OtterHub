import { MAX_CHUNK_SIZE } from "@shared/types";
import { resizeImageToCanvas } from "@/lib/utils/file";

export enum NSFWClass {
  Drawing = "Drawing",
  Hentai = "Hentai",
  Neutral = "Neutral",
  Porn = "Porn",
  Sexy = "Sexy",
}

export interface NSFWResult {
  isUnsafe: boolean;
  predictions: { className: NSFWClass; probability: number }[];
}

const MODEL_PATH = "MobileNetV2Mid";

type ProbMap = Record<NSFWClass, number>;

function toProbMap(predictions: Array<{ className: string; probability: number }>): ProbMap {
  const map: ProbMap = {
    Drawing: 0,
    Hentai: 0,
    Neutral: 0,
    Porn: 0,
    Sexy: 0,
  };

  for (const p of predictions) {
    map[p.className as NSFWClass] = p.probability;
  }
  return map;
}

function judgeUnsafe(p: ProbMap): boolean {
  const hard = p.Porn + p.Hentai;
  const soft = p.Sexy * (1 - p.Neutral);
  return hard * 3 + soft >= 1;
}

class NSFWDetector {
  private model?: any;
  private loading?: Promise<any>;

  private async getModel() {
    if (this.model) return this.model;
    if (!this.loading) {
      this.loading = (async () => {
        const [tf, nsfwjs] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("nsfwjs"),
        ]);
        try {
          tf.enableProdMode();
        } catch {
          // ignore
        }
        const m = await nsfwjs.load(MODEL_PATH);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 224;
        try {
          await m.classify(canvas);
        } catch {
          // ignore warm-up failure
        }
        this.model = m;
        return m;
      })();
    }
    return this.loading;
  }

  async detect(
    el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<boolean> {
    try {
      const model = await this.getModel();
      const predictions = await model.classify(el);
      const prob = toProbMap(predictions);
      return judgeUnsafe(prob);
    } catch (err) {
      console.warn("NSFW detect failed:", err);
      return false;
    }
  }

  async isUnsafeImg(file: File): Promise<boolean> {
    if (!file.type.startsWith("image/") || file.size > MAX_CHUNK_SIZE) {
      return false;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);

    try {
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = url;
      });
      const canvas = resizeImageToCanvas(img);
      return await this.detect(canvas);
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const nsfwDetector = new NSFWDetector();
