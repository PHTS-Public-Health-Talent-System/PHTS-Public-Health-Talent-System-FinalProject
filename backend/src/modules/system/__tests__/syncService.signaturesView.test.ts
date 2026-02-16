const loadModule = async () => import("../services/syncService.js");

describe("SyncService signatures view", () => {
  test("signatures query uses view and selects citizen_id without joining users", async () => {
    const mod = await loadModule();
    const build = (mod as any).buildSignaturesViewQuery ?? null;
    const sql = build?.() ?? "";

    expect(sql).toContain("FROM vw_hrms_signatures");
    expect(sql).toContain("citizen_id");
    expect(sql).not.toContain("JOIN users");
  });
});
