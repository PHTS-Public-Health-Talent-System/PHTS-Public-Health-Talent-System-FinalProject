import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const writeFile = (dir: string, name: string, content: string) => {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
};

describe("env loader", () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    process.chdir(originalCwd);
    jest.resetModules();
  });

  test("uses .env.test when NODE_ENV=test and file exists", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phts-env-"));
    writeFile(tempDir, ".env", "DB_NAME=default_db\n");
    writeFile(tempDir, ".env.local", "DB_NAME=local_db\n");
    writeFile(tempDir, ".env.test", "DB_NAME=test_db\n");

    process.chdir(tempDir);
    process.env.NODE_ENV = "test";
    delete process.env.DB_NAME;

    const { loadEnv } = await import("../env.js");
    loadEnv();

    expect(process.env.DB_NAME).toBe("test_db");
  });
});
