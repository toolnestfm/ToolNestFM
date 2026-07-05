/** Government / India portal presets for PDF → Word conversion tuning. */

export type GovPresetId =
  | 'none'
  | 'form-16'
  | 'income-tax'
  | 'pan-ack'
  | 'aadhaar-letter'
  | 'gst-invoice'
  | 'mca-roc';

export interface GovPreset {
  id: GovPresetId;
  label: string;
  labelHi: string;
  keywords: RegExp[];
  /** Prefer table reconstruction */
  tableHeavy: boolean;
  /** Boost Indic repair */
  indicRepair: boolean;
  /** OCR language hint */
  ocrLangs: string;
}

export const GOV_PRESETS: GovPreset[] = [
  {
    id: 'form-16',
    label: 'Form 16 (Salary Certificate)',
    labelHi: 'फॉर्म 16',
    keywords: [/form\s*16/i, /certificate\s+of\s+tax/i, /tds/i, /salary\s+certificate/i],
    tableHeavy: true,
    indicRepair: true,
    ocrLangs: 'eng+hin',
  },
  {
    id: 'income-tax',
    label: 'Income Tax Return',
    labelHi: 'आयकर रिटर्न',
    keywords: [/income\s*tax/i, /itr[\s-]?\d/i, /assessment\s+year/i, /incometax/i],
    tableHeavy: true,
    indicRepair: true,
    ocrLangs: 'eng+hin',
  },
  {
    id: 'pan-ack',
    label: 'PAN Acknowledgement',
    labelHi: 'PAN पावती',
    keywords: [/permanent\s+account\s+number/i, /\bpan\b/i, /acknowledgement/i, /nsdl/i, /utiitsl/i, /protean/i],
    tableHeavy: false,
    indicRepair: true,
    ocrLangs: 'eng+hin',
  },
  {
    id: 'aadhaar-letter',
    label: 'Aadhaar Letter',
    labelHi: 'आधार पत्र',
    keywords: [/aadhaar/i, /aadhar/i, /uidai/i, /unique\s+identification/i],
    tableHeavy: false,
    indicRepair: true,
    ocrLangs: 'eng+hin',
  },
  {
    id: 'gst-invoice',
    label: 'GST Invoice / Return',
    labelHi: 'GST चालान',
    keywords: [/gstin/i, /\bgst\b/i, /tax\s+invoice/i, /cgst/i, /sgst/i],
    tableHeavy: true,
    indicRepair: false,
    ocrLangs: 'eng',
  },
  {
    id: 'mca-roc',
    label: 'MCA / ROC Filing',
    labelHi: 'MCA फाइलिंग',
    keywords: [/ministry\s+of\s+corporate/i, /\bmca\b/i, /\broc\b/i, /companies\s+act/i],
    tableHeavy: true,
    indicRepair: false,
    ocrLangs: 'eng',
  },
];

export function detectGovPreset(sampleText: string): GovPreset | null {
  const t = sampleText.slice(0, 8000);
  for (const p of GOV_PRESETS) {
    if (p.keywords.some((re) => re.test(t))) return p;
  }
  return null;
}

export function getGovPreset(id: GovPresetId): GovPreset | undefined {
  if (id === 'none') return undefined;
  return GOV_PRESETS.find((p) => p.id === id);
}
