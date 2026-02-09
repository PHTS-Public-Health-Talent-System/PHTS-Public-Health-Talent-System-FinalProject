const loadModule = async () => import("../services/syncService.js");

describe("deriveUserIsActive", () => {
  test("returns true when profile status is active", async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => "MISSING");

    expect(derive("ปฏิบัติงาน (ตรง จ.)", null)).toBe(true);
  });

  test("returns true when support login enabled", async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => "MISSING");

    expect(derive("ไม่ปฏิบัติงาน (ลาออก)", 1)).toBe(true);
  });

  test("returns false when both sources inactive", async () => {
    const mod = await loadModule();
    const derive =
      (mod as any).deriveUserIsActive ??
      ((..._args: any[]) => "MISSING");

    expect(derive("ไม่ปฏิบัติงาน (เกษียณ)", 0)).toBe(false);
  });
});
