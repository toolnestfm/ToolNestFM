# 🚀 ToolNest — One Platform. Infinite Tools. Powered by AI.

**ToolNestFM** · Faruk Mondal | Fam Cloud Pvt. Ltd. · https://toolnestfm.com

A full Next.js 15 platform with **130 working tools across 15 categories** — PDF, Image, Video, Audio, AI, Developer, Text, SEO, Business, Social, Utility, Security, Calculator, File Converter and Government tools. The homepage matches the approved deep-space/violet mockup.

## ▶ Run it

```bash
npm install
npm run dev        # development → http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

> Node.js 18.18+ (Node 20 LTS recommended). First `npm install` takes a few minutes.

## ✨ What's included

| Area | Status |
|---|---|
| Homepage (Hero, Stats, Explorer, Features, Newsletter) | ✅ |
| 130 tools × dedicated SEO pages | ✅ |
| 15 category landing pages | ✅ |
| ⌘K command palette + AI Assistant panel | ✅ |
| Auth (login/signup) + Dashboard | ✅ |
| Legal pages (Privacy, Terms, GDPR, etc.) | ✅ |
| Blog + Help + Status + Contact | ✅ |
| API routes (health, search, tools, newsletter) | ✅ |
| Sitemap (XML + HTML) + robots.txt | ✅ |

## ✨ How the tools work

- **Everything runs in the browser** wherever possible — files never leave the device (privacy by design).
- **PDF tools** — pdf-lib + pdf.js (merge, split, compress, protect w/ real AES encryption, sign, edit, convert).
- **Image tools** — Canvas engine (convert/compress/resize/crop/rotate/watermark/upscale/enhance) + Indian govt photo presets (PAN, Aadhaar, Passport, SSC/UPSC/IBPS/NEET).
- **Background Remover / Changer** — real AI model (@imgly, WASM) loaded from CDN on first use (~40MB, cached).
- **Video/Audio tools** — FFmpeg WebAssembly (convert, compress, trim, merge, split, watermark, GIF, voice changer, noise remover). First use downloads the engine (~30MB, cached).
- **OCR** — Tesseract.js (8 languages) for images and scanned PDFs.
- **AI tools** — work FREE out of the box (Pollinations fallback). For best quality, add your own **Google Gemini API key** via the ✨ AI Assistant → ⚙ settings (stored only in your browser; free key at aistudio.google.com).
- **AI Image Generator** — free generation via Pollinations.
- **Server-side tools** — SEO Analyzer, SSL Checker, URL Scanner, Instagram DP use Next.js API routes.

## 🗂 Structure

```
app/                  pages, API routes, sitemap, robots, legal, auth, dashboard
components/           layout, homepage, GlobalUI (⌘K, AI panel, toasts, theme)
components/tool/      ToolRunner dispatcher + 21 runner engines powering all 130 tools
data/                 categories.ts (15) · tools.ts (130 tools — single source of truth)
lib/                  ai.ts · pdf.ts · image.ts · auth.ts · api-response.ts
```

Adding a tool = add one entry in `data/tools.ts` → it automatically appears in search, sitemap, its category grid and gets its own SEO-ready page.

## 🔌 API endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Uptime / status check |
| `/api/search?q=` | GET | Fuzzy search across all tools (+ query logging) |
| `/api/tools` | GET | List tools (filter by category, sort) |
| `/api/tools/[toolId]` | GET | Single tool metadata |
| `/api/jobs` | GET/POST | Signed-in user's tool history (record + list) |
| `/api/newsletter/subscribe` | POST | Newsletter signup → Supabase |
| `/api/newsletter/unsubscribe` | POST | Newsletter opt-out (+ `/unsubscribe` page) |
| `/api/account/delete` | POST | Permanent account deletion (GDPR) |
| `/api/contact` | POST | Contact form → Supabase |
| `/api/analytics/track` | POST | Fire-and-forget event tracking |
| `/api/ai/chat` | POST | Streaming Gemini chat (rate-limited; free 10/day, Pro unlimited) |
| `/api/billing/checkout` | POST | Stripe Checkout session (Pro upgrade) |
| `/api/billing/webhook` | POST | Stripe webhook (plan upgrade/downgrade) |
| `/api/seo/analyze` | POST | SEO Analyzer backend |
| `/api/security/ssl` | POST | SSL Checker backend |
| `/api/security/scan` | POST | URL Scanner backend |
| `/api/social/instagram` | GET | Instagram DP fetch |

## 🗄 Database setup (Supabase)

1. Create a project at supabase.com → copy URL + anon key + service-role key into `.env.local`
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql) — creates `profiles` (auto-created on signup via trigger), `jobs`, `newsletter_subscribers`, `contact_messages`, `search_logs`, `analytics_events`, all with Row Level Security
3. Enable Google/GitHub OAuth providers in Supabase Auth settings (optional)

Everything degrades gracefully — without Supabase env vars the app still runs (auth-dependent features simply stay off).

## 💳 Stripe setup (Pro billing)

1. Create a Product + monthly Price in Stripe → set `STRIPE_PRICE_ID_PRO_MONTHLY`
2. Set `STRIPE_SECRET_KEY`, and add a webhook endpoint pointing to `/api/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.deleted`) → set `STRIPE_WEBHOOK_SECRET`
3. Upgrade button on `/dashboard/billing` then goes live automatically

## 👤 Auth & Dashboard

- `/login` · `/signup` — Supabase Auth (email/password + OAuth)
- `/dashboard` — overview, storage, tools-used-today (live from `jobs`)
- `/dashboard/history` — real job history table · `/billing` — Stripe upgrade · `/settings` — profile

## ⌨ Tips

- **⌘K / Ctrl+K** — command palette (search all tools)
- Theme toggle, notifications, AI Assistant — top right
- Deploy on Vercel: import repo → deploy (zero config)

## 🚀 Production checklist

Connect these env vars for full production (see `CLAUDE.md` for full list):

- `GEMINI_API_KEY` — server-side AI (optional; users can bring their own key)
- `NEXT_PUBLIC_SUPABASE_URL` + keys — real auth & database
- `STRIPE_SECRET_KEY` — Pro billing checkout
- `RESEND_API_KEY` — transactional email
