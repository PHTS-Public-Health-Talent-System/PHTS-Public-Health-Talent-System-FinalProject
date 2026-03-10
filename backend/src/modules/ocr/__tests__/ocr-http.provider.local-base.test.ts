import { setupOcrHttpProviderEnv } from './ocr-http.provider.test-helpers.js';

describe('OcrHttpProvider (local/base)', () => {
  setupOcrHttpProviderEnv();

  test('uses local Tesseract when OCR service URL is not configured', async () => {
    process.env.OCR_SERVICE_URL = '';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    jest.spyOn(localTesseractService, 'runLocalTesseract').mockResolvedValue({
      name: 'memo.pdf',
      ok: true,
      markdown: 'บันทึกข้อความ\nเรื่อง ทดสอบ OCR',
      engine_used: 'tesseract',
      document_kind: 'memo',
      fields: {
        subject: 'ทดสอบ OCR',
      },
      missing_fields: ['document_no', 'document_date'],
      quality: {
        required_fields: 3,
        captured_fields: 1,
        passed: false,
      },
    });

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile('memo.pdf', Buffer.from('file'), '');

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'tesseract',
        document_kind: 'memo',
        fields: expect.objectContaining({
          subject: 'ทดสอบ OCR',
        }),
      }),
    );
  });

  test('returns a clear OCR unavailable message when local Tesseract is not ready', async () => {
    process.env.OCR_SERVICE_URL = '';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    jest
      .spyOn(localTesseractService, 'runLocalTesseract')
      .mockRejectedValue(new Error('OCR_MAIN_SERVICE_UNAVAILABLE'));

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile('memo.pdf', Buffer.from('file'), '');

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'ยังไม่ได้เปิดบริการ OCR หลัก',
      }),
    );
  });

  test('returns normalized service base url', async () => {
    process.env.OCR_SERVICE_URL = 'http://ocr.test///';
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');

    expect(OcrHttpProvider.getServiceBase()).toBe('http://ocr.test');
  });

  test('retries once and succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ ok: true, markdown: 'ok', name: 'doc.pdf' }],
        }),
      });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'doc.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.markdown).toBe('ok');
  });
});
