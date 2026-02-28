jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('file')),
}));

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    lpush: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('@/modules/ocr/repositories/ocr-request.repository.js', () => ({
  OcrRequestRepository: {
    updateRequestPrecheck: jest.fn().mockResolvedValue(undefined),
    findAttachments: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/modules/ocr/providers/ocr-http.provider.js', () => ({
  OcrHttpProvider: {
    getServiceBase: jest.fn(),
    processSingleFile: jest.fn(),
  },
}));

describe('ocr precheck service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('marks request as skipped when OCR service is not configured', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('');

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(10);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: 'skipped',
      }),
    );
  });

  test('marks request as failed when no attachments are available', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([]);

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(11);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      11,
      expect.objectContaining({
        status: 'failed',
        error: 'No attachments to OCR',
      }),
    );
  });

  test('stores completed result when at least one attachment succeeds', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock).mockResolvedValue({
      ok: true,
      markdown: 'text',
      name: 'a.pdf',
    });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(12);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      12,
      expect.objectContaining({
        status: 'completed',
        success_count: 1,
        failed_count: 0,
      }),
    );
  });
});
