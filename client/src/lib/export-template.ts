// Canonical export template — single source of truth for all PDF exports.
// Visual design: Group Rams export (the established canonical standard).
// All exports must route header, footer, CSS, and document structure through this module.

export const GROUP_ROWS_PER_PAGE = 20;

export type ExportFarmSettings = {
  farmName?: string | null;
  studName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  membershipNumber?: string | null;
  logoUrl?: string | null;
};

// ---------------------------------------------------------------------------
// Shared CSS fragments (header, footer, table, status badges, typography)
// ---------------------------------------------------------------------------

const CANONICAL_SHARED_CSS = `
  .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
  .header-left { width: 60px; flex-shrink: 0; }
  .logo { width: 60px; height: 60px; object-fit: contain; }
  .header-center { flex: 1; text-align: center; }
  .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
  .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
  .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
  .section-label { font-size: 12pt; font-weight: 800; color: #1a1a1a; margin-bottom: 4mm; text-transform: uppercase; background: #FFC300; padding: 6px 12px; display: inline-block; border-radius: 3px; }
  .export-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .export-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
  .export-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
  .export-table tbody tr:nth-child(even) { background: #fafafa; }
  .row-num { width: 25px; text-align: center; color: #666; font-size: 7pt; }
  .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
  .status-active { background: #22c55e20; color: #16a34a; }
  .status-sold { background: #f59e0b20; color: #d97706; }
  .status-culled { background: #ef444420; color: #dc2626; }
  .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
  .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
  .footer-info { flex: 1; }
  .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
  .footer-info p { font-size: 7pt; margin-top: 2px; color: #d8d8d8; }
  .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
  .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    thead { display: table-header-group; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

// ---------------------------------------------------------------------------
// CSS factories
// ---------------------------------------------------------------------------

/** CSS for all landscape group exports (canonical standard) */
export function getCanonicalGroupCSS(): string {
  return `
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; height: 190mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; overflow: hidden; }
    .page:last-child { page-break-after: avoid; }
    ${CANONICAL_SHARED_CSS}
  `;
}

/** CSS for portrait individual animal exports */
export function getCanonicalPortraitCSS(): string {
  return `
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; height: 277mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; overflow: hidden; }
    .page:last-child { page-break-after: avoid; }
    ${CANONICAL_SHARED_CSS}
  `;
}

// ---------------------------------------------------------------------------
// HTML builders
// ---------------------------------------------------------------------------

/** Canonical page header — logo left, stud/farm name centred, page+date right */
export function renderExportHeader(
  fb: ExportFarmSettings | null | undefined,
  pageNum: number,
  totalPages: number,
  exportDate: string,
  title: string,
  subtitle: string,
): string {
  return `
  <div class="header">
    <div class="header-left">
      ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" alt="logo" />` : ''}
    </div>
    <div class="header-center">
      <h1>${fb?.studName || fb?.farmName || title}</h1>
      <p class="subtitle">${subtitle}</p>
    </div>
    <div class="header-right">
      <p>Page ${pageNum} of ${totalPages}</p>
      <p>${exportDate}</p>
    </div>
  </div>`;
}

/** Canonical dark-ribbon footer — FFC300 farm name on left, white BREEDLOG on right */
export function renderExportFooter(fb: ExportFarmSettings | null | undefined): string {
  const ownerInfo = [fb?.ownerName, fb?.ownerPhone].filter(Boolean).join(' | ');
  return `
  <div class="footer">
    <div class="footer-info">
      <p class="footer-title">${fb?.studName || fb?.farmName || ''}</p>
      ${ownerInfo ? `<p>${ownerInfo}</p>` : ''}
    </div>
    <div class="footer-branding">
      <p class="breedlog-text">BREEDLOG</p>
      <p class="tagline">Professional Livestock Management</p>
    </div>
  </div>`;
}

/** Wrap pages HTML in a complete <!DOCTYPE html> document */
export function wrapExportDocument(title: string, css: string, pagesHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/** Open the result in the browser print dialog */
export function openExportPrintDialog(htmlContent: string): void {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(htmlContent);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
}
