export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  description?: string;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'grid', description: 'Platform overview & KPIs' },
      { href: '/admin/analytics', label: 'Analytics', icon: 'zap', description: 'Usage charts & stats' },
      { href: '/admin/reports', label: 'Reports', icon: 'table', description: 'Export CSV reports' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/admin/users', label: 'Users', icon: 'users', description: 'Roles, bans, plans' },
      { href: '/admin/tools', label: 'Tools', icon: 'settings', description: 'Enable/disable tools' },
      { href: '/admin/categories', label: 'Categories', icon: 'folder', description: 'Category management' },
      { href: '/admin/files', label: 'Files & Jobs', icon: 'database', description: 'Files & job queue' },
      { href: '/admin/blog', label: 'Blog', icon: 'file-text', description: 'Blog posts CMS' },
      { href: '/admin/contact', label: 'Contact Messages', icon: 'mail', description: 'Contact form inbox' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: 'briefcase', description: 'Stripe subscriptions' },
      { href: '/admin/credits', label: 'Credits', icon: 'zap', description: 'Grant credits & ledger' },
      { href: '/admin/pricing', label: 'Pricing', icon: 'crown', description: 'Plan limits & prices' },
      { href: '/admin/ads', label: 'Ads', icon: 'play', description: 'Ad zone toggles' },
      { href: '/admin/api-keys', label: 'API Keys', icon: 'key', description: 'All user API keys' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/features', label: 'Feature Flags', icon: 'zap', description: 'Feature flag toggles' },
      { href: '/admin/email-templates', label: 'Email Templates', icon: 'mail', description: 'Email templates' },
      { href: '/admin/notifications', label: 'Notifications', icon: 'bell', description: 'Admin alerts' },
      { href: '/admin/team', label: 'Admin Team', icon: 'users', description: 'Add & manage admins' },
      { href: '/admin/create-admin', label: 'Create Admin', icon: 'user-square', description: 'Create new admin account' },
      { href: '/admin/audit', label: 'Audit Log', icon: 'shield', description: 'Full action history' },
      { href: '/admin/profile', label: 'My Profile', icon: 'user-square', description: 'Account & security' },
      { href: '/admin/settings', label: 'Settings', icon: 'settings', description: 'Site-wide settings' },
      { href: '/admin/system', label: 'System', icon: 'shield-check', description: 'Health & environment' },
    ],
  },
];

/** Flat list for quick-access control center cards */
export const adminQuickLinks: AdminNavItem[] = adminNavSections.flatMap((s) => s.items).filter(
  (item) => !['/admin/profile'].includes(item.href),
);

export function isAdminPathActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
