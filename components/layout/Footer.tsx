import Link from 'next/link';
import Icon from '../Icon';

const explore = [
  { label: 'All Tools', href: '/tools' },
  { label: 'AI Tools', href: '/tools/ai', badge: 'NEW' },
  { label: 'PDF Tools', href: '/tools/pdf' },
  { label: 'Image Tools', href: '/tools/image' },
  { label: 'Video Tools', href: '/tools/video' },
  { label: 'Audio Tools', href: '/tools/audio' },
  { label: 'Developer Tools', href: '/tools/developer' },
  { label: 'Text Tools', href: '/tools/text' },
  { label: 'Business Tools', href: '/tools/business' },
  { label: 'Converter Tools', href: '/tools/file-converter' },
];

const features = [
  { label: 'AI Assistant', href: '/tools/ai/ai-chat' },
  { label: 'Bulk Processing', href: '/dashboard/billing' },
  { label: 'Cloud Storage', href: '/dashboard' },
  { label: 'File Converter', href: '/tools/file-converter' },
  { label: 'Batch Tools', href: '/dashboard/billing' },
  { label: 'Recently Added', href: '/tools/ai' },
  { label: 'Popular Tools', href: '/tools' },
  { label: 'Trending Tools', href: '/tools' },
  { label: 'Tool Collections', href: '/tools' },
  { label: 'Keyboard Shortcuts', href: '/help' },
];

const resources = [
  { label: 'Blog', href: '/blog' },
  { label: 'Help Center', href: '/help' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Video Tutorials', href: '/help' },
  { label: 'API Documentation', href: '/developers' },
  { label: 'Developer API', href: '/developers' },
  { label: 'Status Page', href: '/status' },
  { label: 'Community', href: '/contact' },
  { label: 'Changelog', href: '/blog' },
];

const company = [
  { label: 'About Us', href: '/about' },
  { label: 'Careers', href: '/contact', badge: "We're Hiring" },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Press Kit', href: '/about' },
  { label: 'Partners', href: '/contact' },
  { label: 'Affiliate Program', href: '/contact' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo">
              <span className="logo-mark"><Icon name="hexagon" size={20} strokeWidth={2.2} /></span>
              <span>
                <span className="logo-name">ToolNest</span>
                <div className="logo-tagline">One Platform. Infinite Tools.</div>
              </span>
            </div>
            <p className="footer-desc">All the tools you need to work faster, smarter and better — all in one beautifully simple platform.</p>
            <div className="social-row">
              {['facebook', 'twitter', 'linkedin', 'youtube', 'instagram', 'github'].map((s) => (
                <a key={s} href="#" className="social-icon" aria-label={s}><Icon name={s} size={15} /></a>
              ))}
            </div>
          </div>

          <div>
            <h4>Explore</h4>
            <ul>
              {explore.map((e) => (
                <li key={e.label}>
                  <Link href={e.href}>{e.label}{e.badge && <span className="pill pill-nav-new">{e.badge}</span>}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Top Features</h4>
            <ul>{features.map((f) => (<li key={f.label}><Link href={f.href}>{f.label}</Link></li>))}</ul>
          </div>

          <div>
            <h4>Resources</h4>
            <ul>{resources.map((r) => (<li key={r.label}><Link href={r.href}>{r.label}</Link></li>))}</ul>
          </div>

          <div>
            <h4>Company</h4>
            <ul>
              {company.map((c) => (
                <li key={c.label}>
                  <Link href={c.href}>{c.label}{c.badge && <span className="pill pill-hiring">{c.badge}</span>}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Get ToolNest App</h4>
            <div className="store-grid">
              <a href="#" className="store-btn"><Icon name="download" size={16} /><span>Download on the<b>App Store</b></span></a>
              <a href="#" className="store-btn"><Icon name="play" size={16} /><span>Get it on<b>Google Play</b></span></a>
              <a href="#" className="store-btn"><Icon name="grid" size={16} /><span>Download for<b>Windows</b></span></a>
              <a href="#" className="store-btn"><Icon name="hexagon" size={16} /><span>Download for<b>macOS</b></span></a>
            </div>
            <div className="trust-panel">
              <h5><Icon name="shield-check" size={15} /> Trusted &amp; Secure</h5>
              <ul>
                <li><Icon name="check" size={12} /> 256-bit SSL Encrypted</li>
                <li><Icon name="check" size={12} /> <Link href="/gdpr">GDPR Compliant</Link></li>
                <li><Icon name="check" size={12} /> <Link href="/security">Your Data is 100% Safe</Link></li>
                <li><Icon name="check" size={12} /> No Ads, Ever</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2025 ToolNest. All rights reserved.</span>
          <span>Made with ❤️ by ToolNest Team</span>
          <div className="footer-bottom-right">
            <Link href="/sitemap">Sitemap</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-of-service">Terms</Link>
            <Link href="/status">Status<span className="status-dot" /></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
