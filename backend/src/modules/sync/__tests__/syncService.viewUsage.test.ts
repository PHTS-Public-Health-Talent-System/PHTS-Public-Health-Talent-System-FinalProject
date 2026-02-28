const loadModule = async () => import("../repositories/sync-query-builders.repository.js");

describe("SyncService view usage", () => {
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

});
