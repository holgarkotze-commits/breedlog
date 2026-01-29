/**
 * Client-side image compression utility
 * Compresses images before upload to IndexedDB or server
 * Target: 200-500KB output, 1600px max width, 75% quality
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'auto';
}

export interface CompressionResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.75,
  format: 'auto'
};

function supportsWebP(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    return dataUrl.startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function getOutputFormat(preferredFormat: 'jpeg' | 'webp' | 'auto'): { mimeType: string; extension: string } {
  if (preferredFormat === 'webp' || (preferredFormat === 'auto' && supportsWebP())) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return { mimeType: 'image/jpeg', extension: 'jpeg' };
}

function calculateBase64Size(base64: string): number {
  const paddingCount = (base64.match(/=/g) || []).length;
  const base64Length = base64.length - base64.indexOf(',') - 1;
  return Math.floor((base64Length * 3) / 4) - paddingCount;
}

export function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const originalSize = file.size;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          if (width > opts.maxWidth || height > opts.maxHeight) {
            const widthRatio = opts.maxWidth / width;
            const heightRatio = opts.maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          const { mimeType, extension } = getOutputFormat(opts.format);
          const base64 = canvas.toDataURL(mimeType, opts.quality);
          const compressedSize = calculateBase64Size(base64);
          
          resolve({
            base64,
            originalSize,
            compressedSize,
            width,
            height,
            format: extension
          });
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function compressImageWithFeedback(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (message: string) => void
): Promise<CompressionResult> {
  onProgress?.('Optimising image...');
  
  const result = await compressImage(file, options);
  
  const reductionPercent = Math.round((1 - result.compressedSize / result.originalSize) * 100);
  const compressedKB = Math.round(result.compressedSize / 1024);
  
  onProgress?.(`Image optimised: ${compressedKB}KB (${reductionPercent}% smaller)`);
  
  return result;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
