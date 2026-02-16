import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { stat } from "node:fs/promises";
import { SystemRepository } from '@/modules/system/repositories/system.repository.js';
import redis from '@config/redis.js';

const execFileAsync = promisify(execFile);
const BACKUP_LOCK_KEY = 'system:backup:lock';

export async function runBackupJob(options?: {
  triggerSource?: "MANUAL" | "SCHEDULED";
  triggeredBy?: number | null;
}): Promise<{
  enabled: boolean;
  jobId?: number;
  status?: "SUCCESS" | "FAILED";
  output?: string;
}> {
  const BACKUP_ENABLED = process.env.BACKUP_ENABLED === "true";
  const BACKUP_COMMAND = process.env.BACKUP_COMMAND || "";
  const BACKUP_ARGS = process.env.BACKUP_ARGS || "";
  const BACKUP_WORKDIR = process.env.BACKUP_WORKDIR || process.cwd();
  const BACKUP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS || 300000);

  if (!BACKUP_ENABLED) {
    return { enabled: false };
  }

  const lockValue = `backup:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const lockTtlSeconds = Math.max(
    60,
    Math.ceil(BACKUP_TIMEOUT_MS / 1000) + 60,
  );
  const locked = await redis.set(
    BACKUP_LOCK_KEY,
    lockValue,
    "EX",
    lockTtlSeconds,
    "NX",
  );
  if (!locked) {
    throw new Error("Backup is already in progress.");
  }

  const startedAt = Date.now();
  const triggerSource = options?.triggerSource ?? "MANUAL";
  const triggeredBy = options?.triggeredBy ?? null;
  const jobId = await SystemRepository.createBackupJob(triggerSource, triggeredBy);

  try {
    if (!BACKUP_COMMAND) {
      throw new Error("BACKUP_COMMAND is not configured");
    }

    if (/\s/.test(BACKUP_COMMAND)) {
      throw new Error("BACKUP_COMMAND must be an executable path without spaces");
    }

    if (!path.isAbsolute(BACKUP_COMMAND)) {
      throw new Error("BACKUP_COMMAND must be an absolute path");
    }

    let args: string[] = [];
    if (BACKUP_ARGS) {
      const parsed = JSON.parse(BACKUP_ARGS);
      if (!Array.isArray(parsed) || !parsed.every((arg) => typeof arg === "string")) {
        throw new Error("BACKUP_ARGS must be a JSON array of strings");
      }
      args = parsed;
    }

    const result = await execFileAsync(BACKUP_COMMAND, args, {
      cwd: BACKUP_WORKDIR,
      timeout: BACKUP_TIMEOUT_MS,
    });

    const output = result.stdout?.toString() ?? "";
    const stderr = result.stderr?.toString() ?? "";
    const durationMs = Date.now() - startedAt;
    const match = /Backup written to (.+)$/m.exec(output);
    const backupPathRaw = match?.[1]?.trim() || null;
    const backupFilePath = backupPathRaw
      ? path.isAbsolute(backupPathRaw)
        ? backupPathRaw
        : path.resolve(BACKUP_WORKDIR, backupPathRaw)
      : null;

    let backupFileSizeBytes: number | null = null;
    if (backupFilePath) {
      try {
        const fileStats = await stat(backupFilePath);
        backupFileSizeBytes = Number(fileStats.size ?? 0);
      } catch {
        // Keep null size if file metadata cannot be read.
      }
    }

    await SystemRepository.finishBackupJob(jobId, {
      status: "SUCCESS",
      backupFilePath,
      backupFileSizeBytes,
      durationMs,
      stdoutText: output.slice(0, 8000),
      stderrText: stderr.slice(0, 8000),
    });

    return { enabled: true, jobId, status: "SUCCESS", output };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const normalizedErrorMessage = errorMessage.includes(
      "BACKUP_ARGS must be",
    )
      ? errorMessage
      : errorMessage;
    await SystemRepository.finishBackupJob(jobId, {
      status: "FAILED",
      durationMs,
      errorMessage: normalizedErrorMessage.slice(0, 2000),
    });
    throw error;
  } finally {
    await releaseBackupLock(lockValue);
  }
}

async function releaseBackupLock(lockValue: string): Promise<void> {
  try {
    const current = await redis.get(BACKUP_LOCK_KEY);
    if (current === lockValue) {
      await redis.del(BACKUP_LOCK_KEY);
    }
  } catch {
    // Best effort lock release.
  }
}
