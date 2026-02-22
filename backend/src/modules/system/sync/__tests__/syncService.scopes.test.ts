const loadModule = async () => import('../services/sync.service.js');

describe('buildScopesFromSpecialPosition', () => {
  test('parses head dept scopes and ignores admin segments', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.(
      'ตำแหน่งด้านบริหาร-รองผู้อำนวยการฝ่ายการแพทย์,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านบริการปฐมภูมิ,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านทุติยภูมิและตติยภูมิ',
    );

    expect(result).toEqual({
      wardScopes: [],
      deptScopes: [
        'ภารกิจด้านบริการปฐมภูมิ',
        'ภารกิจด้านทุติยภูมิและตติยภูมิ',
      ],
    });
  });

  test('ignores head nurse scope and keeps valid dept scope', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.(
      'ตำแหน่งด้านบริหาร-หัวหน้าพยาบาล,หัวหน้ากลุ่มภารกิจ-รองผู้อำนวยการฝ่ายการพยาบาล,หัวหน้ากลุ่มภารกิจ-หัวหน้าพยาบาล,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านการพยาบาล',
    );

    expect(result).toEqual({
      wardScopes: [],
      deptScopes: ['ภารกิจด้านการพยาบาล'],
    });
  });

  test('returns empty scopes for empty input', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.('');

    expect(result).toEqual({ wardScopes: [], deptScopes: [] });
  });
});
