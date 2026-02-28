describe('OcrHttpProvider', () => {
  const originalFetch = global.fetch;
  const originalTimeout = process.env.OCR_FILE_TIMEOUT_MS;
  const originalRetry = process.env.OCR_FILE_RETRY_COUNT;
  const originalService = process.env.OCR_SERVICE_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.OCR_FILE_TIMEOUT_MS = '1000';
    process.env.OCR_FILE_RETRY_COUNT = '1';
    process.env.OCR_SERVICE_URL = 'http://ocr.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) delete process.env.OCR_FILE_TIMEOUT_MS;
    else process.env.OCR_FILE_TIMEOUT_MS = originalTimeout;
    if (originalRetry === undefined) delete process.env.OCR_FILE_RETRY_COUNT;
    else process.env.OCR_FILE_RETRY_COUNT = originalRetry;
    if (originalService === undefined) delete process.env.OCR_SERVICE_URL;
    else process.env.OCR_SERVICE_URL = originalService;
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
