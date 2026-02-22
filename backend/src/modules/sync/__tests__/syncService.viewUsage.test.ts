const loadModule = async () => import("../services/sync.service.js");

describe("SyncService view usage", () => {
  test("licenses query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildLicensesViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM hrms_databases.tb_bp_license");
    expect(sql).toContain("JOIN emp_profiles");
    expect(sql).not.toContain("JOIN users");
  });

  test("quotas query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildQuotasViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM hrms_databases.setdays");
    expect(sql).toContain("JOIN emp_profiles");
    expect(sql).not.toContain("JOIN users");
  });

  test("leaves query does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildLeaveViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM hrms_databases.data_leave");
    expect(sql).toContain("FROM hrms_databases.tb_meeting");
    expect(sql).not.toContain("JOIN users");
  });

  test("movements query uses hrms table and does not join users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildMovementsViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM hrms_databases.tb_bp_status");
    expect(sql).toContain("JOIN emp_profiles");
    expect(sql).not.toContain("JOIN users");
  });
});
