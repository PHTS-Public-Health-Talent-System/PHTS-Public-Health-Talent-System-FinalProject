import { describe, expect, it } from 'vitest';

import { buildHeadScopeRequestHref, sanitizeHeadScopeBasePath } from './safe-route';

describe('safe-route helpers', () => {
  it('sanitizes unsafe base path to root fallback', () => {
    expect(sanitizeHeadScopeBasePath('javascript:alert(1)')).toBe('/');
    expect(sanitizeHeadScopeBasePath('https://evil.example')).toBe('/');
  });

  it('keeps valid absolute base path without trailing slash', () => {
    expect(sanitizeHeadScopeBasePath('/head-scope/')).toBe('/head-scope');
  });

  it('builds request href only for numeric ids', () => {
    expect(buildHeadScopeRequestHref('/head-scope', 123, '/requests')).toBe('/head-scope/requests/123');
    expect(buildHeadScopeRequestHref('/head-scope', 'abc', '/requests')).toBe('/head-scope');
  });

  it('supports query parameter when provided', () => {
    expect(buildHeadScopeRequestHref('/head-scope', '55', '/requests', { from: 'history' })).toBe(
      '/head-scope/requests/55?from=history',
    );
  });
});
