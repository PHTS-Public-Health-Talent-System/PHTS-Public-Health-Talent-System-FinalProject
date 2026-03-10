import { setupOcrHttpProviderEnv } from './ocr-http.provider.test-helpers.js';

describe('OcrHttpProvider (fallback chain)', () => {
  setupOcrHttpProviderEnv();

  test('falls back to Typhoon OCR when Tesseract quality does not pass', async () => {
    process.env.OCR_PADDLE_SERVICE_URL = '';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: `
คำสั่งกลุ่มงานเภสัชกรรม
เรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน
๑. งานเตรียมหรือผลิตยาเคมีบำบัด
              `,
              engine_used: 'tesseract',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: 'rich ocr text',
              engine_used: 'typhoon',
              document_kind: 'assignment_order',
              fields: {
                order_no: '1/2564',
                subject: 'ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน',
                person_name: 'ภัทรชา หอมสร้อย',
                section_title: 'งานเตรียมหรือผลิตยาเคมีบำบัด',
              },
              missing_fields: [],
              quality: {
                required_fields: 4,
                captured_fields: 4,
                passed: true,
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ocr.test/ocr-batch');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://typhoon.test/ocr-batch');
    expect(result).toEqual(
      expect.objectContaining({
        engine_used: 'typhoon',
        fallback_used: true,
        document_kind: 'assignment_order',
        quality: {
          required_fields: 4,
          captured_fields: 4,
          passed: true,
        },
      }),
    );
  });

  test('does not fall back to Typhoon OCR when Tesseract already passes', async () => {
    process.env.OCR_PADDLE_SERVICE_URL = '';
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
            engine_used: 'tesseract',
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.engine_used).toBe('tesseract');
    expect(result.quality?.passed).toBe(true);
  });

  test('returns Tesseract result when Typhoon OCR is unavailable', async () => {
    process.env.OCR_PADDLE_SERVICE_URL = '';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: `
คำสั่งกลุ่มงานเภสัชกรรม
เรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน
๑. งานเตรียมหรือผลิตยาเคมีบำบัด
              `,
              engine_used: 'tesseract',
            },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED typhoon'));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://typhoon.test/ocr-batch');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://typhoon.test/ocr-batch');
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'tesseract',
        fallback_used: false,
        document_kind: 'assignment_order',
        quality: expect.objectContaining({
          passed: false,
        }),
      }),
    );
  });

  test('falls back to Paddle OCR when primary OCR endpoint is unavailable', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED primary'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED primary'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'memo.pdf',
              markdown: 'paddle ocr text',
              engine_used: 'paddle',
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

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://paddle.test/ocr-batch');
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'paddle',
        fallback_used: true,
      }),
    );
  });

  test('uses Paddle as second step then Typhoon as third step when quality is still not enough', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: 'primary low quality',
              engine_used: 'tesseract',
              document_kind: 'assignment_order',
              fields: {
                subject: 'low',
              },
              missing_fields: ['order_no', 'person_name', 'section_title'],
              quality: {
                required_fields: 4,
                captured_fields: 1,
                passed: false,
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: 'paddle low quality',
              engine_used: 'paddle',
              document_kind: 'assignment_order',
              fields: {
                subject: 'still low',
                person_name: 'ทดสอบ',
              },
              missing_fields: ['order_no', 'section_title'],
              quality: {
                required_fields: 4,
                captured_fields: 2,
                passed: false,
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              ok: true,
              name: 'order.pdf',
              markdown: 'typhoon final quality',
              engine_used: 'typhoon',
              document_kind: 'assignment_order',
              fields: {
                order_no: '1/2569',
                subject: 'final',
                person_name: 'ทดสอบ',
                section_title: 'งานทดสอบ',
              },
              missing_fields: [],
              quality: {
                required_fields: 4,
                captured_fields: 4,
                passed: true,
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      'http://ocr.test',
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ocr.test/ocr-batch');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://paddle.test/ocr-batch');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://typhoon.test/ocr-batch');
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'typhoon',
        fallback_used: true,
      }),
    );
  });

  test('uses local Paddle when paddle URL is not configured and local mode is enabled', async () => {
    process.env.OCR_PADDLE_SERVICE_URL = '';
    process.env.OCR_PADDLE_LOCAL_ENABLED = 'true';
    const localPaddleService = await import('@/modules/ocr/services/ocr-local-paddle.service.js');
    jest.spyOn(localPaddleService, 'runLocalPaddle').mockResolvedValue({
      name: 'memo.pdf',
      ok: true,
      markdown: 'local paddle text',
      engine_used: 'paddle',
      quality: { required_fields: 3, captured_fields: 3, passed: true },
    });

    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED primary'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED primary'));
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
        engine_used: 'paddle',
        fallback_used: true,
      }),
    );
  });
});
