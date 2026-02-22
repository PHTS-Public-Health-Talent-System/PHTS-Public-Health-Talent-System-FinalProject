const loadModule = async () => import("../services/sync.service.js");

describe("SyncService collation helpers", () => {
  test("citizenIdJoinBinary builds binary join", async () => {
    const mod = await loadModule();
    const join = (mod as any).citizenIdJoinBinary ?? null;

    expect(join?.("m", "u")).toBe(
      "CAST(m.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)",
    );
  });

  test("citizenIdWhereBinary builds binary where", async () => {
    const mod = await loadModule();
    const where = (mod as any).citizenIdWhereBinary ?? null;

    expect(where?.("m", "?")).toBe(
      "CAST(m.citizen_id AS BINARY) = CAST(? AS BINARY)",
    );
  });
});
