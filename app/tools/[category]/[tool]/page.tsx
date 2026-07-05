import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/Icon';
import ToolCard from '@/components/ToolCard';
import ToolRunner from '@/components/tool/ToolRunner';
import ToolUsageStat from '@/components/tool/ToolUsageStat';
import FeatureStrip from '@/components/homepage/FeatureStrip';
import { ToolMidAd, ToolPreFooterAd, ToolSidebarAd, ToolSmartlink } from '@/components/ads/ToolPageAds';
import { getCategory } from '@/data/categories';
import { getTool, getToolsByCategory, tools } from '@/data/tools';

interface Props { params: Promise<{ category: string; tool: string }> }

export function generateStaticParams() {
  return tools.map((t) => ({ category: t.category, tool: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const cat = getCategory(tool.category);

  if (slug === 'pdf-converter') {
    return {
      title: 'PDF Converter - Convert PDF to Word, Excel, JPG & More Free | ToolNest',
      description: 'Convert PDF to Word, Excel, PowerPoint, JPG, or convert any file to PDF - free, fast, and secure. No signup required. 100% browser-based processing.',
    };
  }

  if (slug === 'pan-card-photo-resizer') {
    return {
      title: 'PAN Card Photo Resizer — NSDL & UTI AI Tool with Compliance Check | ToolNest',
      description: 'Free AI PAN card photo, signature & document resizer for NSDL (Protean) and UTIITSL. Auto face crop, white background, DPI fix, 12-point compliance validator. 100% private.',
    };
  }

  if (slug === 'image-compressor') {
    return {
      title: 'Image Compressor - Compress Images Online Free | AVIF, WebP, JPEG, PNG | ToolNest',
      description: 'Compress images up to 90% smaller with AI-powered optimization. Supports AVIF, WebP, JPEG, PNG. Batch processing, target file size, social media presets. 100% private — runs in your browser.',
    };
  }

  if (slug === 'pdf-to-word') {
    return {
      title: 'PDF to Word Converter — Free OCR, AI Layout & Indic Support | ToolNest',
      description: 'Convert PDF to editable DOCX with AI layout repair, table detection, Bengali/Hindi OCR, batch mode & confidence score. 100% private browser processing — better than iLovePDF for Indian documents.',
    };
  }

  if (slug === 'compress-pdf') {
    return {
      title: 'PDF Compressor — AI Smart Compression, Batch & Quality Report | ToolNest',
      description: 'Compress PDF files up to 90% smaller with AI smart modes — email, web, print, lossless. Batch queue, compression report, password PDF support. Free & 100% private.',
    };
  }

  if (slug === 'background-remover') {
    return {
      title: 'Background Remover — AI Ultra HD Cutout, Hair Refine & Batch | ToolNest',
      description: 'Remove image backgrounds with AI — hair refinement, erase/restore brush, 14 background presets, batch ZIP export. Free, unlimited, 100% browser-private.',
    };
  }

  if (slug === 'merge-pdf') {
    return {
      title: 'Merge PDF — AI Organize, 10 Merge Modes & Premium Workflow | ToolNest',
      description: 'Merge multiple PDFs with AI page analysis, drag reorder, optimize modes for PAN/passport/book, batch merge. Free & 100% private browser processing.',
    };
  }

  if (slug === 'ai-chat') {
    return {
      title: 'AI Chat Assistant — 6 Personas, Streaming, History & Markdown | ToolNest',
      description: 'Free advanced AI chat powered by Gemini — General, Code, Creative, Analyst, Teacher modes. Chat history, PDF attach, temperature control, export & regenerate.',
    };
  }

  if (slug === 'ai-pdf-assistant') {
    return {
      title: 'AI PDF Assistant — Chat With Your PDF, Summarize & Extract | ToolNest',
      description: 'Upload any PDF and ask questions — summaries, key facts, tables, action items. Powered by Gemini with streaming answers. Free & private.',
    };
  }

  return {
    title: `${tool.name} - Free Online ${cat?.shortName || ''} Tool | ToolNest`,
    description: `${tool.description}. Free, fast and 100% private - runs in your browser. No sign-up required.`,
  };
}

function buildFaq(toolName: string, slug: string): { q: string; a: string }[] {
  if (slug === 'pdf-converter') {
    return [
      { q: 'Is PDF Converter free?', a: 'Yes - unlimited conversions completely free. No signup required, no watermarks. All processing happens directly in your browser.' },
      { q: 'What formats can I convert?', a: 'PDF to Word, Excel, PowerPoint, JPG, PNG, TXT, HTML, Markdown, and CSV. Also convert DOCX, XLSX, images, TXT, HTML, and Markdown back to PDF.' },
      { q: 'Will my PDF layout be preserved?', a: 'For text-based PDFs, layout is preserved as closely as possible. For scanned PDFs, try our PDF OCR tool first for best results.' },
      { q: 'Is it safe to upload sensitive documents?', a: 'Your files never leave your device - all conversion runs 100% in your browser. Nothing is uploaded to any server.' },
      { q: 'What is the maximum file size?', a: 'Since processing is local, the limit depends on your device memory. Files up to several hundred MB work smoothly on modern devices.' },
      { q: 'Can I convert scanned PDFs?', a: 'Scanned (image-only) PDFs work best with our PDF OCR tool first, which extracts text using AI. Then convert the result to Word or other formats.' },
    ];
  }
  if (slug === 'pan-card-photo-resizer') {
    return [
      { q: 'What is the difference between NSDL and UTI PAN photo requirements?', a: 'NSDL (Protean) requires 197×276 px photo at 200 DPI (20–50 KB JPEG). UTIITSL requires 213×213 px at 300 DPI (max 30 KB). Signatures also differ: NSDL 354×157 px, UTI 400×200 px. Our tool auto-applies the correct specs when you select your portal.' },
      { q: 'Why does my PAN photo keep getting rejected?', a: 'The top reasons are wrong dimensions, file size over the KB limit, non-JPEG format (PNG/HEIC), dark or coloured background, and incorrect DPI metadata. ToolNest fixes all of these automatically with AI face crop, white background, force-weight compression, and embedded DPI.' },
      { q: 'What DPI is required for NSDL PAN card photo?', a: 'NSDL requires 200 DPI embedded in the JPEG file. UTI requires 300 DPI for photos and 600 DPI for signatures. Our tool embeds the correct DPI metadata on every download.' },
      { q: 'Can I use a selfie for PAN card application?', a: 'Yes, if it is front-facing with a neutral expression and plain white/light background. Use our camera capture with face guide, or upload a selfie and let AI remove the background and auto-crop to spec.' },
      { q: 'Is this PAN card resizer safe and private?', a: 'Yes — 100% browser-based processing. Your photo never leaves your device. No uploads to ToolNest servers. No account required. Unlimited free use.' },
      { q: 'Can CSC operators use batch mode?', a: 'Yes. Enable Batch Mode to process multiple photos or signatures with the same NSDL/UTI settings. Download each file individually or all at once as a ZIP.' },
      { q: 'Does it work on mobile phones?', a: 'Yes — fully responsive on Android and iPhone. Upload from gallery, capture from camera, pinch-to-zoom while editing, and download ready-to-upload JPEG files.' },
      { q: 'What signature size is required for PAN card?', a: 'NSDL: 354×157 px, 10–50 KB JPEG. UTI: 400×200 px, max 60 KB JPEG. Select Signature in step 2 and the tool applies exact dimensions automatically.' },
    ];
  }
  if (slug === 'image-compressor') {
    return [
      { q: 'How much can I compress my images?', a: 'ToolNest Image Compressor can reduce file size by up to 90% without visible quality loss. AVIF format achieves the best compression (50-70% smaller than JPEG), followed by WebP (25-35% smaller). Use our Compare Codecs tab to see exact results for your specific image.' },
      { q: 'What image formats are supported?', a: 'Input: JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, SVG, ICO, and HEIC/HEIF. Output: JPEG (MozJPEG), PNG (OxiPNG), WebP, AVIF (best compression), and JPEG XL (next-gen). Convert between any format while compressing in a single pass.' },
      { q: 'Is my data safe? Are images uploaded to a server?', a: 'Your images NEVER leave your device. All compression runs 100% in your browser using WebAssembly technology. No server uploads, no data collection, no accounts needed. Works offline after first load.' },
      { q: 'Can I compress images to a specific file size (e.g., 50KB for PAN card)?', a: 'Yes! Use Target Size mode to specify exact file size targets (10KB to 10MB). We also have pre-built Government/Exam presets for PAN Card (≤30KB), Aadhaar (≤100KB), Passport, SSC, UPSC, IBPS, and more — with exact dimensions and size limits auto-applied.' },
      { q: 'How many images can I compress at once?', a: 'Unlimited batch processing — compress 100+ images simultaneously. Our parallel processing engine uses Web Workers to compress multiple images at once without freezing your browser. Download all results as a single ZIP file.' },
      { q: 'What is AVIF and why should I use it?', a: 'AVIF is a next-generation image format (developed by Alliance for Open Media) that achieves 30-50% better compression than WebP and 50-70% better than JPEG at equivalent visual quality. It supports HDR, transparency, and animation. All modern browsers (Chrome, Firefox, Safari, Edge) support AVIF as of 2024+.' },
      { q: 'Can I generate responsive images for my website?', a: 'Yes! Use the Responsive Set tab to generate multiple sizes (150px to 2560px) from a single image. Downloads include srcset-ready filenames and we generate ready-to-use HTML picture/srcset code for your website.' },
      { q: 'How does the Compare Codecs feature work?', a: 'Compare Codecs compresses your image using JPEG, WebP, AVIF, and PNG simultaneously at the same quality level, then shows you the results side-by-side with exact file sizes, compression ratios, and processing times. Download whichever version works best for your needs.' },
      { q: 'Does it work on mobile phones?', a: 'Yes — fully responsive and works on any modern browser (Chrome, Safari, Firefox, Edge) on iOS, Android, and desktop. The WebAssembly compression engine runs efficiently even on mobile devices.' },
      { q: 'How is this different from TinyPNG or Squoosh?', a: 'ToolNest combines the best of both: Squoosh-level quality control (AVIF, WebP, manual settings, comparison slider) + TinyPNG-level batch processing (unlimited images) + features neither has: AI-powered auto-settings, target file size mode, social media presets, responsive image generation, government document presets, and compression reports — all in one tool, all 100% free and private.' },
    ];
  }
  if (slug === 'pdf-to-word') {
    return [
      { q: 'Is PDF to Word conversion free?', a: 'Yes — unlimited conversions, no signup, no watermarks. OCR and Indic AI repair are included free.' },
      { q: 'Will formatting be preserved?', a: 'Layout Exact mode preserves tables, fonts and structure. A confidence score shows how faithful the output is. Scanned PDFs use OCR automatically.' },
      { q: 'Does it work for Bengali and Hindi PDFs?', a: 'Yes — world-first Indic Unicode AI repair fixes broken Bengali/Hindi text from government PDFs. OCR supports ben+eng, hin+eng and more.' },
      { q: 'Are my files uploaded to a server?', a: 'No. Default Local Mode processes everything in your browser. Privacy Ledger shows zero network uploads.' },
      { q: 'Can I convert scanned PDFs?', a: 'Yes. OCR runs automatically when the text layer is weak. Use OCR Deep mode for full-page scan conversion.' },
      { q: 'Can I convert multiple PDFs?', a: 'Yes — batch upload up to 3 files (free tier). Download as individual DOCX files or a ZIP.' },
    ];
  }
  if (slug === 'compress-pdf') {
    return [
      { q: 'How much can I compress a PDF?', a: 'Typically 40–85% reduction for image-heavy PDFs. AI Analyze shows compression potential before you compress.' },
      { q: 'Which compression mode should I use?', a: 'Smart AI picks automatically. Use Email Ready for attachments under 5MB, Web for fast loading, or Lossless for text-only PDFs.' },
      { q: 'Will quality be affected?', a: 'High Quality and Print modes preserve readability. Maximum mode targets smallest size. Quality score is shown in the report.' },
      { q: 'Can I compress multiple PDFs at once?', a: 'Yes — batch upload, ZIP import, queue manager, and ZIP download for batch results.' },
      { q: 'Are password-protected PDFs supported?', a: 'Yes. Enter the owner password on upload and compression runs locally in your browser.' },
      { q: 'Is it safe for confidential documents?', a: '100% browser processing — files never leave your device. Auto-private, no server storage.' },
      { q: 'Can I compress to a specific file size?', a: 'Yes — enable Target file size and set KB (e.g. 200KB for Aadhaar UIDAI upload). AI binary-searches quality until the target is met.' },
    ];
  }
  if (slug === 'background-remover') {
    return [
      { q: 'Is the background remover free?', a: 'Yes — unlimited use, no signup, no watermarks on exports.' },
      { q: 'How accurate is the AI cutout?', a: 'Powered by imgly AI with smart hair refinement, edge decontamination and feather controls. Works on people, products, animals and logos.' },
      { q: 'Can I replace the background?', a: 'Yes — choose from 14 presets (studio, nature, gradient, transparent) or export transparent PNG for use anywhere.' },
      { q: 'Does it work on phone photos?', a: 'Yes — camera capture, paste from clipboard, and full mobile-responsive editor with touch brush.' },
      { q: 'Are my photos uploaded?', a: 'Never. AI runs 100% in your browser. First use downloads the model (~40MB), then it is cached.' },
      { q: 'Can I process multiple images?', a: 'Yes — batch upload, ZIP import, per-image editing, and ZIP download.' },
    ];
  }
  if (slug === 'merge-pdf') {
    return [
      { q: 'Is Merge PDF free?', a: 'Yes — unlimited merges, all 10 merge modes, AI organize included free.' },
      { q: 'How many PDFs can I merge?', a: 'Unlimited files in one session. Drag to reorder pages, exclude pages, and use AI to detect blanks and duplicates.' },
      { q: 'What are the merge modes?', a: 'Normal, Fast, Lossless, Compressed, PDF/A, Print, Book, PAN Card, Passport, and Certificate — each tuned for different outputs.' },
      { q: 'Are files uploaded to a server?', a: 'No — 100% browser processing. Your PDFs never leave your device.' },
    ];
  }
  if (slug === 'ai-chat') {
    return [
      { q: 'Is AI Chat free?', a: 'Yes — 10 free server messages/day. For unlimited free chat, add your own Gemini API key from aistudio.google.com (free, no credit card). Server uses Gemini 2.0 Flash or Llama 3.3 70B as fallback.' },
      { q: 'Is AI really free?', a: 'Yes — 100% free in your browser with no API key. ToolNest uses free Gemini Flash via browser AI. Optional: paste your own free Gemini key in AI Settings for unlimited speed.' },
      { q: 'Why did I see an error before?', a: 'Older versions used a blocked fallback. Now ToolNest auto-switches to free browser AI — no setup needed.' },
      { q: 'What AI model powers it?', a: 'Google Gemini (flash/pro). You can switch models in AI Settings. Streaming responses with markdown formatting.' },
      { q: 'What are the chat personas?', a: 'General, Code, Creative, Analyst, Teacher, and PDF Expert — each with tuned system prompts and suggested prompts.' },
      { q: 'Is chat history saved?', a: 'Yes — up to 50 chats saved locally in your browser. Export any chat as Markdown or JSON.' },
      { q: 'Can I attach documents?', a: 'Yes — attach PDF, TXT, MD, CSV, or HTML files for context-aware answers.' },
      { q: 'Are my conversations private?', a: 'Chat history stays in your browser localStorage. Server AI processes messages but does not store them permanently.' },
    ];
  }
  if (slug === 'ai-pdf-assistant') {
    return [
      { q: 'How does AI PDF Assistant work?', a: 'Upload a PDF, then ask questions. AI reads the document text and answers from its content only.' },
      { q: 'Does it work on scanned PDFs?', a: 'Best on text-based PDFs. For scanned documents, use PDF OCR first, then chat with the searchable PDF.' },
      { q: 'Is it free?', a: 'Yes — 100% free, no API key required. Same free AI as the header AI Assistant.' },
    ];
  }
  return [
    { q: `Is ${toolName} free to use?`, a: `Yes - ${toolName} on ToolNest is completely free with no hidden limits, watermarks or sign-up requirements.` },
    { q: 'Are my files safe?', a: 'Absolutely. Processing happens directly in your browser wherever technically possible, so your files never leave your device.' },
    { q: 'Do I need to install anything?', a: 'No. Everything runs in your web browser - desktop, tablet or mobile. No downloads, no extensions.' },
    { q: 'Is there a file size limit?', a: 'Since processing is local, the limit is your device memory. Files up to a few hundred MB typically work smoothly.' },
    { q: 'Can I use this tool multiple times?', a: 'Yes, use it as many times as you like - just click "Process Another File" after each run.' },
  ];
}

function getTrustExtra(slug: string): string {
  if (slug === 'pdf-converter') return 'Files auto-deleted after 24h';
  if (slug === 'image-compressor') return '100% Private · No Upload';
  if (slug === 'pan-card-photo-resizer') return 'AI Face Crop · 12-Point Compliance';
  if (slug === 'pdf-to-word') return 'AI Indic Repair · Confidence Score';
  if (slug === 'compress-pdf') return 'AI Smart Modes · Batch Queue';
  if (slug === 'background-remover') return 'AI Hair Refine · 100% Private';
  if (slug === 'merge-pdf') return 'AI Organize · 10 Merge Modes';
  if (slug === 'ai-chat') return '6 Personas · Chat History · Streaming';
  if (slug === 'ai-pdf-assistant') return 'PDF Q&A · Summarize · Extract';
  return 'Runs in your browser';
}

export default async function ToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const cat = getCategory(tool.category);
  const related = getToolsByCategory(tool.category).filter((t) => t.slug !== tool.slug).slice(0, 5);
  const faq = buildFaq(tool.name, slug);
  const trustExtra = getTrustExtra(slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: tool.name,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        description: tool.description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://toolnestfm.com' },
          { '@type': 'ListItem', position: 2, name: cat?.name, item: `https://toolnestfm.com/tools/${tool.category}` },
          { '@type': 'ListItem', position: 3, name: tool.name },
        ],
      },
    ],
  };

  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href={`/tools/${tool.category}`}>{cat?.name}</Link> / <span>{tool.name}</span>
      </nav>

      <div className="tool-header">
        <span className="tool-header-icon" style={{ background: `var(--${cat?.accent || 'brand-primary'})` }}>
          <Icon name={tool.icon} size={28} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>
      <div className="trust-row">
        <ToolUsageStat slug={tool.slug} />
        <span>&middot;</span>
        <span>&#128274; 100% Secure &amp; Private</span>
        <span>&middot;</span>
        <span>&#9889; {trustExtra}</span>
      </div>

      <div className="tool-page-layout">
        <div className="tool-page-main">
          <div className="workspace glass">
            <ToolRunner tool={tool} />
          </div>
          {/* Ad 2 — below primary action (728×90 desktop) */}
          <ToolMidAd />
        </div>
        {/* Desktop right sidebar ad (300×250) */}
        <ToolSidebarAd />
      </div>

      <section className="hiw">
        {[
          { n: 1, t: tool.accept ? 'Upload' : 'Enter', d: tool.accept ? 'Drag & drop your file or click to browse - nothing is uploaded to any server.' : 'Fill in your input - everything stays on your device.' },
          { n: 2, t: 'Process', d: slug === 'pdf-converter' ? 'Pick your target format and options. Click Convert - processing is instant and local.' : 'Pick your options and click the action button. Processing is instant and local.' },
          { n: 3, t: 'Download', d: slug === 'pdf-converter' ? 'Download your converted file instantly. Convert to another format without re-uploading.' : 'Grab your result immediately. Run it again as many times as you like - free forever.' },
        ].map((s) => (
          <div key={s.n} className="hiw-step glass">
            <span className="hiw-num">{s.n}</span>
            <b>{s.t}</b>
            <p>{s.d}</p>
          </div>
        ))}
      </section>

      <section className="faq">
        <h2>Frequently Asked Questions</h2>
        {faq.map((f) => (
          <details key={f.q} className="faq-item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {related.length > 0 && (
        <section className="related">
          <div className="related-head">
            <h2>Related {cat?.name}</h2>
            <ToolSmartlink />
          </div>
          <div className="tool-grid">
            {related.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </section>
      )}

      {/* Ad 3 — before footer (desktop 300×250, mobile 320×50) */}
      <ToolPreFooterAd />

      <FeatureStrip />
    </div>
  );
}
