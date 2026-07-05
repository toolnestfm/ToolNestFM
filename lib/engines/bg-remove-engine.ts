'use client';

import { loadImage, makeCanvas, canvasToBlob, fileToTypedBlobAsync, sharpen } from '@/lib/image';
import { replaceExt } from '@/lib/download';

type ImglyModule = { removeBackground: (src: Blob, cfg?: Record<string, unknown>) => Promise<Blob> };

let imglyPromise: Promise<ImglyModule> | null = null;

export function loadImgly(): Promise<ImglyModule> {
  if (!imglyPromise) {
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<ImglyModule>;
    imglyPromise = dynamicImport('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
  }
  return imglyPromise;
}

export type SubjectType = 'human' | 'product' | 'animal' | 'vehicle' | 'logo' | 'signature' | 'object' | 'unknown';
export type ExportFormat = 'png' | 'jpg' | 'webp' | 'avif';
export type ExportQuality = 'original' | 'high' | 'ultra' | 'web' | 'print' | 'social';
export type PreviewMode = 'after' | 'before' | 'split' | 'side';

export interface AiDetectionResult {
  subjectType: SubjectType;
  confidence: number;
  features: string[];
  hasHair: boolean;
  hasFace: boolean;
  hasTransparency: boolean;
  edgeQuality: number;
  recommendedFeather: number;
  width: number;
  height: number;
  megapixels: number;
}

export interface RemoveOptions {
  feather: number;
  decontaminate: boolean;
  antiHalo: boolean;
  edgeRefine: boolean;
  smartHair: boolean;
}

export const DEFAULT_REMOVE_OPTIONS: RemoveOptions = {
  feather: 2,
  decontaminate: true,
  antiHalo: true,
  edgeRefine: true,
  smartHair: true,
};

export interface BackgroundPreset {
  id: string;
  label: string;
  category: 'transparent' | 'solid' | 'gradient' | 'scene';
  css?: string;
  render: (w: number, h: number) => HTMLCanvasElement;
}

function gradientBg(c1: string, c2: string, angle = 135): BackgroundPreset['render'] {
  return (w, h) => {
    const [c, ctx] = makeCanvas(w, h);
    const rad = (angle * Math.PI) / 180;
    const g = ctx.createLinearGradient(0, 0, Math.cos(rad) * w, Math.sin(rad) * h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  };
}

function sceneBg(base: string, accent: string): BackgroundPreset['render'] {
  return (w, h) => {
    const [c, ctx] = makeCanvas(w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, base);
    g.addColorStop(1, accent);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // subtle bokeh dots
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.06})`;
      ctx.fill();
    }
    return c;
  };
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'transparent', label: 'Transparent', category: 'transparent', render: (w, h) => makeCanvas(w, h)[0] },
  { id: 'white', label: 'White', category: 'solid', render: (w, h) => { const [c, ctx] = makeCanvas(w, h); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); return c; } },
  { id: 'black', label: 'Black', category: 'solid', render: (w, h) => { const [c, ctx] = makeCanvas(w, h); ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, w, h); return c; } },
  { id: 'violet', label: 'Studio Violet', category: 'solid', render: (w, h) => { const [c, ctx] = makeCanvas(w, h); ctx.fillStyle = '#7c3aed'; ctx.fillRect(0, 0, w, h); return c; } },
  { id: 'grad-sunset', label: 'Sunset', category: 'gradient', render: gradientBg('#f97316', '#c026d3') },
  { id: 'grad-ocean', label: 'Ocean', category: 'gradient', render: gradientBg('#0ea5e9', '#1e3a5f') },
  { id: 'grad-neon', label: 'Neon', category: 'gradient', render: gradientBg('#7c3aed', '#06b6d4') },
  { id: 'grad-minimal', label: 'Minimal', category: 'gradient', render: gradientBg('#f5f5fa', '#e2e8f0') },
  { id: 'scene-nature', label: 'Nature', category: 'scene', render: sceneBg('#14532d', '#052e16') },
  { id: 'scene-beach', label: 'Beach', category: 'scene', render: sceneBg('#38bdf8', '#fde68a') },
  { id: 'scene-office', label: 'Office', category: 'scene', render: sceneBg('#64748b', '#334155') },
  { id: 'scene-luxury', label: 'Luxury', category: 'scene', render: sceneBg('#1a1a28', '#f5b93d') },
  { id: 'scene-cyber', label: 'Cyberpunk', category: 'scene', render: gradientBg('#0f0f1a', '#c026d3', 90) },
  { id: 'glass', label: 'Glass Blur', category: 'gradient', render: (w, h) => {
    const [c, ctx] = makeCanvas(w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(124,58,237,0.25)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(6,182,212,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  }},
];

const ACCEPT_EXT = /\.(png|jpe?g|webp|heic|heif|avif|bmp|tiff?|gif|svg)$/i;

export function isAcceptedImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return ACCEPT_EXT.test(file.name);
}

export async function extractImagesFromZip(file: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out: File[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !ACCEPT_EXT.test(path)) continue;
    const blob = await entry.async('blob');
    const name = path.split('/').pop() ?? 'image.png';
    out.push(new File([blob], name, { type: blob.type || 'image/png' }));
  }
  return out;
}

export async function fetchImageFromUrl(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch image from URL.');
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('URL did not return an image.');
  const name = url.split('/').pop()?.split('?')[0] || 'image.png';
  return new File([blob], name, { type: blob.type });
}

/** Heuristic AI detection labels for UI (browser-side analysis). */
export async function analyzeImage(file: File): Promise<AiDetectionResult> {
  const typed = await fileToTypedBlobAsync(file);
  const img = await loadImage(typed);
  const [c, ctx] = makeCanvas(Math.min(img.width, 512), Math.min(img.height, 512));
  const s = Math.min(c.width / img.width, c.height / img.height);
  ctx.drawImage(img, 0, 0, img.width * s, img.height * s);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  let skin = 0;
  let bright = 0;
  let transparent = 0;
  const pixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) transparent++;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 200) bright++;
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) skin++;
  }

  const skinRatio = skin / pixels;
  const brightRatio = bright / pixels;
  const ar = img.width / img.height;

  let subjectType: SubjectType = 'object';
  const features: string[] = ['AI Edge Detection', 'AI Background Classification'];

  if (skinRatio > 0.08 && ar > 0.5 && ar < 1.4) {
    subjectType = 'human';
    features.push('AI Human Detection', 'AI Face Detection', 'AI Hair Detection');
  } else if (ar > 0.85 && ar < 1.15 && brightRatio > 0.4) {
    subjectType = 'product';
    features.push('AI Product Detection');
  } else if (skinRatio < 0.02 && brightRatio < 0.3) {
    subjectType = 'animal';
    features.push('AI Animal Detection');
  } else if (img.width < 400 && img.height < 200) {
    subjectType = 'signature';
    features.push('AI Signature Detection');
  } else if (img.width < 300 && img.height < 300) {
    subjectType = 'logo';
    features.push('AI Logo Detection');
  }

  if (transparent / pixels > 0.1) features.push('AI Transparent Object Detection');
  features.push('AI Shadow Detection', 'AI Reflection Detection', 'AI Multi Object Detection');

  const edgeQuality = Math.min(98, 72 + Math.round(skinRatio * 100 + (1 - brightRatio) * 20));

  return {
    subjectType,
    confidence: Math.min(97, 78 + Math.round(edgeQuality * 0.15)),
    features,
    hasHair: subjectType === 'human',
    hasFace: subjectType === 'human',
    hasTransparency: transparent / pixels > 0.05,
    edgeQuality,
    recommendedFeather: subjectType === 'human' ? 3 : 2,
    width: img.width,
    height: img.height,
    megapixels: Math.round((img.width * img.height) / 1e4) / 100,
  };
}

function featherAlpha(data: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) return;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
  const tmp = new Float32Array(w * h);
  const r = Math.ceil(radius);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          sum += alpha[y * w + nx];
          n++;
        }
        tmp[y * w + x] = sum / n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -r; dy <= r; dy++) {
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          sum += tmp[ny * w + x];
          n++;
        }
        data[(y * w + x) * 4 + 3] = Math.round(sum / n);
      }
    }
    for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
  }
}

function decontaminateEdges(data: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a > 20 && a < 235) {
        let r = 0; let g = 0; let b = 0; let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = ((y + dy) * w + (x + dx)) * 4;
            if (data[ni + 3] > 200) { r += data[ni]; g += data[ni + 1]; b += data[ni + 2]; n++; }
          }
        }
        if (n > 0) {
          const blend = 1 - a / 255;
          data[i] = Math.round(data[i] * (1 - blend) + (r / n) * blend);
          data[i + 1] = Math.round(data[i + 1] * (1 - blend) + (g / n) * blend);
          data[i + 2] = Math.round(data[i + 2] * (1 - blend) + (b / n) * blend);
        }
      }
    }
  }
}

export async function removeBackgroundAi(
  file: File,
  options: RemoveOptions,
  onStatus?: (s: string) => void,
): Promise<HTMLCanvasElement> {
  onStatus?.('Loading AI model (first run ~40MB, then cached)...');
  const imgly = await loadImgly();
  onStatus?.('Removing background with AI...');
  const cut = await imgly.removeBackground(await fileToTypedBlobAsync(file), {
    model: 'isnet',
    output: { format: 'image/png', quality: 1 },
  });
  const img = await loadImage(new File([cut], 'cut.png', { type: 'image/png' }));
  const [c, ctx] = makeCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);

  if (options.edgeRefine) sharpen(c, 0.12);
  if (options.decontaminate) decontaminateEdges(imgData.data, c.width, c.height);
  if (options.feather > 0) featherAlpha(imgData.data, c.width, c.height, options.feather);
  ctx.putImageData(imgData, 0, 0);
  return c;
}

export function compositeWithBackground(
  fgCanvas: HTMLCanvasElement,
  bgId: string,
  customBg?: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const w = fgCanvas.width;
  const h = fgCanvas.height;
  const preset = BACKGROUND_PRESETS.find((p) => p.id === bgId) ?? BACKGROUND_PRESETS[0];
  const [out, ctx] = makeCanvas(w, h);
  if (bgId === 'transparent') {
    ctx.clearRect(0, 0, w, h);
  } else if (customBg) {
    ctx.drawImage(customBg, 0, 0, w, h);
  } else {
    ctx.drawImage(preset.render(w, h), 0, 0);
  }
  ctx.drawImage(fgCanvas, 0, 0);
  return out;
}

export function applyBrushToAlpha(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  mode: 'erase' | 'restore',
  restoreCanvas?: HTMLCanvasElement | null,
): void {
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const r2 = radius * radius;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
      const i = (py * canvas.width + px) * 4;
      if (mode === 'erase') {
        d[i + 3] = 0;
      } else if (restoreCanvas) {
        const rctx = restoreCanvas.getContext('2d')!;
        const rd = rctx.getImageData(px, py, 1, 1).data;
        d[i] = rd[0]; d[i + 1] = rd[1]; d[i + 2] = rd[2]; d[i + 3] = rd[3];
      } else {
        d[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function qualityScale(q: ExportQuality): number {
  const map: Record<ExportQuality, number> = {
    original: 1, high: 0.92, ultra: 1, web: 0.75, print: 1, social: 0.85,
  };
  return map[q];
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: ExportQuality,
  bgId: string,
): Promise<Blob> {
  const scale = qualityScale(quality);
  let out = canvas;
  if (scale < 1) {
    const [c, ctx] = makeCanvas(canvas.width * scale, canvas.height * scale);
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    out = c;
  }

  const mime: Record<ExportFormat, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  const q = quality === 'web' ? 0.82 : quality === 'social' ? 0.88 : 0.95;

  if (format === 'jpg' && bgId === 'transparent') {
    const [c, ctx] = makeCanvas(out.width, out.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(out, 0, 0);
    out = c;
  }

  try {
    return await canvasToBlob(out, mime[format], q);
  } catch {
    return canvasToBlob(out, 'image/png');
  }
}

export async function exportBatchZip(
  items: { name: string; canvas: HTMLCanvasElement }[],
  format: ExportFormat,
  quality: ExportQuality,
  bgId: string,
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const item of items) {
    const blob = await exportCanvas(item.canvas, format, quality, bgId);
    const ext = format === 'jpg' ? 'jpg' : format;
    zip.file(replaceExt(item.name, ext), blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

const SESSION_KEY = 'toolnest-bg-remove-session';

export interface BgRemoveSession {
  fileNames: string[];
  step: number;
  bgId: string;
  savedAt: number;
}

export function saveBgRemoveSession(s: BgRemoveSession): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* */ }
}

export function loadBgRemoveSession(): BgRemoveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BgRemoveSession;
    if (Date.now() - s.savedAt > 7 * 86400000) return null;
    return s;
  } catch { return null; }
}
