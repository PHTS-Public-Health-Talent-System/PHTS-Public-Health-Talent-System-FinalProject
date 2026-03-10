describe('OcrHttpProvider', () => {
  const originalFetch = global.fetch;
  const originalTimeout = process.env.OCR_FILE_TIMEOUT_MS;
  const originalRetry = process.env.OCR_FILE_RETRY_COUNT;
  const originalService = process.env.OCR_SERVICE_URL;
  const originalPaddleService = process.env.OCR_PADDLE_SERVICE_URL;
  const originalPaddleLocalEnabled = process.env.OCR_PADDLE_LOCAL_ENABLED;
  const originalTyphoonService = process.env.OCR_TYPHOON_SERVICE_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.OCR_FILE_TIMEOUT_MS = '1000';
    process.env.OCR_FILE_RETRY_COUNT = '1';
    process.env.OCR_SERVICE_URL = 'http://ocr.test';
    process.env.OCR_PADDLE_SERVICE_URL = 'http://paddle.test';
    process.env.OCR_PADDLE_LOCAL_ENABLED = 'false';
    process.env.OCR_TYPHOON_SERVICE_URL = 'http://typhoon.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) delete process.env.OCR_FILE_TIMEOUT_MS;
    else process.env.OCR_FILE_TIMEOUT_MS = originalTimeout;
    if (originalRetry === undefined) delete process.env.OCR_FILE_RETRY_COUNT;
    else process.env.OCR_FILE_RETRY_COUNT = originalRetry;
    if (originalService === undefined) delete process.env.OCR_SERVICE_URL;
    else process.env.OCR_SERVICE_URL = originalService;
    if (originalPaddleService === undefined) delete process.env.OCR_PADDLE_SERVICE_URL;
    else process.env.OCR_PADDLE_SERVICE_URL = originalPaddleService;
    if (originalPaddleLocalEnabled === undefined) delete process.env.OCR_PADDLE_LOCAL_ENABLED;
    else process.env.OCR_PADDLE_LOCAL_ENABLED = originalPaddleLocalEnabled;
    if (originalTyphoonService === undefined) delete process.env.OCR_TYPHOON_SERVICE_URL;
    else process.env.OCR_TYPHOON_SERVICE_URL = originalTyphoonService;
  });

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
    const result = await OcrHttpProvider.processSingleFile(
      'memo.pdf',
      Buffer.from('file'),
      '',
    );

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
    const result = await OcrHttpProvider.processSingleFile(
      'memo.pdf',
      Buffer.from('file'),
      '',
    );

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
