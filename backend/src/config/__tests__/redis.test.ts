describe('redis config live client wrapper', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('ioredis');
    jest.unmock('@config/env.js');
  });

  test('live client eval delegates to the underlying ioredis instance without recursion', async () => {
    process.env.NODE_ENV = 'development';

    const rawEval = jest.fn().mockResolvedValue('OK');
    const on = jest.fn().mockReturnThis();

    const RedisMock = jest.fn().mockImplementation(() => ({
      eval: rawEval,
      on,
    }));

    jest.doMock('ioredis', () => ({ Redis: RedisMock }));
    jest.doMock('@config/env.js', () => ({ loadEnv: jest.fn() }));

    const mod = await import('@config/redis.js');
    const result = await mod.default.eval('return 1', 1, 'key', 'value');

    expect(result).toBe('OK');
    expect(rawEval).toHaveBeenCalledTimes(1);
    expect(rawEval).toHaveBeenCalledWith('return 1', 1, 'key', 'value');
  });
});
