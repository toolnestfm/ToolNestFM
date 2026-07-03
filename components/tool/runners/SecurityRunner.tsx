'use client';

import { useState } from 'react';
import type { Tool } from '@/data/tools';
import { FileDrop, OutputBlock, ErrorBox } from '../shared';
import { md5Bytes } from '@/lib/md5';
import Icon from '../../Icon';

async function shaHex(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, data as BufferSource);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 150_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export default function SecurityRunner({ tool }: { tool: Tool }) {
  const mode = tool.mode;
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [encDir, setEncDir] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [domain, setDomain] = useState('');

  const isHashMode = ['md5', 'sha1', 'sha256', 'sha512', 'checksum', 'hash-all'].includes(mode);

  const run = async () => {
    setError('');
    setBusy(true);
    try {
      if (isHashMode) {
        let bytes: Uint8Array;
        let label: string;
        if (files[0]) {
          bytes = new Uint8Array(await files[0].arrayBuffer());
          label = files[0].name;
        } else if (input) {
          bytes = new TextEncoder().encode(input);
          label = 'text input';
        } else {
          throw new Error('Enter text or choose a file first.');
        }

        const lines: string[] = [`Source: ${label}`, ''];
        if (mode === 'md5') lines.push(`MD5:     ${md5Bytes(bytes)}`);
        else if (mode === 'sha1') lines.push(`SHA-1:   ${await shaHex('SHA-1', bytes)}`);
        else if (mode === 'sha256') lines.push(`SHA-256: ${await shaHex('SHA-256', bytes)}`);
        else if (mode === 'sha512') lines.push(`SHA-512: ${await shaHex('SHA-512', bytes)}`);
        else {
          lines.push(
            `MD5:     ${md5Bytes(bytes)}`,
            `SHA-1:   ${await shaHex('SHA-1', bytes)}`,
            `SHA-256: ${await shaHex('SHA-256', bytes)}`,
            `SHA-512: ${await shaHex('SHA-512', bytes)}`,
          );
        }
        setOutput(lines.join('\n'));
      } else if (mode === 'encrypt') {
        if (!passphrase) throw new Error('Enter a passphrase.');
        if (encDir === 'encrypt') {
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const key = await deriveKey(passphrase, salt);
          const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(input)));
          const packed = new Uint8Array(16 + 12 + ct.length);
          packed.set(salt, 0);
          packed.set(iv, 16);
          packed.set(ct, 28);
          setOutput(btoa(String.fromCharCode(...packed)));
        } else {
          const packed = Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0));
          const key = await deriveKey(passphrase, packed.slice(0, 16));
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(16, 28) as BufferSource }, key, packed.slice(28) as BufferSource);
          setOutput(new TextDecoder().decode(pt));
        }
      } else if (mode === 'ssl' || mode === 'url-scan') {
        const target = domain.trim();
        if (!target) throw new Error('Enter a domain or URL.');
        const res = await fetch(`/api/security/${mode === 'ssl' ? 'ssl' : 'scan'}?target=${encodeURIComponent(target)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Check failed');
        setOutput(json.data.report as string);
      }
    } catch (e) {
      if (mode === 'encrypt' && encDir === 'decrypt') setError('Decryption failed — wrong passphrase or corrupted data.');
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace-grid">
      <div className="options-panel">
        {(mode === 'ssl' || mode === 'url-scan') ? (
          <div className="field">
            <label>{mode === 'ssl' ? 'Domain' : 'URL to scan'}</label>
            <input value={domain} placeholder={mode === 'ssl' ? 'example.com' : 'https://example.com/page'} onChange={(e) => setDomain(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field">
              <label>{mode === 'encrypt' ? (encDir === 'encrypt' ? 'Text to encrypt' : 'Encrypted text (Base64)') : 'Text input'}</label>
              <textarea value={input} style={{ minHeight: 130 }} onChange={(e) => setInput(e.target.value)} />
            </div>
            {isHashMode && (
              <div className="field">
                <label>…or hash a file</label>
                <FileDrop files={files} onFiles={setFiles} hint="Any file type — hashed locally" />
              </div>
            )}
          </>
        )}
        {mode === 'encrypt' && (
          <>
            <div className="field"><label>Mode</label>
              <select value={encDir} onChange={(e) => setEncDir(e.target.value as 'encrypt' | 'decrypt')}>
                <option value="encrypt">Encrypt (AES-256-GCM)</option>
                <option value="decrypt">Decrypt</option>
              </select></div>
            <div className="field"><label>Passphrase</label><input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /></div>
          </>
        )}
        {error && <ErrorBox message={error} />}
        <button className="btn btn-primary" disabled={busy} onClick={() => void run()}>
          <Icon name="shield" size={15} /> {busy ? 'Working...' : mode === 'encrypt' ? (encDir === 'encrypt' ? 'Encrypt Now' : 'Decrypt Now') : mode === 'ssl' ? 'Check SSL' : mode === 'url-scan' ? 'Scan URL' : 'Generate Hash'}
        </button>
        <p className="muted" style={{ fontSize: 12 }}>All hashing &amp; encryption runs locally in your browser.</p>
      </div>
      <div>{output ? <OutputBlock text={output} filename={`${tool.slug}.txt`} /> : <div className="output-area" style={{ minHeight: 220, color: 'var(--text-muted)' }}>Result will appear here.</div>}</div>
    </div>
  );
}
