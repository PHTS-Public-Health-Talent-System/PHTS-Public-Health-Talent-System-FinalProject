const loadModule = async () => import("../services/syncService.js");

describe("SyncService view usage", () => {
  test("licenses query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildLicensesViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM vw_hrms_licenses");
    expect(sql).not.toContain("JOIN users");
  });

  test("quotas query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildQuotasViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM vw_hrms_leave_quotas");
    expect(sql).not.toContain("JOIN users");
  });

  test("leaves query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildLeaveViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM vw_hrms_leave_requests");
    expect(sql).not.toContain("JOIN users");
  });

  test("movements query uses view and does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildMovementsViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM vw_hrms_movements");
    expect(sql).not.toContain("JOIN users");
  });
});
