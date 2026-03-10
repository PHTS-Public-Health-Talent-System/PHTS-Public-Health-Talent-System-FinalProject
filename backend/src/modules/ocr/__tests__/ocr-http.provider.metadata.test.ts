import { setupOcrHttpProviderEnv } from './ocr-http.provider.test-helpers.js';

describe('OcrHttpProvider (metadata normalization)', () => {
  setupOcrHttpProviderEnv();

  test('preserves rich OCR gateway fields in normalized response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            ok: true,
            name: 'doc.pdf',
            markdown: 'ocr text',
            engine_used: 'tesseract',
            fallback_used: false,
            document_kind: 'memo',
            fields: {
              document_no: 'อต 0033.104/000953',
              subject: 'ขอส่งสำเนาใบอนุญาต',
            },
            missing_fields: [],
            quality: {
              required_fields: 3,
              captured_fields: 3,
              passed: true,
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'doc.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        name: 'doc.pdf',
        markdown: 'ocr text',
        engine_used: 'tesseract',
        fallback_used: false,
        document_kind: 'memo',
        fields: {
          document_no: 'อต 0033.104/000953',
          subject: 'ขอส่งสำเนาใบอนุญาต',
        },
        missing_fields: [],
        quality: {
          required_fields: 3,
          captured_fields: 3,
          passed: true,
        },
      }),
    );
  });

  test('enriches plain OCR markdown with document metadata when gateway does not provide it', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            ok: true,
            name: 'memo.pdf',
            markdown: `
บันทึกข้อความ
ที่ อต 0033.104/000953
วันที่ 15 มกราคม 2569
เรื่อง ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพ
            `,
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'memo.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        document_kind: 'memo',
        fields: expect.objectContaining({
          document_no: 'อต 0033.104/000953',
          document_date: '15 มกราคม 2569',
          subject: 'ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพ',
        }),
        missing_fields: [],
        quality: {
          required_fields: 3,
          captured_fields: 3,
          passed: true,
        },
      }),
    );
  });
});
