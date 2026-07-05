# ToolNest — PDF to Word Ultimate Enterprise Spec v1.0

**Tool:** PDF to Word (`/tools/pdf/pdf-to-word`)  
**Goal:** Duniya ke **sabse advanced** PDF→Word converter — jo **har competitor ke paas jo hai wo sab** rakhe, aur upar se aisi cheezein jo **aaj tak kisi ke paas nahi**.  
**Research date:** July 2026  
**Competitors analyzed:** 20 PDF tool sites + PanCardResizer.com (Government document UX reference)

---

## 0. Executive Summary

| Dimension | Market today (iLovePDF, Adobe, Smallpdf…) | ToolNest target |
|---|---|---|
| Core conversion | Server-side, Solid Documents / ABBYY engines, layout preservation | **Hybrid:** browser-first + optional cloud turbo; **pdf2docx** layout engine + custom Indic layer |
| OCR | 20–30 languages, Pro-gated on most sites | **40+ languages**, free OCR, **Indic Unicode repair + AI** (already partial) |
| Privacy | Files upload → delete in 1–24 hrs | **Privacy Ledger:** prove file never left device (default mode) |
| India / Gov docs | Koi site specialize nahi karti | **NSDL/UTI/Income Tax portal presets**, Bengali/Hindi legal PDF reconstruction |
| AI | Chat-with-PDF alag tool; conversion me AI rare | **AI Layout Doctor™**, confidence score, visual diff, one-click fix |
| Workflows | iLovePDF Premium only, PDF-only chains | **Free cross-tool pipelines** (PDF→Word→edit→compress→share) |
| UI | Single upload box + Convert | **5-step enterprise wizard** (Upload → Analyze → Options → Convert → Review) |

**Honest current state (July 2026):** `PdfConvertRunner` (`mode: pdf2word`) abhi sirf plain text → DOCX banata hai — **layout, images, tables preserve nahi hote**. Bengali OCR + AI repair **world-first edge** hai, par overall fidelity competitors se **peeche** hai. Ye spec us gap ko band karta hai aur duniya se aage le jaata hai.

---

## 1. Competitor Deep-Dive (PDF to Word specific)

Har site ka PDF→Word feature set, limits, aur ToolNest ke liye learnings.

### 1.1 Tier 1 — Market Leaders

#### iLovePDF — https://www.ilovepdf.com/pdf_to_word
| Aspect | Detail |
|---|---|
| Engine | **Solid Documents** (industry gold standard for layout) |
| Upload | Drag-drop, Google Drive, Dropbox |
| OCR | Available (often Premium) |
| Output | DOCX |
| Batch | Up to 3 files (free) |
| Limits | ~25 MB free, 1 file/day free tier |
| Strengths | Brand trust, accuracy marketing, ecosystem (merge/split/compress same account) |
| Weaknesses | Server upload mandatory, OCR paywalled, no India-specific, no quality score |
| **ToolNest must match** | Drive/Dropbox import, batch, layout preservation, DOCX output |
| **ToolNest must beat** | Free OCR, browser-local mode, Indic repair, AI diff, no daily file cap (ads model) |

#### Smallpdf — https://smallpdf.com/pdf-to-word
| Aspect | Detail |
|---|---|
| Engine | Solid Documents + **ABBYY** for OCR |
| OCR | Pro feature for scanned PDFs |
| Limits | 2 tasks/day free, 5 GB max (generous size) |
| Certifications | GDPR, ISO/IEC 27001 |
| Extras | Mobile app, offline Windows app, AI PDF Assistant (separate), 30+ PDF tools |
| Strengths | Formatting preservation marketing, track-changes workflow story |
| Weaknesses | Aggressive paywall, server-side only |
| **ToolNest must match** | OCR toggle, formatting preservation claims (with proof), mobile PWA |
| **ToolNest must beat** | Free unlimited OCR, conversion confidence report, privacy proof |

#### Adobe Acrobat Online — https://www.adobe.com/acrobat/online/pdf-to-word.html
| Aspect | Detail |
|---|---|
| Engine | Adobe's own (PDF inventor) — **best complex layout** (multi-column, tables, footnotes) |
| OCR | Built-in for scanned PDFs |
| Output | DOCX, DOC, RTF |
| Limits | Daily free conversions, sign-in for repeat downloads |
| Strengths | Highest fidelity on complex docs, image preservation, equation handling |
| Weaknesses | Login push, expensive Pro, slow, no batch free |
| **ToolNest must match** | Multi-column + table reconstruction, image embed, DOC + RTF export options |
| **ToolNest must beat** | No login for download, free batch, Indic scripts, visual diff |

#### Sejda — https://www.sejda.com/pdf-to-word
| Aspect | Detail |
|---|---|
| Modes | **"Keep layout"** vs **"Easy reading on Kindle"** (reflow) |
| Limits | 50 pages / 50 MB / 3 tasks per hour free; 20 pages OCR free |
| Password PDFs | Owner password prompt |
| Desktop | Offline app (files never leave PC) |
| Strengths | Honest limits, layout vs reflow choice, encrypted PDF support |
| Weaknesses | Dated UI, no AI |
| **ToolNest must match** | Layout vs Reflow modes, password-unlock flow, page-range selection |
| **ToolNest must beat** | Higher free limits, AI optimize, Kindle preset + more (Gov forms) |

#### PDF24 — https://tools.pdf24.org/en/pdf-to-word
| Aspect | Detail |
|---|---|
| Model | **100% free**, ad-funded, no registration |
| Unique options | **DPI**, image quality %, conversion **modes**: Text only / Embedded SVGs / Complete / Blocks / Fixed Flow / PDF Flow |
| Limits | Effectively unlimited |
| Servers | Germany, SSL, 1-hour auto-delete |
| Strengths | Most granular conversion modes of any free tool |
| Weaknesses | Plain UI, no AI, server-side |
| **ToolNest must match** | All 6 conversion modes + DPI/quality sliders |
| **ToolNest must beat** | Same modes in browser-local, plus AI mode picker ("best mode for this PDF") |

---

### 1.2 Tier 2 — Strong Specialists

#### PDF Candy — https://pdfcandy.com/pdf-to-word.html
| Languages | 15 UI languages |
| Features | Auto OCR on scans, batch, cloud import (Drive/Dropbox), **zoom preview before convert**, share via link/QR |
| Limits | 50 MB free, hourly caps on Pro features |
| Ecosystem | 90+ tools, desktop + web bundle |
| **ToolNest must match** | Pre-convert preview/zoom, QR share, batch |
| **ToolNest must beat** | Free share links (Candy gates some), AI preview of output quality |

#### PDF2Go — https://www.pdf2go.com/pdf-to-word
| OCR | **Premium** — language selector, auto-rotate preprocess |
| Output | DOCX or DOC (Word 2003) |
| Modes | "Convert" vs **"Convert with OCR"** explicit split |
| Strengths | Clear scanned-vs-digital UX, table/list detection marketing |
| **ToolNest must match** | DOC + DOCX export, OCR language picker, auto-deskew on scan |
| **ToolNest must beat** | Free OCR, AI table reconstruction |

#### Soda PDF — https://www.sodapdf.com/pdf-to-word/
| Limits | 3 MB / 2 files per day free |
| Cloud | Google Drive, Dropbox, OneDrive |
| OCR | Paid for download step on some flows |
| **ToolNest must match** | OneDrive import (Microsoft ecosystem India gov/corp) |
| **ToolNest must beat** | No 3 MB joke limit |

#### DocHub — https://www.dochub.com/
| Focus | Editor-first, not converter-first |
| Collaboration | Real-time annotations, Google Workspace |
| **ToolNest learnings** | Post-conversion: **"Open in ToolNest Editor"** + Google Docs export one-click |
| **ToolNest must beat** | Full converter + editor in one platform (128 tools) |

#### FreePDFConvert — https://www.freepdfconvert.com/pdf-to-word
| Features | 256-bit SSL, auto-delete, 20-tool suite cross-sell |
| Limits | Heavy signup wall for 2nd file |
| **ToolNest must match** | SSL badge, instant delete proof |
| **ToolNest must beat** | No signup wall |

#### LightPDF — https://www.lightpdf.com/pdf-to-word
| Marketing | "≥90% accuracy" comparison table vs competitors |
| Features | OCR, multi-platform, 24/7 support claim, clean UI (no ads claim) |
| **ToolNest must match** | Published accuracy benchmarks (honest, per doc-type) |
| **ToolNest must beat** | Real measured score per conversion, not marketing fluff |

#### PDFgear — https://www.pdfgear.com/pdf-to-word/
| Modes | **Standard** vs **Advanced (OCR)** |
| Limits | 100 MB online; unlimited desktop |
| Privacy | Delete on window close, 20 min server retention |
| Friction | Social share to unlock (annoying) |
| **ToolNest must match** | Standard/Advanced mode toggle |
| **ToolNest must beat** | No social-share gate, better OCR (Indic) |

#### Xodo — https://www.xodo.com/
| Focus | Viewer/annotator; conversion secondary |
| **ToolNest learnings** | Strong mobile annotation → post-convert annotate in browser |
| **ToolNest must beat** | Dedicated best-in-class converter, not side feature |

#### AvePDF — https://www.avepdf.com/
| Extras | Deskew, blank page removal, PDF/A, digital signature validation |
| **ToolNest must match** | Pre-convert: deskew + despeckle for scans (Gov applications) |
| **ToolNest must beat** | One-click "Gov scan optimize" preset |

#### CleverPDF — https://www.cleverpdf.com/pdf-to-word
| Output | DOC or DOCX choice |
| Limits | 20 MB free web |
| Desktop | 24-in-1 Windows, 20-in-1 Mac, batch offline |
| Encrypted PDF | Password prompt |
| **ToolNest must match** | DOC legacy export, encrypted PDF unlock |
| **ToolNest must beat** | Browser batch without 20 MB cap (tier-based) |

#### HiPDF — https://www.hipdf.com/pdf-to-word
| Certs | ISO 27001, PDF Association member |
| OCR | Pro-gated for best results |
| AI | Separate AI chat; claims AI improves conversion speed |
| Delete | 60 minutes |
| **ToolNest must match** | Industry trust badges, education/legal/IT use-case landing copy |
| **ToolNest must beat** | AI inside conversion (not separate paid tool) |

#### Hipdf-adjacent: **iLovePDF2** — https://www.ilovepdf2.com/
| Note | Low-quality clone — ignore product, **SEO clone patterns** only |
| **ToolNest action** | Canonical URLs, structured data, Hindi/Bengali landing pages to outrank clones |

#### Online2PDF — https://www.online2pdf.com/convert/pdf-to-word
| OCR | 30+ languages, max 100 pages with OCR / 500 without |
| Advanced | **Advanced OCR** on whole file (not just scans), insert pages as images option |
| Batch | Per-file settings in one job |
| **ToolNest must match** | Per-file OCR language in batch, page-as-image fallback mode |
| **ToolNest must beat** | AI picks OCR language from content |

#### PDFescape — https://www.pdfescape.com/
| Limits | 10 MB / 100 pages free |
| **ToolNest must beat** | Higher limits, modern UI |

---

### 1.3 PanCardResizer.com — Government UX Reference

**URL:** https://pancardresizer.com/

Ye PDF→Word competitor nahi hai, par **Indian government document UX** ka best free reference hai. PDF to Word me iska DNA embed karna hai jab users **Income Tax, NSDL, UTI, GST, MCA** ke PDF forms ko Word me edit karna chahte hain.

| PanCardResizer feature | PDF to Word me kaise use karein |
|---|---|
| Browser-only processing | Default **Local Mode** — file device se bahar na jaye |
| Crop + brightness/contrast | **Pre-convert scan enhance** step for gov scans |
| Portal-specific presets (NSDL/UTI) | **Portal Preset Pack:** IT return PDF, PAN acknowledgement, Aadhaar letter, Form 16 |
| Hindi + English UI | Full **hi/bn/en** tool UI + OCR defaults |
| Unlimited free | ToolNest ads model — same promise |
| Simple 3-step UX | Wizard Step 1: Upload → Step 2: "Kis portal ke liye?" preset |

**ToolNest unique (kisi ke paas nahi):** PDF→Word with **Form Field Intelligence** — detect AcroForm fields in gov PDFs → convert to Word **content controls** (fillable), not flat text.

---

## 2. Master Feature Parity Matrix

**Rule:** ✅ = competitor me common hai (ToolNest me **mandatory**). ⭐ = ToolNest exclusive target.

| # | Feature | iLove | Small | Adobe | Sejda | PDF24 | Candy | PDF2Go | Others | ToolNest Phase |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| P1 | Drag-drop upload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **P0** (done) |
| P2 | Google Drive import | ✅ | ✅ | — | ✅ | — | ✅ | — | Soda | **P0** |
| P3 | Dropbox import | ✅ | ✅ | — | ✅ | — | ✅ | — | Soda | **P0** |
| P4 | OneDrive import | — | — | — | — | — | — | — | Soda | **P1** |
| P5 | URL import (PDF link) | — | — | — | — | — | — | — | Candy | **P1** |
| P6 | Batch convert (multi PDF) | ✅ | Pro | Pro | Pro | ✅ | ✅ | — | Clever desktop | **P0** |
| P7 | DOCX output | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **P0** (done) |
| P8 | DOC (Word 2003) output | — | — | ✅ | — | — | — | ✅ | Clever | **P1** |
| P9 | RTF output | — | — | ✅ | — | — | — | — | — | **P2** |
| P10 | Layout preservation (tables, columns) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **P0** ← critical gap |
| P11 | Images preserved in Word | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **P0** |
| P12 | Fonts bold/italic/underline | ✅ | ✅ | ✅ | — | — | — | — | PDFgear | **P1** |
| P13 | Headers/footers → Word HF | — | — | ✅ | — | — | — | — | — | **P1** |
| P14 | OCR for scanned PDFs | Pro | Pro | ✅ | ✅ | — | ✅ | Premium | Most | **P0** (partial) |
| P15 | OCR language selection (30+) | — | — | — | — | 30+ | — | ✅ | Online2PDF | **P0** |
| P16 | Auto-detect scan vs digital | — | — | ✅ | — | — | ✅ | ✅ | PDFgear | **P0** |
| P17 | Password-protected PDF unlock | — | — | — | ✅ | — | — | — | Clever | **P0** |
| P18 | Page range (e.g. 1-5, 8) | — | — | — | — | ✅ | — | — | Online2PDF | **P0** |
| P19 | Layout mode vs Reflow mode | — | — | — | ✅ | ✅ | — | — | PDF24 | **P0** |
| P20 | DPI / image quality control | — | — | — | — | ✅ | — | — | — | **P1** |
| P21 | Text-only / Flow / Blocks modes | — | — | — | — | ✅ | — | — | — | **P1** |
| P22 | Pre-convert PDF preview/zoom | — | — | — | — | — | ✅ | — | — | **P1** |
| P23 | Download + Share link + QR | — | — | — | — | — | ✅ | — | ToolNest Share | **P0** (Share exists) |
| P24 | Auto-delete / privacy policy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **P0** |
| P25 | Mobile / PWA | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | **P1** |
| P26 | Desktop offline app | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | PDFgear | **P2** (PWA first) |
| P27 | No signup required | ✅ | ✅ | Limited | ✅ | ✅ | ✅ | ✅ | Mixed | **P0** |
| P28 | Track changes compatible output | — | ✅ | ✅ | — | — | — | — | — | **P1** |
| ⭐1 | **Indic Unicode AI repair** | — | — | — | — | — | — | — | — | **P0** (done) |
| ⭐2 | **Conversion Confidence Score** | — | — | — | — | — | — | — | — | **P0** |
| ⭐3 | **Visual Diff (PDF vs Word)** | — | — | — | — | — | — | — | — | **P0** |
| ⭐4 | **Privacy Ledger (network proof)** | — | — | — | — | — | — | — | — | **P1** |
| ⭐5 | **Gov Portal Presets** | — | — | — | — | — | — | — | — | **P1** |
| ⭐6 | **AI Layout Doctor™** | — | — | — | — | — | — | — | — | **P1** |
| ⭐7 | **Form → Content Controls** | — | — | — | — | — | — | — | — | **P2** |
| ⭐8 | **Free Tool Pipelines** | — | — | — | — | — | — | — | — | **P2** |
| ⭐9 | **Bengali/Hindi SEO landing** | — | — | — | — | — | — | — | — | **P0** |

---

## 3. World-First Features (Kisi Ke Paas Nahi)

Ye features ToolNest ko **category-of-one** banayenge:

### 3.1 AI Layout Doctor™
- Conversion ke baad Gemini Vision **PDF page vs Word preview** compare kare
- Issues detect: broken table, merged columns, missing image, wrong font script
- **One-click fix** suggestions: "Re-run page 3 with Blocks mode", "Enable Indic repair"
- Output: annotated report PDF + fixed DOCX
- **Kyun unique:** Adobe/Smallpdf sirf "formatting preserved" claim karte hain — **proof + auto-fix koi nahi deta**

### 3.2 Conversion Confidence Score™ (0–100)
Har conversion par real metrics:
| Metric | Weight |
|---|---|
| Text layer coverage | 20% |
| Table cell integrity | 20% |
| Image placement match | 15% |
| Font/script accuracy | 15% |
| OCR confidence (if used) | 15% |
| Indic repair applied/fix count | 15% |
- User ko dashboard: "This DOCX is **87% faithful** — 2 tables need manual fix on page 4"
- **Kyun unique:** LightPDF "90%" marketing claim karta hai; hum **per-file measured score** denge

### 3.3 Visual Side-by-Side Diff
- Left: PDF page render (canvas)
- Right: Word preview (docx-preview lib)
- Slider overlay + highlight regions with >5% pixel diff
- Export diff as PNG for audit (legal/corp users)
- **Kyun unique:** Koi consumer PDF site conversion quality visually prove nahi karta

### 3.4 Indic Document Intelligence™ (extend existing)
Already: `extractPdfTextSmart` + `restoreBengaliText` + `normalizeIndicPage`

**Upgrade to world-best:**
- Scripts: Bengali, Hindi, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu
- **Shattered glyph repair** (PDF ToUnicode CMap bugs — common in govt PDFs)
- **Bilingual reconstruction:** English label + Bengali value table columns restore
- **AI transliteration guard:** don't corrupt proper nouns
- SEO: own "Bengali PDF to Word", "Hindi scanned PDF editable" globally

### 3.5 Government & India Preset Pack
| Preset | What it does |
|---|---|
| Income Tax Return | Multi-column IT form layout, DIN fonts |
| Form 16 | Table-heavy salary breakdown preserve |
| PAN Acknowledgement | Single-page letter format |
| Aadhaar Letter | Mixed Hindi-English |
| GST Invoice | Line items → Word table |
| MCA / ROC filing | Legal numbering styles |
| NSDL / UTIITSL portal | Match their PDF generation quirks |

Inspired by PanCardResizer's portal thinking, applied to **Word editing** use case.

### 3.6 Privacy Ledger™
Live panel on tool page:
```
✓ File read locally (ArrayBuffer in browser)
✓ OCR ran in Web Worker (Tesseract WASM)
✓ 0 bytes uploaded
✓ Network requests: 0 (expandable log)
```
Optional **Cloud Turbo Mode** (Pro): upload for Solid-grade server engine — user explicitly opts in.

**Kyun unique:** Sab sites "secure" kehte hain; koi **cryptographic-style proof UI** nahi dikhata.

### 3.7 Smart Mode Picker (AI)
User ko 6 modes (PDF24-style) choose karne ki zarurat nahi:
1. Upload PDF
2. AI analyzes: digital vs scan, languages, tables, columns
3. Recommends: "Best mode: **Blocks** + OCR **ben+eng** + **Gov Form 16 preset**"
4. User override allowed (power users)

### 3.8 ToolNest Pipelines™ (Free)
Example chains (iLovePDF Premium me paid + PDF-only):
- `PDF → Word → Compress → Share link`
- `Scanned PDF → OCR Word → AI Summarize → TXT`
- `Form 16 PDF → Word → Edit → Word to PDF → Sign PDF`

One-click from PDF to Word result screen.

### 3.9 Form Field → Word Content Controls
Gov / tax PDFs often have AcroForm fields.
- Detect fields + export as Word **SDT content controls** (fillable)
- Flatten option for static copy
- **Kyun unique:** Adobe karta hai par free online tool me **koi nahi**

### 3.10 Honest History + Re-convert
- Job history: original PDF hash, settings used, confidence score
- "Re-run with different mode" one click
- Compare two conversion attempts side-by-side
- Tied to Universal Jobs engine + dashboard

---

## 4. Enterprise UI/UX Spec (Merge PDF parity)

PDF to Word ko **generic upload box** se nikal kar **5-step wizard** — same design language as Merge PDF / PDF Converter enterprise.

### 4.1 Step Flow

```
[1 Upload] → [2 Analyze] → [3 Options] → [4 Convert] → [5 Review & Download]
```

#### Step 1 — Upload
- Hero drop zone (dashed violet, glass card)
- **FAB row** (below drop zone, left): AI Assistant | History | Settings | Share
- Feature badges (light, above fold): `Drag & Drop` · `Batch` · `OCR` · `100% Private` · `Indic AI`
- Import chips: Device | Drive | Dropbox | OneDrive | URL
- Batch: multi-file queue with thumbnails + per-file remove
- Password prompt inline for encrypted PDFs

#### Step 2 — Analyze (auto on upload)
- Progress ring + stage labels: "Detecting text layer…" / "Scanning for tables…" / "Language: Bengali + English"
- **Document profile card:**
  - Type: Digital PDF | Scanned | Mixed
  - Pages: N | Encrypted: Yes/No
  - Tables detected: N | Images: N | Columns: 1/2/3
  - Languages: auto-detected chips
  - **Recommended mode** badge (AI)
- Page thumbnails strip — click to include/exclude pages
- **Gov preset suggestion:** "Looks like Form 16 — apply preset?"

#### Step 3 — Options
**Conversion engine**
| Mode | Description | When |
|---|---|---|
| Smart (AI pick) | Auto | Default |
| Layout Exact | pdf2docx blocks | Digital PDFs, tables |
| Reflow | Reading order | Kindle / mobile edit |
| Text Only | Fast, no images | Notes, contracts text |
| OCR Deep | Tesseract + deskew | Scans |
| Gov Preset | Portal-tuned | Indian forms |

**OCR panel** (if scan detected)
- Language multi-select (searchable, 40+ langs)
- DPI upscale: 150 / 300 / 600
- Deskew + despeckle toggles
- Indic AI repair toggle (default ON for ben/hin)

**Output**
- Format: DOCX | DOC | RTF
- Page range: All | Custom (1-3,5)
- Embed images: Yes | Placeholder | Skip
- Headers/footers: Preserve | Body only

**Privacy**
- ◉ Local (browser) — recommended
- ○ Cloud Turbo (Pro) — max fidelity, uploads encrypted

#### Step 4 — Convert
- Full-width progress with per-page tick marks
- Live log (collapsible): "Page 4: OCR 94% confidence, Indic repair applied"
- Cancel anytime
- Auto-save session to `localStorage` + cloud if logged in

#### Step 5 — Review & Download
- **Confidence Score** big number + breakdown bars
- **Visual Diff** tab (side-by-side)
- **AI Layout Doctor** panel with issues + fix buttons
- Download DOCX | Download ZIP (batch) | Save to Cloud | Share (link/QR/email)
- **Pipeline CTAs:** "Compress Word" · "Convert back to PDF" · "Summarize with AI"
- Before/after file size
- "Process another" | "Re-convert with different settings"

### 4.2 FAB Actions (portal dropdowns — Merge PDF pattern)
| FAB | Menu items |
|---|---|
| **AI** | Ask about this PDF, Fix layout issues, Summarize, Translate to Hindi |
| **History** | Last 10 conversions (local + account), re-run, compare |
| **Settings** | Default mode, default OCR langs, auto AI repair, filename pattern |
| **Share** | ShareModal (existing) |

### 4.3 Theme
- Full light/dark via design tokens (`--bg-surface`, no hardcoded dark rgba)
- `[data-theme='light']` overrides for FAB + menus
- Framer Motion: step transitions, card hover, progress ring
- `prefers-reduced-motion` respected

---

## 5. Technical Architecture

### 5.1 New files (proposed)

```
lib/engines/pdf-to-word-engine.ts     # Core conversion orchestration
lib/engines/pdf-layout-analyzer.ts    # Pre-analyze: tables, cols, langs, scan detect
lib/engines/pdf-word-confidence.ts      # Score calculator
lib/engines/pdf-word-diff.ts            # Visual diff helpers
lib/engines/gov-pdf-presets.ts          # Portal-specific tuning params
components/tool/runners/PdfToWordRunner.tsx   # Replace pdf2word in PdfConvertRunner
components/tool/runners/PdfToWordDiff.tsx     # Side-by-side viewer
app/globals.css                           # .pdfword-* styles (mirror mergepdf-*)
```

### 5.2 Conversion pipeline (browser-local default)

```
PDF File
  → pdf.js: metadata, page count, text layer probe, render thumbs
  → pdf-layout-analyzer: tables (tabula-js or custom heuristic), columns, images bbox
  → Branch:
      A) Strong text layer → pdf2docx (WASM/Python worker) OR custom block reconstructor
      B) Weak text layer → render pages → Tesseract WASM (multi-lang) → merge with layout hints
  → indic-normalize + restoreBengaliText (per page, fail-soft)
  → docx: docx.js with tables, images (from pdf.js render), styles, page breaks
  → pdf-word-confidence: score
  → Optional: Gemini Vision layout doctor (Pro / AI credits)
```

### 5.3 Engine choices

| Layer | Library / Service | Notes |
|---|---|---|
| Layout (digital PDF) | **pdf2docx** (Python worker) or **Nutrient**/commercial API for Cloud Turbo | pdf2docx MIT, best open-source layout |
| DOCX build | `docx` npm + custom table/image builders | Already used |
| OCR | Tesseract.js WASM | Already used; expand langs |
| PDF parse | pdf.js | Already used |
| AI repair | Gemini (`restoreBengaliText`, Vision diff) | Already partial |
| Cloud Turbo (Pro) | LibreOffice headless OR Solid API partner | Server-side max fidelity |
| Encrypted PDF | pdf.js password + pdf-lib decrypt | New |

### 5.4 `data/tools.ts` update

```ts
{
  id: 15,
  slug: 'pdf-to-word',
  name: 'PDF to Word',
  description: 'Convert PDF to editable Word with AI layout repair, OCR, and Indic script support — more accurate than iLovePDF or Adobe for Indian documents.',
  runner: 'pdf-to-word',  // dedicated runner
  mode: 'pdf2word',
  accept: PDF,
  multiple: true,
  badge: 'popular',
  keywords: [..., 'bengali pdf to word', 'hindi pdf to word', 'scanned pdf to word', 'form 16 pdf to word'],
}
```

### 5.5 API routes (optional Cloud Turbo)

| Route | Method | Purpose |
|---|---|---|
| `/api/tools/pdf-to-word/analyze` | POST | Server-side deep analyze (Pro) |
| `/api/tools/pdf-to-word/convert` | POST | Cloud Turbo conversion job |
| `/api/jobs/[id]` | GET | Poll progress |

Browser-local path uses **no API** — Privacy Ledger shows zero requests.

### 5.6 Limits (Pro vs Free — align Section 21 master spec)

| | Free | Pro |
|---|---|---|
| Files/day | 5 | Unlimited |
| Max size | 25 MB | 2 GB |
| Batch | 3 files | 50 files |
| OCR pages | 20 | Unlimited |
| Cloud Turbo | — | ✓ |
| AI Layout Doctor | 3/day | Unlimited |
| Watermark | None (ToolNest policy: no watermark on docs) | — |

---

## 6. SEO & Content Strategy

### 6.1 Primary keywords (English)
- pdf to word converter free
- convert pdf to word online
- pdf to docx
- scanned pdf to word ocr

### 6.2 India-first keywords (Hindi/Bengali landing pages)
- pdf to word hindi
- bengali pdf to word converter
- form 16 pdf to word editable
- pan card pdf edit word
- scanned hindi pdf word me convert

### 6.3 Page meta
- **Title:** `PDF to Word Converter — Free OCR, AI Layout Repair & Indic Support | ToolNest`
- **Description:** `Convert PDF to editable DOCX with 90%+ layout accuracy. Free OCR for scanned PDFs. World-first Bengali/Hindi Unicode repair. 100% private browser mode. Better than iLovePDF & Smallpdf for Indian documents.`
- Schema: `SoftwareApplication` + `FAQPage` + `HowTo`

### 6.4 FAQ (tool page — 6 minimum)
1. Is ToolNest PDF to Word really free?
2. Will my formatting be preserved?
3. Can I convert scanned PDFs without paying?
4. How is ToolNest better for Bengali/Hindi PDFs?
5. Is my file uploaded to a server?
6. Can I convert multiple PDFs at once?

---

## 7. Implementation Roadmap

### Phase P0 — Parity foundation (2 weeks) ← **CRITICAL**
- [ ] New `PdfToWordRunner.tsx` with 5-step wizard shell
- [ ] Integrate **pdf2docx** (worker) for layout + tables + images
- [ ] Page range, batch, DOCX+DOC output
- [ ] OCR language picker (expand Tesseract langs)
- [ ] Auto scan vs digital detection
- [ ] Password PDF unlock
- [ ] Confidence score v1 (text coverage + OCR confidence)
- [ ] Wire ShareModal + job history
- [ ] Keep existing Indic AI repair

### Phase P1 — Differentiators (3 weeks)
- [ ] Visual diff viewer
- [ ] AI Layout Doctor (Gemini Vision)
- [ ] PDF24-style modes (Text/Blocks/Flow) + Sejda Layout/Reflow
- [ ] Gov preset pack (5 presets)
- [ ] Drive/Dropbox/OneDrive import
- [ ] Privacy Ledger UI
- [ ] Pre-convert preview/zoom
- [ ] FAB rail (AI/History/Settings) — Merge PDF pattern
- [ ] Hindi/Bengali landing pages

### Phase P2 — Moat (4 weeks)
- [ ] Form fields → Word content controls
- [ ] ToolNest Pipelines from result screen
- [ ] Cloud Turbo mode (server engine)
- [ ] PWA offline queue
- [ ] Public API endpoint
- [ ] A/B benchmark page: ToolNest vs iLovePDF vs Adobe (honest)

### Phase P3 — Polish
- [ ] Framer Motion step animations
- [ ] Lighthouse ≥90 mobile
- [ ] axe accessibility audit
- [ ] E2E Playwright: upload → convert → download → open DOCX

---

## 8. Success Metrics

| Metric | Target (90 days post-launch) |
|---|---|
| PDF to Word page sessions | Top 3 tool on ToolNest |
| Avg confidence score (digital PDFs) | ≥ 85 |
| Avg confidence score (scanned + Indic) | ≥ 75 |
| Bengali PDF conversions/week | 10,000+ (SEO moat) |
| % conversions fully local | ≥ 70% |
| User-reported "formatting broken" | < 8% (via thumbs down) |
| Lighthouse mobile | ≥ 90 |

---

## 9. Competitive Positioning Statement

> **ToolNest PDF to Word** = iLovePDF ki accuracy + PDF24 ki free unlimited spirit + Adobe ki layout ambition + **India ka pehla Indic-intelligent converter** + privacy proof jo koi nahi deta.

PanCardResizer ne gov **photo** space me prove kiya: Indian users ko **portal-aware, browser-private, unlimited free** chahiye. Wahi philosophy ab **PDF→Word** par — taaki Form 16, IT return, PAN letter, Aadhaar PDF Word me edit ho sake **bina formatting tootey, bina file upload kiye, bina Bengali/Hindi corrupt hue**.

---

## 10. Sources

| Site | URL |
|---|---|
| iLovePDF | https://www.ilovepdf.com/pdf_to_word |
| Smallpdf | https://smallpdf.com/pdf-to-word |
| Adobe Acrobat Online | https://www.adobe.com/acrobat/online/pdf-to-word.html |
| Sejda | https://www.sejda.com/pdf-to-word |
| PDF Candy | https://pdfcandy.com/pdf-to-word.html |
| PDF24 | https://tools.pdf24.org/en/pdf-to-word |
| PDF2Go | https://www.pdf2go.com/pdf-to-word |
| Soda PDF | https://www.sodapdf.com/pdf-to-word/ |
| DocHub | https://www.dochub.com/ |
| FreePDFConvert | https://www.freepdfconvert.com/pdf-to-word |
| LightPDF | https://www.lightpdf.com/pdf-to-word |
| PDFgear | https://www.pdfgear.com/pdf-to-word/ |
| HiPDF | https://www.hipdf.com/pdf-to-word |
| CleverPDF | https://www.cleverpdf.com/pdf-to-word |
| Online2PDF | https://www.online2pdf.com/convert/pdf-to-word |
| PanCardResizer | https://pancardresizer.com/ |
| Market research | pdf4.dev 2026 comparison, SoftPicker 2026, nutrient.io pdf2docx guide |

---

*Document owner: ToolNestFM / Faruk Mondal · Fam Cloud Pvt. Ltd. · Version 1.0 · July 2026*
