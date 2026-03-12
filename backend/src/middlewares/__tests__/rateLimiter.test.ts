jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: jest.fn((config: unknown) => {
    const middleware = jest.fn();
    (middleware as any).__config = config;
    return middleware;
  }),
}));

describe('rateLimiter', () => {
  const originalEnv = { ...process.env };
  const getRateLimitMock = () =>
    (jest.requireMock('express-rate-limit').default as unknown as jest.Mock);

  const getConfigs = async () => {
    jest.resetModules();
    const mod = await import('@middlewares/rateLimiter.js');
    const mockedRateLimit = getRateLimitMock();
    const calls = mockedRateLimit.mock.calls;
    return {
      mod,
      apiConfig: calls[0]?.[0] as any,
      authConfig: calls[1]?.[0] as any,
    };
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    getRateLimitMock().mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds api/auth limiters with env-based thresholds and messages', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '10000';
    process.env.RATE_LIMIT_MAX = '123';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '20000';
    process.env.AUTH_RATE_LIMIT_MAX = '7';

    const { mod, apiConfig, authConfig } = await getConfigs();

    expect(typeof mod.apiRateLimiter).toBe('function');
    expect(typeof mod.authRateLimiter).toBe('function');
    expect(apiConfig.windowMs).toBe(10000);
    expect(apiConfig.max).toBe(123);
    expect(apiConfig.message.error).toContain('Too many requests');
    expect(authConfig.windowMs).toBe(20000);
    expect(authConfig.max).toBe(7);
    expect(typeof authConfig.handler).toBe('function');
  });

  it('skips limiting in test environment', async () => {
    process.env.NODE_ENV = 'test';

    const { apiConfig, authConfig } = await getConfigs();

    expect(apiConfig.skip({}, {})).toBe(true);
    expect(authConfig.skip({}, {})).toBe(true);
  });

  it('enforces limits in production', async () => {
    process.env.NODE_ENV = 'production';

    const { apiConfig, authConfig } = await getConfigs();

    expect(apiConfig.skip({}, {})).toBe(false);
    expect(authConfig.skip({}, {})).toBe(false);
  });

  it('does not skip limiting in non-test env when disable flag is absent', async () => {
    process.env.NODE_ENV = 'production';

    const { apiConfig, authConfig } = await getConfigs();

    expect(apiConfig.skip({}, {})).toBe(false);
    expect(authConfig.skip({}, {})).toBe(false);
  });

  it('skips limiting in development for localhost requests', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_ENABLE_RATE_LIMIT;

    const { apiConfig, authConfig } = await getConfigs();
    const localhostReq = { ip: '127.0.0.1', headers: {} } as any;

    expect(apiConfig.skip(localhostReq, {})).toBe(true);
    expect(authConfig.skip(localhostReq, {})).toBe(true);
  });

  it('does not skip development limiting for non-local forwarded clients', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_ENABLE_RATE_LIMIT = 'true';

    const { apiConfig, authConfig } = await getConfigs();
    const forwardedReq = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
    } as any;

    expect(apiConfig.skip(forwardedReq, {})).toBe(false);
    expect(authConfig.skip(forwardedReq, {})).toBe(false);
  });

  it('skips development limiting for non-local forwarded clients by default', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_ENABLE_RATE_LIMIT;

    const { apiConfig, authConfig } = await getConfigs();
    const forwardedReq = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
    } as any;

    expect(apiConfig.skip(forwardedReq, {})).toBe(true);
    expect(authConfig.skip(forwardedReq, {})).toBe(true);
  });

  it('skips api limiter for /api/auth routes to avoid double-limiting login', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_ENABLE_RATE_LIMIT = 'true';

    const { apiConfig, authConfig } = await getConfigs();

    expect(apiConfig.skip({ path: '/auth/login' }, {})).toBe(true);
    expect(apiConfig.skip({ path: '/auth/logout' }, {})).toBe(true);
    expect(apiConfig.skip({ path: '/requests' }, {})).toBe(false);
    expect(authConfig.skip({ path: '/auth/login' }, {})).toBe(false);
  });

  it('auth handler returns retry-after metadata for login rate limit', async () => {
    process.env.NODE_ENV = 'development';

    const { authConfig } = await getConfigs();
    const req = {
      rateLimit: {
        resetTime: new Date(Date.now() + 90_000),
      },
    } as any;
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const setHeader = jest.fn();
    const res = { status, setHeader } as any;

    authConfig.handler(req, res);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(status).toHaveBeenCalledWith(429);
    const payload = json.mock.calls[0][0];
    expect(payload.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
    expect(payload.retry_after_seconds).toBeGreaterThan(0);
    expect(payload.retry_after_minutes).toBeGreaterThan(0);
  });

  it('uses forwarded headers for rate-limit key generation', async () => {
    const { apiConfig, authConfig } = await getConfigs();

    const reqFromCloudflare = {
      headers: { 'cf-connecting-ip': '198.51.100.12' },
      ip: '127.0.0.1',
    } as any;
    const reqFromForwardedFor = {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
      ip: '127.0.0.1',
    } as any;
    const reqFallback = { headers: {}, ip: '127.0.0.1' } as any;

    expect(apiConfig.keyGenerator(reqFromCloudflare)).toBe('ip:198.51.100.12');
    expect(apiConfig.keyGenerator(reqFromForwardedFor)).toBe('ip:203.0.113.7');
    expect(apiConfig.keyGenerator(reqFallback)).toBe('ip:127.0.0.1');
    expect(authConfig.keyGenerator(reqFromCloudflare)).toBe('ip:198.51.100.12');
  });
});
