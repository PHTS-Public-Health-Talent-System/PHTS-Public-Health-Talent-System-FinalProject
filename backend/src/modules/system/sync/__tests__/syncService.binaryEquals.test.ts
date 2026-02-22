const loadModule = async () => import("../services/sync.service.js");

describe("binaryEquals", () => {
  test("builds CAST(... AS BINARY) comparison", async () => {
    const mod = await loadModule();
    const binaryEquals = (mod as any).binaryEquals ?? null;

    expect(binaryEquals?.("t1.id", "u.citizen_id")).toBe(
      "CAST(t1.id AS BINARY) = CAST(u.citizen_id AS BINARY)",
    );
  });
});
