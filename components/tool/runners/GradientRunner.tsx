'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useUI } from '@/components/GlobalUI';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Stop { id: number; color: string; pos: number }
type GType = 'linear' | 'radial' | 'conic' | 'mesh' | 'aurora' | 'noise';
type AnimMode = 'none' | 'shift' | 'wave' | 'hue' | 'pulse' | 'zoom';

interface GState {
  type: GType;
  angle: number;
  stops: Stop[];
  anim: AnimMode;
  speed: number; // seconds per loop
}

const ANIMS: Array<{ id: AnimMode; label: string }> = [
  { id: 'none', label: 'Off' },
  { id: 'shift', label: 'Shift' },
  { id: 'wave', label: 'Wave' },
  { id: 'hue', label: 'Hue spin' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'zoom', label: 'Zoom' },
];

const ANIM_KEYFRAMES: Record<Exclude<AnimMode, 'none'>, string> = {
  shift: `@keyframes tn-grad-shift {\n  0%, 100% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n}`,
  wave: `@keyframes tn-grad-wave {\n  0%, 100% { background-position: 0% 0%; }\n  25% { background-position: 100% 50%; }\n  50% { background-position: 50% 100%; }\n  75% { background-position: 0% 50%; }\n}`,
  hue: `@keyframes tn-grad-hue {\n  to { filter: hue-rotate(360deg); }\n}`,
  pulse: `@keyframes tn-grad-pulse {\n  0%, 100% { filter: brightness(1); }\n  50% { filter: brightness(1.25) saturate(1.35); }\n}`,
  zoom: `@keyframes tn-grad-zoom {\n  0%, 100% { background-size: 160% 160%; background-position: 50% 50%; }\n  50% { background-size: 280% 280%; background-position: 62% 38%; }\n}`,
};

function animStyle(anim: AnimMode, speed: number): React.CSSProperties {
  switch (anim) {
    case 'shift': return { backgroundSize: '200% 200%', animation: `tn-grad-shift ${speed}s ease infinite` };
    case 'wave': return { backgroundSize: '300% 300%', animation: `tn-grad-wave ${speed}s ease-in-out infinite` };
    case 'hue': return { backgroundSize: 'auto', animation: `tn-grad-hue ${speed}s linear infinite` };
    case 'pulse': return { backgroundSize: 'auto', animation: `tn-grad-pulse ${speed}s ease-in-out infinite` };
    case 'zoom': return { backgroundSize: '160% 160%', animation: `tn-grad-zoom ${speed}s ease-in-out infinite` };
    default: return { backgroundSize: 'auto', animation: 'none' };
  }
}

function animCSSBlock(anim: AnimMode, speed: number): string {
  if (anim === 'none') return '';
  const size = anim === 'wave' ? '300% 300%' : anim === 'shift' ? '200% 200%' : anim === 'zoom' ? '160% 160%' : '';
  const timing = anim === 'hue' ? 'linear' : anim === 'shift' ? 'ease' : 'ease-in-out';
  return `${size ? `background-size: ${size};\n` : ''}animation: tn-grad-${anim} ${speed}s ${timing} infinite;\n\n${ANIM_KEYFRAMES[anim]}`;
}

let stopId = 100;
const nid = () => ++stopId;

const DEFAULT: GState = {
  type: 'linear',
  angle: 135,
  stops: [
    { id: 1, color: '#7c3aed', pos: 0 },
    { id: 2, color: '#c026d3', pos: 50 },
    { id: 3, color: '#3b82f6', pos: 100 },
  ],
  anim: 'none',
  speed: 8,
};

/* ─── Presets (curated, real) ─────────────────────────────────────────────── */

const PRESETS: Array<{ name: string; cat: string; type: GType; angle: number; colors: string[] }> = [
  { name: 'Luxury Black Gold', cat: 'Luxury', type: 'linear', angle: 135, colors: ['#0a0a0a', '#3d2b06', '#f5b93d'] },
  { name: 'Cyberpunk Neon', cat: 'Neon', type: 'linear', angle: 120, colors: ['#0d0221', '#ff2a6d', '#05d9e8'] },
  { name: 'Ocean Sunset', cat: 'Nature', type: 'linear', angle: 180, colors: ['#ff7e5f', '#feb47b', '#2193b0'] },
  { name: 'Aurora Sky', cat: 'Nature', type: 'aurora', angle: 160, colors: ['#00c9ff', '#92fe9d', '#7c3aed'] },
  { name: 'Apple Blue', cat: 'Brand-style', type: 'linear', angle: 145, colors: ['#0a84ff', '#5e5ce6'] },
  { name: 'Spotify Vibe', cat: 'Brand-style', type: 'linear', angle: 135, colors: ['#121212', '#1db954'] },
  { name: 'Insta Story', cat: 'Brand-style', type: 'linear', angle: 45, colors: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'] },
  { name: 'Netflix Dark', cat: 'Brand-style', type: 'radial', angle: 0, colors: ['#2d0b0e', '#000000'] },
  { name: 'Stripe Mesh', cat: 'Brand-style', type: 'mesh', angle: 0, colors: ['#635bff', '#00d4ff', '#ff5996', '#ffc857'] },
  { name: 'Vercel Mono', cat: 'Minimal', type: 'linear', angle: 180, colors: ['#000000', '#333333'] },
  { name: 'Minimal White', cat: 'Minimal', type: 'linear', angle: 160, colors: ['#ffffff', '#e8eaf0'] },
  { name: 'Glass Purple', cat: 'Glass', type: 'mesh', angle: 0, colors: ['#a78bfa', '#f0abfc', '#93c5fd', '#e9d5ff'] },
  { name: 'Pastel Dream', cat: 'Pastel', type: 'linear', angle: 120, colors: ['#ffd1ff', '#fad0c4', '#a1c4fd'] },
  { name: 'Deep Space', cat: 'Space', type: 'radial', angle: 0, colors: ['#1b2735', '#090a0f'] },
  { name: 'Galaxy', cat: 'Space', type: 'mesh', angle: 0, colors: ['#7c3aed', '#0ea5e9', '#0f172a', '#c026d3'] },
  { name: 'Sunset Beach', cat: 'Nature', type: 'linear', angle: 180, colors: ['#f83600', '#f9d423'] },
  { name: 'Forest Mist', cat: 'Nature', type: 'linear', angle: 150, colors: ['#134e5e', '#71b280'] },
  { name: 'Fire Neon', cat: 'Neon', type: 'linear', angle: 90, colors: ['#f12711', '#f5af19'] },
  { name: 'Ice Mint', cat: 'Pastel', type: 'linear', angle: 135, colors: ['#74ebd5', '#acb6e5'] },
  { name: 'Royal Gold', cat: 'Luxury', type: 'conic', angle: 0, colors: ['#bf953f', '#fcf6ba', '#b38728', '#fbf5b7', '#aa771c'] },
  { name: 'Retro Wave', cat: 'Retro', type: 'linear', angle: 180, colors: ['#3f0d7a', '#ec38bc', '#fdeff9'] },
  { name: 'Corporate Calm', cat: 'Corporate', type: 'linear', angle: 135, colors: ['#1e3c72', '#2a5298'] },
  { name: 'Medical Clean', cat: 'Corporate', type: 'linear', angle: 135, colors: ['#e0f7fa', '#4dd0e1', '#00838f'] },
  { name: 'Finance Green', cat: 'Corporate', type: 'linear', angle: 135, colors: ['#0f2027', '#2c5364', '#22c55e'] },
  { name: 'Ramadan Night', cat: 'Islamic', type: 'linear', angle: 160, colors: ['#0f2027', '#203a43', '#f5b93d'] },
  { name: 'Eid Glow', cat: 'Islamic', type: 'mesh', angle: 0, colors: ['#134e5e', '#f5b93d', '#71b280', '#fcf6ba'] },
  { name: 'Gaming RGB', cat: 'Gaming', type: 'conic', angle: 0, colors: ['#ff0055', '#00ff99', '#0066ff', '#ff0055'] },
  { name: 'Holo Noise', cat: 'Neon', type: 'noise', angle: 130, colors: ['#a78bfa', '#67e8f9', '#f0abfc'] },
];

/* Offline prompt engine — keyword → palette (AI fallback / instant) */
const MOODS: Array<[RegExp, string[]]> = [
  [/luxur|gold|premium|royal/i, ['#0a0a0a', '#3d2b06', '#f5b93d']],
  [/cyber|neon|punk/i, ['#0d0221', '#ff2a6d', '#05d9e8']],
  [/glass|frost/i, ['#a78bfa', '#f0abfc', '#93c5fd']],
  [/ocean|sea|beach/i, ['#2193b0', '#6dd5ed', '#feb47b']],
  [/sunset|shaam/i, ['#ff7e5f', '#feb47b', '#7c3aed']],
  [/aurora|northern/i, ['#00c9ff', '#92fe9d', '#7c3aed']],
  [/space|galaxy|star/i, ['#090a0f', '#1b2735', '#7c3aed']],
  [/forest|nature|green/i, ['#134e5e', '#71b280']],
  [/fire|flame|lava/i, ['#f12711', '#f5af19']],
  [/minimal|clean|white/i, ['#ffffff', '#e8eaf0']],
  [/dark|black|night/i, ['#000000', '#1a1a2e', '#16213e']],
  [/pastel|soft/i, ['#ffd1ff', '#fad0c4', '#a1c4fd']],
  [/retro|vintage|80s/i, ['#3f0d7a', '#ec38bc', '#fdeff9']],
  [/corporate|business|finance/i, ['#1e3c72', '#2a5298']],
  [/pink|rose/i, ['#ec4899', '#f472b6', '#fbcfe8']],
  [/blue|sky/i, ['#0a84ff', '#5e5ce6']],
];

/* ─── Color math ──────────────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function avgColor(stops: Stop[]): string {
  const rgb = stops.reduce((acc, s) => {
    const [r, g, b] = hexToRgb(s.color);
    return [acc[0] + r, acc[1] + g, acc[2] + b];
  }, [0, 0, 0]).map((v) => Math.round(v / stops.length));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function randHex(): string {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function distribute(colors: string[]): Stop[] {
  return colors.map((c, i) => ({ id: nid(), color: c, pos: Math.round((i / Math.max(1, colors.length - 1)) * 100) }));
}

/* ─── CSS builders ────────────────────────────────────────────────────────── */

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E")`;

function stopsStr(stops: Stop[]): string {
  return [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ');
}

function buildCSS(g: GState): string {
  const s = stopsStr(g.stops);
  const c = g.stops.map((x) => x.color);
  switch (g.type) {
    case 'linear': return `linear-gradient(${g.angle}deg, ${s})`;
    case 'radial': return `radial-gradient(circle at 50% 40%, ${s})`;
    case 'conic': return `conic-gradient(from ${g.angle}deg at 50% 50%, ${s})`;
    case 'mesh': {
      const spots = [
        [15, 20], [85, 15], [20, 85], [80, 80], [50, 50], [95, 50], [5, 50],
      ];
      const layers = c.map((col, i) => {
        const [x, y] = spots[i % spots.length];
        return `radial-gradient(at ${x}% ${y}%, ${col} 0px, transparent 55%)`;
      });
      // Last layer as a gradient (not a bare color) so the whole value is a
      // valid background-image — lets us use the longhand property in React.
      const base = c[c.length - 1];
      return `${layers.join(', ')}, linear-gradient(${base}, ${base})`;
    }
    case 'aurora': {
      const layers = c.map((col, i) => {
        const x = 20 + ((i * 30) % 60);
        return `radial-gradient(ellipse 80% 55% at ${x}% ${20 + i * 20}%, ${col}66 0%, transparent 60%)`;
      });
      return `${layers.join(', ')}, linear-gradient(${g.angle}deg, #05040f, #0d1025)`;
    }
    case 'noise': return `${NOISE_SVG}, linear-gradient(${g.angle}deg, ${s})`;
  }
}

function exportCSS(g: GState): string {
  const out = `background-image: ${buildCSS(g)};`;
  const anim = animCSSBlock(g.anim, g.speed);
  return anim ? `${out}\n${anim}` : out;
}

function exportHTML(g: GState): string {
  const anim = animCSSBlock(g.anim, g.speed);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ToolNest Gradient</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; }
  .gradient-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    background-image: ${buildCSS(g)};
${anim ? anim.split('\n\n')[0].split('\n').map((l) => `    ${l}`).join('\n') : '' }
  }
  h1 { color: #fff; font-size: clamp(28px, 6vw, 64px); text-shadow: 0 2px 24px rgba(0,0,0,.35); }
${anim ? `  ${ANIM_KEYFRAMES[g.anim as Exclude<AnimMode, 'none'>].split('\n').join('\n  ')}` : ''}
</style>
</head>
<body>
  <div class="gradient-bg"></div>
  <h1>Made with ToolNest</h1>
</body>
</html>`;
}

function exportTailwind(g: GState): string {
  if (g.type === 'linear') {
    return `bg-[linear-gradient(${g.angle}deg,${stopsStr(g.stops).replace(/ /g, '_')})]`;
  }
  return `bg-[${buildCSS(g).replace(/ /g, '_')}]`;
}

function exportSCSS(g: GState): string {
  const vars = g.stops.map((s, i) => `$gradient-color-${i + 1}: ${s.color};`).join('\n');
  return `${vars}\n$gradient: ${buildCSS(g)};\n\n.gradient {\n  background: $gradient;\n}`;
}

function exportJSON(g: GState): string {
  return JSON.stringify({
    type: g.type,
    angle: g.angle,
    stops: g.stops.map((s) => ({ color: s.color, position: s.pos })),
    css: buildCSS(g),
  }, null, 2);
}

function exportReact(g: GState): string {
  const a = animStyle(g.anim, g.speed);
  const style = g.anim !== 'none'
    ? `{\n  backgroundImage: '${buildCSS(g)}',\n  backgroundSize: '${a.backgroundSize}',\n  animation: '${a.animation}',\n}`
    : `{\n  backgroundImage: '${buildCSS(g)}',\n}`;
  return `const gradientStyle = ${style};\n\n<div style={gradientStyle} />`;
}

function exportFlutter(g: GState): string {
  const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
  const colors = sorted.map((s) => `    Color(0xFF${s.color.slice(1).toUpperCase()}),`).join('\n');
  const stops = sorted.map((s) => (s.pos / 100).toFixed(2)).join(', ');
  const rad = ((g.angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad).toFixed(2);
  const y = Math.sin(rad).toFixed(2);
  return `Container(\n  decoration: BoxDecoration(\n    gradient: LinearGradient(\n      begin: Alignment(${-x}, ${-y}),\n      end: Alignment(${x}, ${y}),\n      colors: [\n${colors}\n      ],\n      stops: [${stops}],\n    ),\n  ),\n)`;
}

function exportSwiftUI(g: GState): string {
  const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
  const stops = sorted.map((s) => {
    const [r, gr, b] = hexToRgb(s.color);
    return `    .init(color: Color(red: ${(r / 255).toFixed(3)}, green: ${(gr / 255).toFixed(3)}, blue: ${(b / 255).toFixed(3)}), location: ${(s.pos / 100).toFixed(2)}),`;
  }).join('\n');
  return `LinearGradient(\n  stops: [\n${stops}\n  ],\n  startPoint: .topLeading,\n  endPoint: .bottomTrailing\n)`;
}

/* Harmony generation from a base color (HSL rotation) */
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const rgb = s === 0 ? [l, l, l] : [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)];
  return `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

function harmony(base: string, kind: 'complement' | 'analogous' | 'triadic' | 'mono'): string[] {
  const [h, s, l] = hexToHsl(base);
  switch (kind) {
    case 'complement': return [base, hslToHex(h + 180, s, l)];
    case 'analogous': return [hslToHex(h - 30, s, l), base, hslToHex(h + 30, s, l)];
    case 'triadic': return [base, hslToHex(h + 120, s, l), hslToHex(h + 240, s, l)];
    case 'mono': return [hslToHex(h, s, Math.min(0.92, l + 0.28)), base, hslToHex(h, s, Math.max(0.08, l - 0.28))];
  }
}

/* URL share: state <-> #g= base64 */
function encodeState(g: GState): string {
  return btoa(JSON.stringify({ t: g.type, a: g.angle, am: g.anim, sp: g.speed, s: g.stops.map((x) => [x.color, x.pos]) }));
}

function decodeState(hash: string): GState | null {
  try {
    const j = JSON.parse(atob(hash)) as { t: GType; a: number; an?: boolean; am?: AnimMode; sp: number; s: [string, number][] };
    if (!Array.isArray(j.s) || j.s.length < 2) return null;
    return {
      type: j.t, angle: j.a || 0,
      anim: j.am ?? (j.an ? 'shift' : 'none'), // old links used a boolean
      speed: j.sp || 8,
      stops: j.s.map(([color, pos]) => ({ id: nid(), color, pos })),
    };
  } catch {
    return null;
  }
}

const PNG_SIZES = [
  { label: 'Desktop 1920×1080', w: 1920, h: 1080 },
  { label: 'Phone 1080×1920', w: 1080, h: 1920 },
  { label: '4K 3840×2160', w: 3840, h: 2160 },
  { label: 'OG Image 1200×630', w: 1200, h: 630 },
] as const;

function exportSVG(g: GState): string {
  const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
  const stops = sorted.map((s) => `    <stop offset="${s.pos}%" stop-color="${s.color}"/>`).join('\n');
  const rad = ((g.angle - 90) * Math.PI) / 180;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  const def = g.type === 'radial'
    ? `<radialGradient id="g" cx="50%" cy="40%" r="75%">\n${stops}\n  </radialGradient>`
    : `<linearGradient id="g" x1="${100 - x2}%" y1="${100 - y2}%" x2="${x2}%" y2="${y2}%">\n${stops}\n  </linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">\n  <defs>\n  ${def}\n  </defs>\n  <rect width="1920" height="1080" fill="url(#g)"/>\n</svg>`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

const TYPES: Array<{ id: GType; label: string }> = [
  { id: 'linear', label: 'Linear' }, { id: 'radial', label: 'Radial' }, { id: 'conic', label: 'Conic' },
  { id: 'mesh', label: 'Mesh' }, { id: 'aurora', label: 'Aurora' }, { id: 'noise', label: 'Noise' },
];

const PREVIEWS = ['Canvas', 'Hero', 'Button', 'Card', 'Phone', 'Navbar', 'Login', 'Glass', 'Icon', 'Text'] as const;

export default function GradientRunner() {
  const { toast } = useUI();
  const [g, setG] = useState<GState>(DEFAULT);
  const [past, setPast] = useState<GState[]>([]);
  const [future, setFuture] = useState<GState[]>([]);
  const [prompt, setPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [preview, setPreview] = useState<(typeof PREVIEWS)[number]>('Canvas');
  const [presetCat, setPresetCat] = useState('All');
  const [exportTab, setExportTab] = useState<'css' | 'html' | 'tailwind' | 'scss' | 'json' | 'react' | 'flutter' | 'swiftui'>('css');
  const [pngSize, setPngSize] = useState(0);
  const [saved, setSaved] = useState<string[]>([]); // encoded states
  const imgInputRef = useRef<HTMLInputElement>(null);

  /* Load shared gradient from URL hash + saved gallery from localStorage */
  useEffect(() => {
    const m = window.location.hash.match(/#g=([A-Za-z0-9+/=]+)/);
    if (m) {
      const st = decodeState(m[1]);
      if (st) setG(st);
    }
    try {
      const raw = localStorage.getItem('tn-gradients');
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(arr)) setSaved(arr.filter((x): x is string => typeof x === 'string'));
    } catch { /* ignore */ }
  }, []);

  const persistSaved = (next: string[]) => {
    setSaved(next);
    try { localStorage.setItem('tn-gradients', JSON.stringify(next)); } catch { /* full */ }
  };

  const saveCurrent = () => {
    const enc = encodeState(g);
    if (saved.includes(enc)) { toast('Already saved'); return; }
    persistSaved([enc, ...saved].slice(0, 24));
    toast('Saved to My Gradients ✓');
  };

  const shareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#g=${encodeState(g)}`;
    void navigator.clipboard.writeText(url);
    toast('Share link copied ✓');
  };

  const pickFromScreen = async () => {
    const W = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (!W.EyeDropper) { toast('Eyedropper is Chrome/Edge only', 'error'); return; }
    try {
      const { sRGBHex } = await new W.EyeDropper().open();
      apply((cur) => ({ ...cur, stops: [...cur.stops, { id: nid(), color: sRGBHex, pos: 50 }] }));
      toast(`Picked ${sRGBHex} ✓`);
    } catch { /* user cancelled */ }
  };

  const applyHarmony = (kind: 'complement' | 'analogous' | 'triadic' | 'mono') => {
    apply((cur) => ({ ...cur, stops: distribute(harmony(cur.stops[0]?.color ?? '#7c3aed', kind)) }));
  };

  const apply = useCallback((next: GState | ((cur: GState) => GState)) => {
    setG((cur) => {
      const val = typeof next === 'function' ? next(cur) : next;
      setPast((p) => [...p.slice(-30), cur]);
      setFuture([]);
      return val;
    });
  }, []);

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setG((cur) => { setFuture((f) => [cur, ...f]); return prev; });
      return p.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setG((cur) => { setPast((p) => [...p, cur]); return next; });
      return f.slice(1);
    });
  };

  const css = useMemo(() => buildCSS(g), [g]);
  const avg = useMemo(() => avgColor(g.stops), [g.stops]);
  const cWhite = useMemo(() => contrastRatio(avg, '#ffffff'), [avg]);
  const cBlack = useMemo(() => contrastRatio(avg, '#000000'), [avg]);
  const bestText = cWhite >= cBlack ? '#ffffff' : '#000000';
  const bestRatio = Math.max(cWhite, cBlack);

  /* stop ops */
  const setStop = (id: number, patch: Partial<Stop>) =>
    apply((cur) => ({ ...cur, stops: cur.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const addStop = () =>
    apply((cur) => ({ ...cur, stops: [...cur.stops, { id: nid(), color: randHex(), pos: 50 }] }));
  const removeStop = (id: number) =>
    apply((cur) => cur.stops.length <= 2 ? cur : ({ ...cur, stops: cur.stops.filter((s) => s.id !== id) }));
  const shuffle = () =>
    apply((cur) => {
      const colors = cur.stops.map((s) => s.color).sort(() => Math.random() - 0.5);
      return { ...cur, stops: cur.stops.map((s, i) => ({ ...s, color: colors[i] })) };
    });
  const reverse = () =>
    apply((cur) => ({ ...cur, stops: cur.stops.map((s) => ({ ...s, pos: 100 - s.pos })) }));
  const random = () =>
    apply((cur) => ({ ...cur, stops: distribute(Array.from({ length: 2 + Math.floor(Math.random() * 3) }, randHex)) }));

  /* AI prompt → gradient (offline mood engine first, then server AI) */
  const generateFromPrompt = async () => {
    const p = prompt.trim();
    if (!p) return;
    for (const [re, colors] of MOODS) {
      if (re.test(p)) {
        apply((cur) => ({ ...cur, stops: distribute(colors) }));
        toast('Gradient generated ✓');
        return;
      }
    }
    setAiBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You output ONLY a JSON array of 3-5 hex color strings for a beautiful gradient matching the user prompt. Example: ["#0a0a0a","#3d2b06","#f5b93d"]. No other text.',
          messages: [{ role: 'user', content: p }],
        }),
      });
      if (!res.ok) throw new Error('AI unavailable — sign in for AI generation');
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (const line of buf.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload) as { text?: string };
            if (j.text) full = j.text; // server streams accumulated text
          } catch { /* partial */ }
        }
      }
      const m = full.match(/\[[\s\S]*?\]/);
      const colors = m ? (JSON.parse(m[0]) as string[]).filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : [];
      if (colors.length < 2) throw new Error('AI could not produce colors — try different words');
      apply((cur) => ({ ...cur, stops: distribute(colors.slice(0, 5)) }));
      toast('AI gradient generated ✨');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Generation failed', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  /* Image → palette (client-side quantization) */
  const extractFromImage = (file: File) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const key = `${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`;
        const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
        buckets.set(key, b);
      }
      const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 4)
        .map((b) => `#${[b.r, b.g, b.b].map((v) => Math.round(v / b.n).toString(16).padStart(2, '0')).join('')}`);
      if (top.length >= 2) {
        apply((cur) => ({ ...cur, stops: distribute(top) }));
        toast('Palette extracted from image ✓');
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  /* Exports */
  const exportText =
    exportTab === 'css' ? exportCSS(g) :
    exportTab === 'html' ? exportHTML(g) :
    exportTab === 'tailwind' ? exportTailwind(g) :
    exportTab === 'scss' ? exportSCSS(g) :
    exportTab === 'react' ? exportReact(g) :
    exportTab === 'flutter' ? exportFlutter(g) :
    exportTab === 'swiftui' ? exportSwiftUI(g) :
    exportJSON(g);

  const downloadHTML = () => {
    const blob = new Blob([exportHTML(g)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'toolnest-gradient.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast(`${label} copied ✓`);
  };

  const downloadPNG = () => {
    const { w: W, h: H } = PNG_SIZES[pngSize];
    const cx = W / 2;
    const cy = H / 2;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
    if (g.type === 'radial' || g.type === 'conic') {
      const grad = g.type === 'conic'
        ? ctx.createConicGradient((g.angle * Math.PI) / 180, cx, cy)
        : ctx.createRadialGradient(cx, cy * 0.8, 0, cx, cy * 0.8, Math.max(W, H) * 0.6);
      sorted.forEach((s) => grad.addColorStop(s.pos / 100, s.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (g.type === 'mesh' || g.type === 'aurora') {
      ctx.fillStyle = sorted[sorted.length - 1].color;
      ctx.fillRect(0, 0, W, H);
      const spots = [[0.15, 0.2], [0.85, 0.15], [0.2, 0.85], [0.8, 0.8], [0.5, 0.5], [0.95, 0.5], [0.05, 0.5]];
      sorted.forEach((s, i) => {
        const [fx, fy] = spots[i % spots.length];
        const rg = ctx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, Math.max(W, H) * 0.48);
        rg.addColorStop(0, s.color + (g.type === 'aurora' ? '66' : 'ff'));
        rg.addColorStop(1, s.color + '00');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      });
    } else {
      const rad = ((g.angle - 90) * Math.PI) / 180;
      const grad = ctx.createLinearGradient(
        cx - Math.cos(rad) * cx, cy - Math.sin(rad) * cy,
        cx + Math.cos(rad) * cx, cy + Math.sin(rad) * cy,
      );
      sorted.forEach((s) => grad.addColorStop(s.pos / 100, s.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `toolnest-gradient-${W}x${H}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    }, 'image/png');
  };

  const downloadSVG = () => {
    const blob = new Blob([exportSVG(g)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'toolnest-gradient.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  // Longhand-only style: mixing the `background` shorthand with
  // `backgroundSize` makes React warn and mis-reconcile on re-render.
  const bgStyle: React.CSSProperties = {
    backgroundImage: css,
    ...animStyle(g.anim, g.speed),
  };

  const presetCats = ['All', ...Array.from(new Set(PRESETS.map((p) => p.cat)))];

  return (
    <div className="grad-studio">
      {/* AI prompt bar */}
      <div className="grad-prompt glass">
        <Icon name="sparkles" size={17} />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void generateFromPrompt()}
          placeholder='Describe it… "luxury black gold", "cyberpunk neon", "ocean sunset"'
          aria-label="AI gradient prompt"
        />
        <button className="btn btn-primary btn-sm" disabled={aiBusy || !prompt.trim()} onClick={() => void generateFromPrompt()}>
          {aiBusy ? <span className="spinner spinner-sm" /> : <Icon name="wand" size={14} />} Generate
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => imgInputRef.current?.click()} title="Extract palette from image">
          <Icon name="image" size={14} /> From image
        </button>
        <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) extractFromImage(e.target.files[0]); e.target.value = ''; }} />
      </div>

      <div className="grad-layout">
        {/* Left: live preview */}
        <div className="grad-preview-col">
          <div className="grad-preview-tabs">
            {PREVIEWS.map((p) => (
              <button key={p} className={`atx-chip ${preview === p ? 'active' : ''}`} onClick={() => setPreview(p)}>{p}</button>
            ))}
          </div>

          <div className={`grad-canvas grad-view-${preview.toLowerCase()}`}>
            {preview === 'Canvas' && <div className="grad-fill" style={bgStyle} />}
            {preview === 'Hero' && (
              <div className="grad-fill grad-hero-mock" style={bgStyle}>
                <b style={{ color: bestText }}>One Platform. Infinite Tools.</b>
                <span style={{ color: bestText, opacity: 0.8 }}>Beautiful gradients in seconds</span>
                <button style={{ background: bestText, color: bestText === '#ffffff' ? '#111' : '#fff' }}>Get Started</button>
              </div>
            )}
            {preview === 'Button' && (
              <div className="grad-fill grad-center">
                <button className="grad-btn-mock" style={bgStyle}>Click me</button>
              </div>
            )}
            {preview === 'Card' && (
              <div className="grad-fill grad-center">
                <div className="grad-card-mock" style={bgStyle}>
                  <b style={{ color: bestText }}>Pro Plan</b>
                  <span style={{ color: bestText, opacity: 0.85 }}>₹499/mo · Everything unlimited</span>
                </div>
              </div>
            )}
            {preview === 'Phone' && (
              <div className="grad-fill grad-center">
                <div className="grad-phone-mock"><div style={bgStyle} /></div>
              </div>
            )}
            {preview === 'Navbar' && (
              <div className="grad-fill grad-navbar-page">
                <div className="grad-navbar-mock" style={bgStyle}>
                  <b style={{ color: bestText }}>ToolNest</b>
                  <span style={{ color: bestText, opacity: 0.85 }}>Home · Tools · Pricing</span>
                </div>
                <div className="grad-navbar-body" />
              </div>
            )}
            {preview === 'Login' && (
              <div className="grad-fill grad-center" style={bgStyle}>
                <div className="grad-login-mock">
                  <b>Welcome back</b>
                  <div className="grad-login-input" />
                  <div className="grad-login-input" />
                  <div className="grad-login-btn" style={bgStyle}><span style={{ color: bestText }}>Sign in</span></div>
                </div>
              </div>
            )}
            {preview === 'Glass' && (
              <div className="grad-fill grad-center" style={bgStyle}>
                <div className="grad-glass-mock">
                  <b style={{ color: bestText }}>Glassmorphism</b>
                  <span style={{ color: bestText, opacity: 0.8 }}>backdrop-filter: blur(18px)</span>
                </div>
              </div>
            )}
            {preview === 'Icon' && (
              <div className="grad-fill grad-center">
                <div className="grad-icon-mock" style={bgStyle}><span style={{ color: bestText }}>T</span></div>
              </div>
            )}
            {preview === 'Text' && (
              <div className="grad-fill grad-center">
                <b className="grad-text-mock" style={{ backgroundImage: css }}>GRADIENT</b>
              </div>
            )}
          </div>

          {/* Accessibility */}
          <div className="grad-a11y">
            <span className="grad-a11y-swatch" style={{ background: avg, color: bestText }}>Aa</span>
            <span>
              Best text: <b>{bestText === '#ffffff' ? 'White' : 'Black'}</b> · contrast <b>{bestRatio.toFixed(2)}:1</b>
              {' '}{bestRatio >= 7 ? '· WCAG AAA ✓' : bestRatio >= 4.5 ? '· WCAG AA ✓' : '· body text ke liye weak ⚠'}
            </span>
          </div>
        </div>

        {/* Right: controls */}
        <div className="grad-controls">
          {/* Type + history */}
          <div className="grad-row">
            <div className="atx-chips">
              {TYPES.map((t) => (
                <button key={t.id} className={`atx-chip ${g.type === t.id ? 'active' : ''}`} onClick={() => apply((c) => ({ ...c, type: t.id }))}>{t.label}</button>
              ))}
            </div>
            <div className="grad-history">
              <button className="icon-btn" onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo"><Icon name="chevron-left" size={15} /></button>
              <button className="icon-btn" onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo"><Icon name="chevron-right" size={15} /></button>
            </div>
          </div>

          {/* Angle */}
          {(g.type === 'linear' || g.type === 'conic' || g.type === 'noise' || g.type === 'aurora') && (
            <div className="field">
              <label>Angle <span className="range-value">{g.angle}°</span></label>
              <input type="range" min={0} max={360} value={g.angle} onChange={(e) => apply((c) => ({ ...c, angle: +e.target.value }))} />
            </div>
          )}

          {/* Stops */}
          <div className="field">
            <label>Colors ({g.stops.length})</label>
            <div className="grad-stops">
              {[...g.stops].sort((a, b) => a.pos - b.pos).map((s) => (
                <div key={s.id} className="grad-stop">
                  <input type="color" value={s.color} onChange={(e) => setStop(s.id, { color: e.target.value })} aria-label="Stop color" />
                  <input type="number" min={0} max={100} value={s.pos} onChange={(e) => setStop(s.id, { pos: Math.max(0, Math.min(100, +e.target.value)) })} aria-label="Stop position %" />
                  <button className="grad-stop-copy" onClick={() => copy(s.color, s.color)} title="Copy hex">{s.color}</button>
                  <button className="icon-btn" onClick={() => removeStop(s.id)} disabled={g.stops.length <= 2} aria-label="Remove color"><Icon name="x" size={13} /></button>
                </div>
              ))}
            </div>
            <div className="grad-stop-actions">
              <button className="btn btn-ghost btn-sm" onClick={addStop}><Icon name="check" size={13} /> Add color</button>
              <button className="btn btn-ghost btn-sm" onClick={() => void pickFromScreen()} title="Pick a color from anywhere on screen"><Icon name="crop" size={13} /> Eyedropper</button>
              <button className="btn btn-ghost btn-sm" onClick={random}><Icon name="refresh" size={13} /> Random</button>
              <button className="btn btn-ghost btn-sm" onClick={shuffle}><Icon name="repeat" size={13} /> Shuffle</button>
              <button className="btn btn-ghost btn-sm" onClick={reverse}><Icon name="split" size={13} /> Reverse</button>
            </div>
          </div>

          {/* Color harmony from first color */}
          <div className="field">
            <label>Harmony (base: <span className="mono">{g.stops[0]?.color}</span>)</label>
            <div className="grad-stop-actions" style={{ marginTop: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => applyHarmony('complement')}>Complement</button>
              <button className="btn btn-ghost btn-sm" onClick={() => applyHarmony('analogous')}>Analogous</button>
              <button className="btn btn-ghost btn-sm" onClick={() => applyHarmony('triadic')}>Triadic</button>
              <button className="btn btn-ghost btn-sm" onClick={() => applyHarmony('mono')}>Monochrome</button>
            </div>
          </div>

          {/* Animation */}
          <div className="field">
            <label>Animation</label>
            <div className="atx-chips">
              {ANIMS.map((a) => (
                <button key={a.id} className={`atx-chip ${g.anim === a.id ? 'active' : ''}`} onClick={() => apply((c) => ({ ...c, anim: a.id }))}>{a.label}</button>
              ))}
            </div>
            {g.anim !== 'none' && (
              <>
                <label style={{ marginTop: 8 }}>Speed <span className="range-value">{g.speed}s loop</span></label>
                <input type="range" min={2} max={20} value={g.speed} onChange={(e) => apply((c) => ({ ...c, speed: +e.target.value }))} />
              </>
            )}
          </div>

          {/* Export */}
          <div className="field">
            <label>Export</label>
            <div className="atx-chips">
              {(['css', 'html', 'tailwind', 'scss', 'react', 'flutter', 'swiftui', 'json'] as const).map((t) => (
                <button key={t} className={`atx-chip ${exportTab === t ? 'active' : ''}`} onClick={() => setExportTab(t)}>
                  {t === 'swiftui' ? 'SwiftUI' : t === 'flutter' ? 'Flutter' : t === 'react' ? 'React' : t === 'html' ? 'HTML+CSS' : t.toUpperCase()}
                </button>
              ))}
            </div>
            <pre className="grad-code">{exportText}</pre>
            <div className="grad-stop-actions">
              <button className="btn btn-primary btn-sm" onClick={() => copy(exportText, exportTab.toUpperCase())}><Icon name="copy" size={13} /> Copy</button>
              {exportTab === 'html' && (
                <button className="btn btn-outline btn-sm" onClick={downloadHTML}><Icon name="download" size={13} /> .html file</button>
              )}
              <select value={pngSize} onChange={(e) => setPngSize(+e.target.value)} aria-label="PNG size" style={{ fontSize: 12 }}>
                {PNG_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
              </select>
              <button className="btn btn-outline btn-sm" onClick={downloadPNG}><Icon name="download" size={13} /> PNG</button>
              <button className="btn btn-outline btn-sm" onClick={downloadSVG} disabled={g.type === 'mesh' || g.type === 'aurora' || g.type === 'noise'} title={g.type === 'mesh' || g.type === 'aurora' || g.type === 'noise' ? 'SVG sirf linear/radial/conic ke liye' : 'Download SVG'}>
                <Icon name="download" size={13} /> SVG
              </button>
            </div>
            <div className="grad-stop-actions">
              <button className="btn btn-outline btn-sm" onClick={shareLink}><Icon name="link" size={13} /> Share Link</button>
              <button className="btn btn-outline btn-sm" onClick={saveCurrent}><Icon name="star" size={13} /> Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* My gradients (saved) */}
      {saved.length > 0 && (
        <div className="grad-presets">
          <div className="grad-row">
            <h3><Icon name="folder" size={15} /> My Gradients ({saved.length})</h3>
          </div>
          <div className="grad-preset-grid">
            {saved.map((enc) => {
              const st = decodeState(enc);
              if (!st) return null;
              return (
                <div key={enc} className="grad-saved-wrap">
                  <button
                    className="grad-preset"
                    style={{ backgroundImage: buildCSS(st) }}
                    onClick={() => apply(() => st)}
                    title="Apply"
                  >
                    <span>{st.type} · {st.stops.length} colors</span>
                  </button>
                  <button className="grad-saved-del" aria-label="Delete saved gradient" onClick={() => persistSaved(saved.filter((s) => s !== enc))}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="grad-presets">
        <div className="grad-row">
          <h3><Icon name="star" size={15} /> Presets ({PRESETS.length})</h3>
          <div className="atx-chips">
            {presetCats.map((c) => (
              <button key={c} className={`atx-chip ${presetCat === c ? 'active' : ''}`} onClick={() => setPresetCat(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grad-preset-grid">
          {PRESETS.filter((p) => presetCat === 'All' || p.cat === presetCat).map((p) => (
            <button
              key={p.name}
              className="grad-preset"
              style={{ background: buildCSS({ ...DEFAULT, type: p.type, angle: p.angle, stops: distribute(p.colors) }) }}
              onClick={() => apply((c) => ({ ...c, type: p.type, angle: p.angle, stops: distribute(p.colors) }))}
              title={p.name}
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
