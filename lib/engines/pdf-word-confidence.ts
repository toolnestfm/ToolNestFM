/** Conversion confidence scoring for PDF → Word results. */

export interface ConfidenceBreakdown {
  textCoverage: number;
  tableIntegrity: number;
  imagePlacement: number;
  fontAccuracy: number;
  ocrConfidence: number;
  indicRepair: number;
  overall: number;
  issues: string[];
}

export interface ConfidenceInput {
  pageCount: number;
  pagesWithText: number;
  tablesDetected: number;
  tablesRebuilt: number;
  imagesExpected: number;
  imagesEmbedded: number;
  usedOcr: boolean;
  ocrAvgConfidence: number;
  indicRepairPages: number;
  brokenBengaliBefore: number;
  docType: 'digital' | 'scanned' | 'mixed';
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const issues: string[] = [];

  const textCoverage =
    input.pageCount > 0 ? (input.pagesWithText / input.pageCount) * 100 : 0;
  if (textCoverage < 60) issues.push('Low text coverage — try OCR Deep mode');

  let tableIntegrity = 100;
  if (input.tablesDetected > 0) {
    tableIntegrity = (input.tablesRebuilt / input.tablesDetected) * 100;
    if (tableIntegrity < 80) issues.push('Some tables may need manual cleanup');
  }

  let imagePlacement = 100;
  if (input.imagesExpected > 0) {
    imagePlacement = (input.imagesEmbedded / input.imagesExpected) * 100;
    if (imagePlacement < 90) issues.push('Not all images were embedded');
  }

  const fontAccuracy = input.docType === 'scanned' ? 70 : 88;

  let ocrConfidence = 100;
  if (input.usedOcr) {
    ocrConfidence = input.ocrAvgConfidence || 75;
    if (ocrConfidence < 80) issues.push('OCR confidence is moderate — review scanned pages');
  }

  let indicRepair = 100;
  if (input.brokenBengaliBefore > 0) {
    indicRepair = input.indicRepairPages >= input.brokenBengaliBefore ? 95 : 70;
    if (indicRepair < 90) issues.push('Some Indic script pages may need AI repair review');
  }

  const overall = clamp(
    textCoverage * 0.2 +
      tableIntegrity * 0.2 +
      imagePlacement * 0.15 +
      fontAccuracy * 0.15 +
      ocrConfidence * 0.15 +
      indicRepair * 0.15,
  );

  if (overall >= 85 && issues.length === 0) {
    issues.push('High fidelity — ready to edit in Word');
  }

  return {
    textCoverage: clamp(textCoverage),
    tableIntegrity: clamp(tableIntegrity),
    imagePlacement: clamp(imagePlacement),
    fontAccuracy: clamp(fontAccuracy),
    ocrConfidence: clamp(ocrConfidence),
    indicRepair: clamp(indicRepair),
    overall,
    issues,
  };
}
