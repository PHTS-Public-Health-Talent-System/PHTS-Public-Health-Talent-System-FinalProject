import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import path from "node:path";
import { stat } from "node:fs/promises";
import { SystemRepository } from '@/modules/system/repositories/system.repository.js';
import redis from '@config/redis.js';

const execFileAsync = promisify(execFile);
const BACKUP_LOCK_KEY = 'system:backup:lock';

type BackupConfig = {
  enabled: boolean;
  command: string;
  argsRaw: string;
  workdir: string;
  timeoutMs: number;
};

const getBackupConfig = (): BackupConfig => ({
  enabled: process.env.BACKUP_ENABLED === "true",
  command: process.env.BACKUP_COMMAND || "",
  argsRaw: process.env.BACKUP_ARGS || "",
  workdir: process.env.BACKUP_WORKDIR || process.cwd(),
  timeoutMs: Number(process.env.BACKUP_TIMEOUT_MS || 300000),
});

function validateBackupCommand(command: string): void {
  if (!command) throw new Error("BACKUP_COMMAND is not configured");
  if (/\s/.test(command)) {
    throw new Error("BACKUP_COMMAND must be an executable path without spaces");
  }
  if (!path.isAbsolute(command)) {
    throw new Error("BACKUP_COMMAND must be an absolute path");
  }
}

function parseBackupArgs(raw: string): string[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((arg) => typeof arg === "string")) {
    throw new Error("BACKUP_ARGS must be a JSON array of strings");
  }
  return parsed;
}

function resolveBackupFilePath(output: string, workdir: string): string | null {
  const match = /Backup written to (.+)$/m.exec(output);
  const backupPathRaw = match?.[1]?.trim() || null;
  if (!backupPathRaw) return null;
  if (path.isAbsolute(backupPathRaw)) return backupPathRaw;
  return path.resolve(workdir, backupPathRaw);
}

export async function runBackupJob(options?: {
  triggerSource?: "MANUAL" | "SCHEDULED";
  triggeredBy?: number | null;
}): Promise<{
  enabled: boolean;
  jobId?: number;
  status?: "SUCCESS" | "FAILED";
  output?: string;
}> {
  const config = getBackupConfig();

  if (!config.enabled) {
    return { enabled: false };
  }

  const lockValue = `backup:${Date.now()}:${crypto.randomUUID()}`;
  const lockTtlSeconds = Math.max(
    60,
    Math.ceil(config.timeoutMs / 1000) + 60,
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
    validateBackupCommand(config.command);
    const args = parseBackupArgs(config.argsRaw);
    const result = await execFileAsync(config.command, args, {
      cwd: config.workdir,
      timeout: config.timeoutMs,
    });

    const output = result.stdout?.toString() ?? "";
    const stderr = result.stderr?.toString() ?? "";
    const durationMs = Date.now() - startedAt;
    const backupFilePath = resolveBackupFilePath(output, config.workdir);

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
    const normalizedErrorMessage = errorMessage;
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
