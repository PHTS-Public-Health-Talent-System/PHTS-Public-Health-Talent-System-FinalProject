import { apiRateLimiter, authRateLimiter } from '@middlewares/rateLimiter.js';

describe('rateLimiter exports', () => {
  it('exports api and auth rate limiters', () => {
    expect(typeof apiRateLimiter).toBe('function');
    expect(typeof authRateLimiter).toBe('function');
  });
});
