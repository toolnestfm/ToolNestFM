import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/content/PageShell';

export const metadata: Metadata = {
  title: 'Developer API — ToolNest',
  description:
    'Build with the ToolNest API: AI chat, summarize, translate, content writing, QR codes, hashing and more. Simple Bearer-key auth, credit-based pricing.',
};

const codeStyle: React.CSSProperties = { overflowX: 'auto', padding: 14, fontSize: 13, borderRadius: 8 };

function Endpoint({
  method,
  path,
  cost,
  children,
}: {
  method: string;
  path: string;
  cost: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code>{method} {path}</code>
        <span className="pill" style={{ fontSize: 11 }}>{cost}</span>
      </h3>
      {children}
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <PageShell title="Developer API" subtitle="Build ToolNest's AI and utilities into your own apps">
      <h2>Getting started</h2>
      <ol>
        <li><Link href="/signup">Create a ToolNest account</Link> — new accounts get <b>25 free credits</b></li>
        <li>Generate an API key at <Link href="/dashboard/api-keys">Dashboard → API Keys</Link></li>
        <li>Pass it on every request: <code>Authorization: Bearer tn_live_...</code></li>
      </ol>

      <h2>Quickstart</h2>
      <p><b>JavaScript / Node.js:</b></p>
      <pre style={codeStyle}><code>{`const res = await fetch('https://toolnestfm.com/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tn_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Explain JWT in one line' }],
  }),
});
const { success, data, error } = await res.json();
if (!success) throw new Error(error);
console.log(data.reply, data.credits.remaining);`}</code></pre>

      <p><b>Python:</b></p>
      <pre style={codeStyle}><code>{`import requests

res = requests.post(
    "https://toolnestfm.com/api/v1/summarize",
    headers={"Authorization": "Bearer tn_live_YOUR_KEY"},
    json={"text": "<long text>", "length": "short"},
)
body = res.json()
if not body["success"]:
    raise RuntimeError(body["error"])
print(body["data"]["summary"])`}</code></pre>

      <h2>OpenAPI specification</h2>
      <p>
        A machine-readable OpenAPI 3.0 spec is available at{' '}
        <a href="/api/v1/openapi.json"><code>GET /api/v1/openapi.json</code></a> — import it into
        Postman, Insomnia, or generate a typed client with <code>openapi-generator</code>.
      </p>

      <h2>Pricing</h2>
      <p>
        AI endpoints cost <b>1 credit per call</b>; utility endpoints are free (key required).
        If an AI call fails, the credit is <b>automatically refunded</b>. Buy credit packs at{' '}
        <Link href="/dashboard/credits">Dashboard → Credits</Link>.
      </p>

      <h2>Response format</h2>
      <p>Every endpoint returns the same envelope:</p>
      <pre style={codeStyle}><code>{`{
  "success": true,
  "data": { ... },              // endpoint result
  "error": null,                // or an error message when success=false
  "meta": { "requestId": "...", "timestamp": "..." }
}`}</code></pre>
      <p className="muted">
        Errors use standard HTTP codes: <code>401</code> bad key · <code>402</code> not enough credits ·{' '}
        <code>429</code> rate limited (respect <code>Retry-After</code>) · <code>400</code> bad input.
      </p>

      <h2>AI endpoints — 1 credit</h2>

      <Endpoint method="POST" path="/api/v1/chat" cost="1 credit">
        <p>Multi-turn AI chat completion.</p>
        <pre style={codeStyle}><code>{`curl -X POST https://toolnestfm.com/api/v1/chat \\
  -H "Authorization: Bearer tn_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Explain JWT in one line"}],
    "system": "You are concise."
  }'

// → { "data": { "reply": "...", "credits": { "spent": 1, "remaining": 24 } } }`}</code></pre>
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/summarize" cost="1 credit">
        <p>Summarize any text. Options: <code>length</code> (short | medium | long), <code>language</code>.</p>
        <pre style={codeStyle}><code>{`{ "text": "<long text>", "length": "short" }
// → { "data": { "summary": "..." } }`}</code></pre>
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/translate" cost="1 credit">
        <p>Translate text to any language. <code>to</code> is required; <code>from</code> is auto-detected.</p>
        <pre style={codeStyle}><code>{`{ "text": "Hello world", "to": "Hindi" }
// → { "data": { "translation": "...", "to": "Hindi" } }`}</code></pre>
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/write" cost="1 credit">
        <p>Generate content from a brief. Options: <code>tone</code>, <code>format</code>, <code>words</code> (50–3000).</p>
        <pre style={codeStyle}><code>{`{ "brief": "Benefits of morning walks", "format": "blog post", "words": 400 }
// → { "data": { "content": "..." } }`}</code></pre>
      </Endpoint>

      <h2>Utility endpoints — free</h2>

      <Endpoint method="POST" path="/api/v1/qr" cost="free">
        <p>QR code generator. Options: <code>size</code> (64–2048), <code>format</code> (png | svg).</p>
        <pre style={codeStyle}><code>{`{ "text": "https://toolnestfm.com", "size": 512 }
// → { "data": { "dataUrl": "data:image/png;base64,..." } }`}</code></pre>
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/hash" cost="free">
        <p>Hash text with <code>md5</code>, <code>sha1</code>, <code>sha256</code> or <code>sha512</code>.</p>
        <pre style={codeStyle}><code>{`{ "text": "hello", "algorithm": "sha256" }
// → { "data": { "hash": "2cf24dba..." } }`}</code></pre>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/uuid?count=5" cost="free">
        <p>Generate 1–100 UUID v4s.</p>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/tools" cost="free · no key">
        <p>The full 130-tool catalog as JSON. Filter with <code>?category=pdf</code>.</p>
      </Endpoint>

      <h2>Account endpoints — free</h2>

      <Endpoint method="GET" path="/api/v1/me" cost="free">
        <p>Your key info, credit balance and the per-endpoint price list.</p>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/usage" cost="free">
        <p>Your last 100 API calls with credit amounts — perfect for building usage dashboards.</p>
      </Endpoint>

      <h2>Rate limits</h2>
      <p>
        AI endpoints: 30 requests/minute. Utility and account endpoints: 60 requests/minute.
        On <code>429</code>, wait for the <code>Retry-After</code> header value (seconds).
      </p>

      <h2>Keys & security</h2>
      <ul>
        <li>Up to 5 active keys per account — rotate by creating a new key and revoking the old one</li>
        <li>Keys are shown <b>once</b> at creation; only a SHA-256 hash is stored</li>
        <li>Revoke instantly from <Link href="/dashboard/api-keys">Dashboard → API Keys</Link></li>
        <li>Never ship a key in client-side code — call the API from your server</li>
      </ul>
    </PageShell>
  );
}
