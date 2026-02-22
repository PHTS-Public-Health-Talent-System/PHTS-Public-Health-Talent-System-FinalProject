const loadModule = async () => import("../services/sync.service.js");

describe("SyncService signatures source", () => {
  test("signatures query uses hrms signature table and selects citizen_id without joining users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildSignaturesViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM hrms_databases.signature");
    expect(sql).toContain("citizen_id");
    expect(sql).not.toContain("JOIN users");
  });
});
