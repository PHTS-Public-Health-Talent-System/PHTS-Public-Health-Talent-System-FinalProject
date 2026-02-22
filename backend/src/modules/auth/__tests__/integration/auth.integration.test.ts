import { resetAuthSchema, getTestConnection } from '@/test/test-db.js';

jest.setTimeout(30000);

describe("AuthRepository (integration)", () => {
  let AuthRepository: typeof import("../../repositories/auth.repository.js").AuthRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();
    ({ AuthRepository } = await import("../../repositories/auth.repository.js"));
    await resetAuthSchema();
  });

  test("findByCitizenId returns user row", async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["111", "hash", "PTS_OFFICER", 1],
      );
    } finally {
      await conn.end();
    }

    const user = await AuthRepository.findByCitizenId("111");
    expect(user).not.toBeNull();
    expect(user?.citizen_id).toBe("111");
    expect(user?.role).toBe("PTS_OFFICER");
  });

  test("findEmployeeProfileByCitizenId prefers emp_profiles then fallback", async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, position_name, department, emp_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["222", "A", "B", "Doctor", "Dept", "CIVIL"],
      );
      await conn.execute(
        `INSERT INTO emp_support_staff
         (citizen_id, first_name, last_name, position_name, department, emp_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["333", "C", "D", "Support", "Dept2", "SUPPORT"],
      );
    } finally {
      await conn.end();
    }

    const profile = await AuthRepository.findEmployeeProfileByCitizenId("222");
    expect(profile?.first_name).toBe("A");
    expect(profile?.position).toBe("Doctor");

    const fallback =
      await AuthRepository.findEmployeeProfileByCitizenId("333");
    expect(fallback?.position).toBe("Support");
  });
});
