// PDF Quality settings and image compression utilities

export type PDFQuality = 'low' | 'medium' | 'high';

export interface PDFQualitySettings {
  imageQuality: number;     // JPEG quality (0-1)
  maxImageWidth: number;    // Max width in pixels
  maxImageHeight: number;   // Max height in pixels
  thumbnailWidth: number;   // Width for thumbnail images
}

export const PDF_QUALITY_SETTINGS: Record<PDFQuality, PDFQualitySettings> = {
  low: {
    imageQuality: 0.5,
    maxImageWidth: 400,
    maxImageHeight: 400,
    thumbnailWidth: 80,
  },
  medium: {
    imageQuality: 0.7,
    maxImageWidth: 800,
    maxImageHeight: 800,
    thumbnailWidth: 120,
  },
  high: {
    imageQuality: 0.9,
    maxImageWidth: 1200,
    maxImageHeight: 1200,
    thumbnailWidth: 200,
  },
};

/**
 * Compress an image URL to a base64 JPEG with the specified quality settings
 */
export async function compressImage(
  imageUrl: string,
  settings: PDFQualitySettings,
  isThumbnail: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Skip if no image URL
    if (!imageUrl) {
      resolve('');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(imageUrl); // Fallback to original
          return;
        }
        
        // Calculate target dimensions
        const maxWidth = isThumbnail ? settings.thumbnailWidth : settings.maxImageWidth;
        const maxHeight = isThumbnail ? settings.thumbnailWidth : settings.maxImageHeight;
        
        let { width, height } = img;
        
        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw with white background (for JPEG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with quality setting
        const dataUrl = canvas.toDataURL('image/jpeg', settings.imageQuality);
        resolve(dataUrl);
      } catch (error) {
        console.warn('[PDF] Image compression failed, using original:', error);
        resolve(imageUrl);
      }
    };
    
    img.onerror = () => {
      console.warn('[PDF] Failed to load image for compression:', imageUrl.substring(0, 50));
      resolve(imageUrl); // Fallback to original
    };
    
    // Handle data URLs and regular URLs
    img.src = imageUrl;
  });
}

/**
 * Compress multiple images in parallel with progress callback
 */
export async function compressImages(
  images: (string | undefined | null)[],
  quality: PDFQuality,
  isThumbnail: boolean = false,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const settings = PDF_QUALITY_SETTINGS[quality];
  const total = images.length;
  let completed = 0;
  
  const results = await Promise.all(
    images.map(async (img) => {
      const result = img ? await compressImage(img, settings, isThumbnail) : '';
      completed++;
      onProgress?.(completed, total);
      return result;
    })
  );
  
  return results;
}

/**
 * Generate common PDF styles for consistent layout
 */
export function getPDFStyles(): string {
  return `
    @page {
      size: A4;
      margin: 15mm 10mm 25mm 10mm;
    }
    @media print {
      body { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
      }
      .page-break { 
        page-break-before: always; 
        padding-top: 15mm;
      }
      .no-page-break { 
        page-break-inside: avoid; 
      }
    }
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      font-size: 10pt;
      color: #333;
      line-height: 1.4;
      background: white;
    }
    .page {
      position: relative;
      min-height: 100vh;
      padding-bottom: 60px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 3px solid #f59e0b;
      margin-bottom: 15px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-center {
      text-align: center;
      flex: 1;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #555;
    }
    .logo {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0;
      color: #1a1a1a;
    }
    h2 {
      font-size: 12pt;
      font-weight: bold;
      margin: 15px 0 10px 0;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .subtitle {
      font-size: 10pt;
      color: #666;
      margin-top: 2px;
    }
    .farm-name {
      font-size: 11pt;
      font-weight: 600;
      color: #f59e0b;
      text-shadow: 0 0 1px rgba(0,0,0,0.2);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9pt;
    }
    th {
      background: #f8f8f8;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #ddd;
      color: #333;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #eee;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .row-num {
      width: 30px;
      text-align: center;
      color: #888;
      font-size: 8pt;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;
      padding: 10px 15mm;
      border-top: 2px solid #f59e0b;
      background: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-logo {
      width: 35px;
      height: 35px;
      object-fit: contain;
    }
    .footer-farm-info {
      color: #444;
      line-height: 1.3;
    }
    .footer-farm-name {
      font-weight: 600;
      color: #f59e0b;
      text-shadow: 0 0 1px rgba(0,0,0,0.3);
    }
    .footer-right {
      text-align: right;
    }
    .footer-brand {
      font-size: 14pt;
      font-weight: bold;
      color: #333;
    }
    .footer-tagline {
      font-size: 8pt;
      color: #f59e0b;
      font-style: italic;
      text-shadow: 0 0 1px rgba(0,0,0,0.2);
    }
    .animal-photo {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
    }
    .ram-photo {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
    }
    .status-active { color: #16a34a; font-weight: 500; }
    .status-inactive { color: #dc2626; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: 500;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-culled { background: #fee2e2; color: #991b1b; }
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #1a1a1a;
      margin: 20px 0 10px 0;
      padding-bottom: 5px;
      border-bottom: 2px solid #f59e0b;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    .stat-box {
      padding: 10px;
      background: #f8f8f8;
      border-radius: 4px;
      text-align: center;
    }
    .stat-value {
      font-size: 18pt;
      font-weight: bold;
      color: #f59e0b;
    }
    .stat-label {
      font-size: 8pt;
      color: #666;
      margin-top: 3px;
    }
    .info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-label {
      width: 40%;
      color: #666;
      font-size: 9pt;
    }
    .info-value {
      width: 60%;
      font-weight: 500;
    }
  `;
}

/**
 * Generate consistent footer HTML
 */
export function getPDFFooter(
  farmSettings: {
    farmName?: string | null;
    studName?: string | null;
    ownerName?: string | null;
    ownerEmail?: string | null;
    ownerPhone?: string | null;
    membershipNumber?: string | null;
    logoUrl?: string | null;
  } | null | undefined,
  compressedLogoUrl?: string
): string {
  const displayName = farmSettings?.studName || farmSettings?.farmName || '';
  const ownerInfo = farmSettings?.ownerName || '';
  const contactInfo = [farmSettings?.ownerPhone, farmSettings?.ownerEmail]
    .filter(Boolean)
    .join(' | ');
  const memberInfo = farmSettings?.membershipNumber 
    ? `Membership: ${farmSettings.membershipNumber}` 
    : '';
  
  const logoSrc = compressedLogoUrl || farmSettings?.logoUrl || '';
  
  return `
    <div class="footer">
      <div class="footer-left">
        ${logoSrc ? `<img src="${logoSrc}" class="footer-logo" />` : ''}
        <div class="footer-farm-info">
          <div class="footer-farm-name">${displayName}</div>
          ${ownerInfo ? `<div>${ownerInfo}${contactInfo ? ` | ${contactInfo}` : ''}</div>` : ''}
          ${memberInfo ? `<div>${memberInfo}</div>` : ''}
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-brand">BREEDLOG</div>
        <div class="footer-tagline">Professional Livestock Management</div>
      </div>
    </div>
  `;
}

/**
 * Open PDF in print dialog
 */
export function openPDFPrintDialog(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

/**
 * Get quality label for display
 */
export function getQualityLabel(quality: PDFQuality): string {
  switch (quality) {
    case 'low':
      return 'Low (Fast, Small File)';
    case 'medium':
      return 'Medium (Balanced)';
    case 'high':
      return 'High (Best Quality)';
  }
}
