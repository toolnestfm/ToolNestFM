'use client';

import { useState } from 'react';
import type { Tool } from '@/data/tools';
import { FileDrop, Processing, ErrorBox, ResultView, useToolPhase, type ResultFile } from '../shared';
import { replaceExt } from '@/lib/download';

import type { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onProgress: (p: number) => void): Promise<FFmpeg> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  let instance = ffmpegInstance;
  if (!instance) {
    instance = new FFmpeg();
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    await instance.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = instance;
  }
  instance.on('progress', ({ progress }: { progress: number }) => {
    if (progress >= 0 && progress <= 1) onProgress(progress);
  });
  return instance;
}

const videoFormats = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
const audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];

export default function FfmpegRunner({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset, progress, setProgress } = useToolPhase();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [status, setStatus] = useState('Processing...');

  const isAudio = tool.mode.startsWith('audio') || ['voice-change', 'denoise'].includes(tool.mode);
  const [outFormat, setOutFormat] = useState(isAudio ? 'mp3' : 'mp4');
  const [crf, setCrf] = useState(28);
  const [bitrate, setBitrate] = useState('128k');
  const [start, setStart] = useState('00:00:00');
  const [end, setEnd] = useState('00:00:10');
  const [parts, setParts] = useState(2);
  const [wmText, setWmText] = useState('ToolNest');
  const [gifFps, setGifFps] = useState(12);
  const [gifWidth, setGifWidth] = useState(480);
  const [pitch, setPitch] = useState(1.25);

  const mode = tool.mode;

  const run = async () => {
    if (files.length === 0) return;
    setPhase('working');
    try {
      setStatus('Loading FFmpeg engine (first run ~30MB, then cached)...');
      const ffmpeg = await getFFmpeg(setProgress);
      const { fetchFile } = await import('@ffmpeg/util');
      const out: ResultFile[] = [];
      const extOf = (f: File) => (f.name.split('.').pop() || 'dat').toLowerCase();

      setStatus('Processing — this runs entirely in your browser...');

      const readOut = async (name: string, mime: string): Promise<Blob> => {
        const data = await ffmpeg.readFile(name);
        const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(String(data));
        return new Blob([bytes], { type: mime });
      };

      if (mode === 'video-convert' || mode === 'audio-convert') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        const outName = `out.${outFormat}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, outName]);
        out.push({ name: replaceExt(f.name, outFormat), blob: await readOut(outName, isAudio ? `audio/${outFormat}` : `video/${outFormat}`) });
      } else if (mode === 'video-compress') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, '-vcodec', 'libx264', '-crf', String(crf), '-preset', 'fast', '-acodec', 'aac', '-b:a', '96k', 'out.mp4']);
        out.push({ name: replaceExt(f.name, 'mp4').replace(/\.mp4$/, '-compressed.mp4'), blob: await readOut('out.mp4', 'video/mp4') });
      } else if (mode === 'audio-compress') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, '-b:a', bitrate, 'out.mp3']);
        out.push({ name: replaceExt(f.name, 'mp3'), blob: await readOut('out.mp3', 'audio/mpeg') });
      } else if (mode === 'video-trim' || mode === 'audio-cut') {
        const f = files[0];
        const ext = mode === 'video-trim' ? 'mp4' : 'mp3';
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, '-ss', start, '-to', end, '-c', 'copy', `out.${ext}`]);
        out.push({ name: replaceExt(f.name, ext).replace(`.${ext}`, `-trimmed.${ext}`), blob: await readOut(`out.${ext}`, mode === 'video-trim' ? 'video/mp4' : 'audio/mpeg') });
      } else if (mode === 'video-merge' || mode === 'audio-merge') {
        const ext = mode === 'video-merge' ? 'mp4' : 'mp3';
        let list = '';
        for (let i = 0; i < files.length; i++) {
          const n = `in${i}.${extOf(files[i])}`;
          await ffmpeg.writeFile(n, await fetchFile(files[i]));
          const norm = `norm${i}.${ext}`;
          if (mode === 'video-merge') {
            await ffmpeg.exec(['-i', n, '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2', '-r', '30', '-vcodec', 'libx264', '-preset', 'fast', '-acodec', 'aac', norm]);
          } else {
            await ffmpeg.exec(['-i', n, '-ar', '44100', '-b:a', '160k', norm]);
          }
          list += `file '${norm}'\n`;
        }
        await ffmpeg.writeFile('list.txt', new TextEncoder().encode(list));
        await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', `merged.${ext}`]);
        out.push({ name: `merged.${ext}`, blob: await readOut(`merged.${ext}`, mode === 'video-merge' ? 'video/mp4' : 'audio/mpeg') });
      } else if (mode === 'video-split') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        // probe duration via video element
        const dur = await new Promise<number>((resolve) => {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => resolve(v.duration);
          v.onerror = () => resolve(60);
          v.src = URL.createObjectURL(f);
        });
        const seg = dur / parts;
        for (let i = 0; i < parts; i++) {
          const name = `part${i + 1}.mp4`;
          await ffmpeg.exec(['-i', inName, '-ss', String(i * seg), '-t', String(seg), '-c', 'copy', name]);
          out.push({ name: `${f.name.replace(/\.[^.]+$/, '')}-part${i + 1}.mp4`, blob: await readOut(name, 'video/mp4') });
        }
      } else if (mode === 'video-watermark') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        const safe = wmText.replace(/[':\\]/g, '');
        await ffmpeg.exec(['-i', inName, '-vf', `drawtext=text='${safe}':fontcolor=white@0.7:fontsize=28:x=w-tw-24:y=h-th-24:box=1:boxcolor=black@0.3:boxborderw=8`, '-c:a', 'copy', 'out.mp4']);
        out.push({ name: replaceExt(f.name, 'mp4').replace(/\.mp4$/, '-watermarked.mp4'), blob: await readOut('out.mp4', 'video/mp4') });
      } else if (mode === 'video-gif') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, '-vf', `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos`, '-loop', '0', 'out.gif']);
        out.push({ name: replaceExt(f.name, 'gif'), blob: await readOut('out.gif', 'image/gif') });
      } else if (mode === 'voice-change') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        const rate = Math.round(44100 * pitch);
        await ffmpeg.exec(['-i', inName, '-af', `asetrate=${rate},aresample=44100,atempo=${(1 / pitch).toFixed(3)}`, 'out.mp3']);
        out.push({ name: replaceExt(f.name, 'mp3').replace(/\.mp3$/, '-voice.mp3'), blob: await readOut('out.mp3', 'audio/mpeg') });
      } else if (mode === 'denoise') {
        const f = files[0];
        const inName = `in.${extOf(f)}`;
        await ffmpeg.writeFile(inName, await fetchFile(f));
        await ffmpeg.exec(['-i', inName, '-af', 'afftdn=nf=-25,highpass=f=80,lowpass=f=12000', 'out.mp3']);
        out.push({ name: replaceExt(f.name, 'mp3').replace(/\.mp3$/, '-clean.mp3'), blob: await readOut('out.mp3', 'audio/mpeg') });
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }

      setResults(out);
      setPhase('done');
    } catch (e) {
      fail(e instanceof Error && e.message.includes('SharedArrayBuffer')
        ? new Error('This tool needs cross-origin isolation. Please run the site with "npm run dev" or "npm start" (headers are pre-configured).')
        : e);
    }
  };

  const resetAll = () => { reset(); setFiles([]); setResults([]); };

  if (phase === 'working') return <Processing label={status} progress={progress} />;
  if (phase === 'done') {
    const before = files.reduce((s, f) => s + f.size, 0);
    const after = results.reduce((s, f) => s + f.blob.size, 0);
    const showSizes = mode.includes('compress');
    return <ResultView files={results} before={showSizes ? before : undefined} after={showSizes ? after : undefined} onReset={resetAll} />;
  }

  return (
    <div className="workspace-grid">
      <div><FileDrop accept={tool.accept} multiple={tool.multiple} files={files} onFiles={setFiles} /></div>
      <div className="options-panel">
        <h3>Options</h3>

        {(mode === 'video-convert' || mode === 'audio-convert') && (
          <div className="field"><label>Output format</label>
            <select value={outFormat} onChange={(e) => setOutFormat(e.target.value)}>
              {(isAudio ? audioFormats : videoFormats).map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select></div>
        )}
        {mode === 'video-compress' && (
          <div className="field"><label>Compression level <span className="range-value">CRF {crf}</span></label>
            <input type="range" min={20} max={38} value={crf} onChange={(e) => setCrf(+e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>Higher = smaller file, lower quality</span></div>
        )}
        {mode === 'audio-compress' && (
          <div className="field"><label>Bitrate</label>
            <select value={bitrate} onChange={(e) => setBitrate(e.target.value)}>
              {['64k', '96k', '128k', '192k'].map((b) => <option key={b} value={b}>{b}</option>)}
            </select></div>
        )}
        {(mode === 'video-trim' || mode === 'audio-cut') && (
          <div className="field-row">
            <div className="field"><label>Start (hh:mm:ss)</label><input value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="field"><label>End (hh:mm:ss)</label><input value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
        )}
        {mode === 'video-split' && (
          <div className="field"><label>Number of parts</label><input type="number" min={2} max={10} value={parts} onChange={(e) => setParts(+e.target.value)} /></div>
        )}
        {mode === 'video-watermark' && (
          <div className="field"><label>Watermark text</label><input value={wmText} onChange={(e) => setWmText(e.target.value)} /></div>
        )}
        {mode === 'video-gif' && (
          <div className="field-row">
            <div className="field"><label>FPS</label><input type="number" min={5} max={30} value={gifFps} onChange={(e) => setGifFps(+e.target.value)} /></div>
            <div className="field"><label>Width (px)</label><input type="number" min={120} max={1280} value={gifWidth} onChange={(e) => setGifWidth(+e.target.value)} /></div>
          </div>
        )}
        {mode === 'voice-change' && (
          <div className="field"><label>Pitch <span className="range-value">{pitch.toFixed(2)}×</span></label>
            <input type="range" min={0.5} max={2} step={0.05} value={pitch} onChange={(e) => setPitch(+e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>&lt;1 = deeper · &gt;1 = higher (chipmunk)</span></div>
        )}

        <p className="muted" style={{ fontSize: 12.5 }}>Powered by FFmpeg WebAssembly — 100% private, nothing is uploaded. Best for files under ~200MB.</p>
        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
        <button className="btn btn-primary" disabled={files.length === 0} onClick={() => void run()}>Process Now</button>
      </div>
    </div>
  );
}
