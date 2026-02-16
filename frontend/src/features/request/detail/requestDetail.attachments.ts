const DEFAULT_API_BASE = 'http://localhost:3001/api';

export const buildAttachmentUrl = (filePath: string, apiBase?: string): string => {
  const base = (apiBase ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE).replace(/\/api\/?$/, '');
  const normalized = filePath.includes('uploads/')
    ? filePath.slice(filePath.indexOf('uploads/'))
    : filePath.replace(/^\/+/, '');
  return `${base}/${normalized}`;
};

export const isPreviewableFile = (fileName?: string | null): boolean => {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg'].some((ext) => lower.endsWith(ext));
  };

export const decodeAttachmentFileName = (fileName?: string | null): string => {
  if (!fileName) return '';

  let normalized = fileName;
  try {
    normalized = decodeURIComponent(fileName);
  } catch {
    // keep original when not URI-encoded
  }

  // Fix common mojibake where UTF-8 bytes were decoded as latin-1 (e.g. à¸£à¸°à¸à¸)
  if (/[ÃÂà]/.test(normalized) && !/[\u0E00-\u0E7F]/.test(normalized)) {
    const bytes = Uint8Array.from(normalized, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8').decode(bytes);
    if (decoded && decoded !== normalized && !decoded.includes('\uFFFD')) {
      normalized = decoded;
    }
  }

  return normalized;
};
