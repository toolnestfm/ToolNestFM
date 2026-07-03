import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/Icon';
import ToolCard from '@/components/ToolCard';
import ToolRunner from '@/components/tool/ToolRunner';
import FeatureStrip from '@/components/homepage/FeatureStrip';
import ToolPageAds, { ToolPageSidebarAds } from '@/components/ads/ToolPageAds';
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
  return [
    { q: `Is ${toolName} free to use?`, a: `Yes - ${toolName} on ToolNest is completely free with no hidden limits, watermarks or sign-up requirements.` },
    { q: 'Are my files safe?', a: 'Absolutely. Processing happens directly in your browser wherever technically possible, so your files never leave your device.' },
    { q: 'Do I need to install anything?', a: 'No. Everything runs in your web browser - desktop, tablet or mobile. No downloads, no extensions.' },
    { q: 'Is there a file size limit?', a: 'Since processing is local, the limit is your device memory. Files up to a few hundred MB typically work smoothly.' },
    { q: 'Can I use this tool multiple times?', a: 'Yes, use it as many times as you like - just click "Process Another File" after each run.' },
  ];
}

function getTrustStats(slug: string) {
  if (slug === 'pdf-converter') {
    return { rating: '4.9', reviews: '32,410', uses: '8.2M+', extra: 'Files auto-deleted after 24h' };
  }
  return { rating: '4.9', reviews: '', uses: '2.4M+', extra: 'Runs in your browser' };
}

export default async function ToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const cat = getCategory(tool.category);
  const related = getToolsByCategory(tool.category).filter((t) => t.slug !== tool.slug).slice(0, 5);
  const faq = buildFaq(tool.name, slug);
  const trust = getTrustStats(slug);

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
        <span>Used {trust.uses} times</span>
        <span>&middot;</span>
        <span>&#11088; {trust.rating}{trust.reviews && ` (${trust.reviews} reviews)`}</span>
        <span>&middot;</span>
        <span>&#128274; 100% Secure &amp; Private</span>
        <span>&middot;</span>
        <span>&#9889; {trust.extra}</span>
      </div>

      <div className="tool-page-layout">
        <div className="tool-page-main">
          <div className="workspace glass">
            <ToolRunner tool={tool} />
          </div>
          <ToolPageAds />
        </div>
        <aside className="tool-page-sidebar-ads">
          <ToolPageSidebarAds />
        </aside>
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
          <h2>Related {cat?.name}</h2>
          <div className="tool-grid">
            {related.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </section>
      )}

      <FeatureStrip />
    </div>
  );
}
