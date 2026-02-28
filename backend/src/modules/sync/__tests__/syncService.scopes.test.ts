const loadModule = async () => import('../services/domain/sync-scope.service.js');

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

  test('does not create scopes when profile special_position is empty', async () => {
    const mod = await loadModule();
    const syncSpecialPositionScopes = (mod as any).syncSpecialPositionScopes as Function;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const conn = {
      query: jest.fn().mockResolvedValue([
        [
          {
            user_id: 43815,
            citizen_id: '3102200342989',
            role: 'HEAD_DEPT',
            special_position: null,
            original_status: null,
            support_active: 1,
          },
        ],
      ]),
    } as any;
    const deps = {
      citizenIdJoinBinary: jest.fn().mockReturnValue('u.citizen_id = e.citizen_id'),
      isActiveOriginalStatus: jest.fn().mockReturnValue(false),
      parseScopes: jest.fn().mockReturnValue({
        wardScopes: [],
        deptScopes: [],
      }),
      disableScopeMappings: jest.fn().mockResolvedValue(undefined),
      disableScopeMappingsByCitizenId: jest.fn().mockResolvedValue(undefined),
      insertScopeMappings: jest.fn().mockResolvedValue(undefined),
      clearScopeCache: jest.fn(),
    };

    await syncSpecialPositionScopes(conn, deps);

    expect(deps.parseScopes).toHaveBeenCalledWith(null);
    expect(deps.insertScopeMappings).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('special_position parse failed: citizen_id=3102200342989'),
    );
    warnSpy.mockRestore();
  });
});
