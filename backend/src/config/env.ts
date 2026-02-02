import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const root = process.cwd();
  const localPath = path.join(root, ".env.local");
  const defaultPath = path.join(root, ".env");
  const envPath = fs.existsSync(localPath) ? localPath : defaultPath;
  dotenv.config({ path: envPath });
  loaded = true;
}
