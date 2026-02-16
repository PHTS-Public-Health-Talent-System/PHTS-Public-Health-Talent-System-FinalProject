import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const root = process.cwd();
  const testPath = path.join(root, ".env.test");
  const localPath = path.join(root, ".env.local");
  const defaultPath = path.join(root, ".env");
  const useTestEnv =
    process.env.NODE_ENV === "test" && fs.existsSync(testPath);
  const envPath = useTestEnv
    ? testPath
    : fs.existsSync(localPath)
      ? localPath
      : defaultPath;
  dotenv.config({ path: envPath });

  const appTimezone = process.env.APP_TIMEZONE || "Asia/Bangkok";
  process.env.APP_TIMEZONE = appTimezone;
  if (!process.env.TZ) {
    process.env.TZ = appTimezone;
  }

  if (!process.env.DB_TIMEZONE) {
    process.env.DB_TIMEZONE = "+07:00";
  }

  loaded = true;
}
