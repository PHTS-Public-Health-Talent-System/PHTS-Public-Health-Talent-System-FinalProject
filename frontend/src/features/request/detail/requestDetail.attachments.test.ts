import { describe, expect, it } from 'vitest';
import { buildAttachmentUrl, isPreviewableFile } from './requestDetail.attachments';

describe('request detail attachments helpers', () => {
  it('builds attachment url with base api', () => {
    const url = buildAttachmentUrl('uploads/documents/file.pdf', 'http://localhost:3001/api');
    expect(url).toBe('http://localhost:3001/uploads/documents/file.pdf');
  });

  it('strips api suffix from base url', () => {
    const url = buildAttachmentUrl('uploads/documents/file.pdf', 'http://localhost:3001/api/');
    expect(url).toBe('http://localhost:3001/uploads/documents/file.pdf');
  });

  it('normalizes absolute path to uploads', () => {
    const url = buildAttachmentUrl('/var/app/uploads/documents/file.pdf', 'http://localhost:3001/api');
    expect(url).toBe('http://localhost:3001/uploads/documents/file.pdf');
  });

  it('detects previewable files', () => {
    expect(isPreviewableFile('doc.pdf')).toBe(true);
    expect(isPreviewableFile('image.JPG')).toBe(true);
    expect(isPreviewableFile('notes.txt')).toBe(false);
  });
});
