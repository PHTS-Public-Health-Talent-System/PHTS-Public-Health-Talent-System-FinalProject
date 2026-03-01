const loadModule = async () => import('../../services/sync.service.js');

describe('deriveUserIsActive', () => {
  test('returns true when profile status is active', async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => 'MISSING');

    expect(derive('ACTIVE', null)).toBe(true);
  });

  test('returns false when profile status_code is inactive even if support is active', async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => 'MISSING');

    expect(derive('INACTIVE', 'ACTIVE')).toBe(false);
  });

  test('returns false when both sources inactive', async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => 'MISSING');

    expect(derive('INACTIVE', 'INACTIVE')).toBe(false);
  });

  test('returns true when profile code missing but support status_code is active', async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => 'MISSING');

    expect(derive(null, 'ACTIVE')).toBe(true);
  });

  test('returns false when both status_code values are missing', async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => 'MISSING');

    expect(derive(null, null)).toBe(false);
  });
});
