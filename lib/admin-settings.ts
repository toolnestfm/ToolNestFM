export type FeatureFlags = {
  aiAssistant: boolean;
  aiChat: boolean;
  aiImageGen: boolean;
  newsletter: boolean;
  blog: boolean;
  oauthGoogle: boolean;
  oauthGithub: boolean;
  maintenanceMode: boolean;
};

export type PricingConfig = {
  proMonthlyUsd: number;
  proYearlyUsd: number;
  freeJobsPerDay: number;
  freeStorageMb: number;
  proStorageGb: number;
  proFileSizeMb: number;
  freeFileSizeMb: number;
};

export type AdsConfig = {
  ad_header: boolean;
  ad_sidebar: boolean;
  ad_home_inline: boolean;
  ad_footer: boolean;
  ad_tool_bottom: boolean;
  ad_blog: boolean;
};

export type SiteSettings = {
  siteName: string;
  supportEmail: string;
  maxUploadMb: number;
  allowSignups: boolean;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export type AdminSettings = {
  feature_flags: FeatureFlags;
  pricing: PricingConfig;
  ads: AdsConfig;
  site: SiteSettings;
  disabled_tools: string[];
  email_templates: EmailTemplate[];
  api_keys_meta: { id: string; name: string; prefix: string; created_at: string; last_used?: string }[];
};

export const defaultAdminSettings: AdminSettings = {
  feature_flags: {
    aiAssistant: true,
    aiChat: true,
    aiImageGen: true,
    newsletter: true,
    blog: true,
    oauthGoogle: true,
    oauthGithub: true,
    maintenanceMode: false,
  },
  pricing: {
    proMonthlyUsd: 9.99,
    proYearlyUsd: 79.99,
    freeJobsPerDay: 5,
    freeStorageMb: 500,
    proStorageGb: 100,
    proFileSizeMb: 2048,
    freeFileSizeMb: 25,
  },
  ads: {
    ad_header: false,
    ad_sidebar: true,
    ad_home_inline: true,
    ad_footer: true,
    ad_tool_bottom: true,
    ad_blog: false,
  },
  site: {
    siteName: 'ToolNest',
    supportEmail: 'support@toolnestfm.com',
    maxUploadMb: 25,
    allowSignups: true,
  },
  disabled_tools: [],
  email_templates: [
    { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to ToolNest!', body: 'Hi {{name}}, welcome to ToolNest — 130+ tools in one place.' },
    { id: 'reset', name: 'Password Reset', subject: 'Reset your ToolNest password', body: 'Click the link to reset your password: {{link}}' },
    { id: 'pro_receipt', name: 'Pro Receipt', subject: 'Your ToolNest Pro receipt', body: 'Thanks for upgrading to Pro, {{name}}!' },
  ],
  api_keys_meta: [],
};

export function mergeSettings(partial: Partial<AdminSettings>): AdminSettings {
  return {
    ...defaultAdminSettings,
    ...partial,
    feature_flags: { ...defaultAdminSettings.feature_flags, ...partial.feature_flags },
    pricing: { ...defaultAdminSettings.pricing, ...partial.pricing },
    ads: { ...defaultAdminSettings.ads, ...partial.ads },
    site: { ...defaultAdminSettings.site, ...partial.site },
    disabled_tools: partial.disabled_tools ?? defaultAdminSettings.disabled_tools,
    email_templates: partial.email_templates ?? defaultAdminSettings.email_templates,
    api_keys_meta: partial.api_keys_meta ?? defaultAdminSettings.api_keys_meta,
  };
}
