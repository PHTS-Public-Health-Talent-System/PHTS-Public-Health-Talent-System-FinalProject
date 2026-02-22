const loadModule = async () => import("../services/sync.service.js");

describe("SyncService selectColumns", () => {
  test("prefixes columns with alias", async () => {
    const mod = await loadModule();
    const select = (mod as any).selectColumns ?? null;

    expect(select?.("lr", ["citizen_id", "start_date"]))
      .toBe("lr.citizen_id, lr.start_date");
  });
});
