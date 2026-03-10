export const setupOcrHttpProviderEnv = () => {
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
};
