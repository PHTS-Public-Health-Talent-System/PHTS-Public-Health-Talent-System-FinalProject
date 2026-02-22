import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import path from "node:path";
import { stat } from "node:fs/promises";
import { BackupRepository } from '@/modules/system/repositories/backup.repository.js';
import redis from '@config/redis.js';

const execFileAsync = promisify(execFile);
const BACKUP_LOCK_KEY = 'system:backup:lock';
const BACKUP_SCHEDULE_KEY = 'system:backup:schedule';
const BACKUP_LAST_RUN_PREFIX = 'system:backup:last-run:';
const DEFAULT_BACKUP_HOUR = 2;
const DEFAULT_BACKUP_MINUTE = 0;
const DEFAULT_BACKUP_TIMEZONE = process.env.BACKUP_JOB_TIMEZONE || 'Asia/Bangkok';

type BackupConfig = {
  enabled: boolean;
  command: string;
  argsRaw: string;
  workdir: string;
  timeoutMs: number;
};

export type BackupScheduleConfig = {
  hour: number;
  minute: number;
  timezone: string;
};

const getBackupConfig = (): BackupConfig => ({
  enabled: process.env.BACKUP_ENABLED === "true",
  command: process.env.BACKUP_COMMAND || "",
  argsRaw: process.env.BACKUP_ARGS || "",
  workdir: process.env.BACKUP_WORKDIR || process.cwd(),
  timeoutMs: Number(process.env.BACKUP_TIMEOUT_MS || 300000),
});

const toTwoDigits = (value: number): string => String(value).padStart(2, '0');

const parseSchedule = (raw: string | null): { hour: number; minute: number } => {
  if (!raw) {
    return { hour: DEFAULT_BACKUP_HOUR, minute: DEFAULT_BACKUP_MINUTE };
  }
  const match = /^(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) {
    return { hour: DEFAULT_BACKUP_HOUR, minute: DEFAULT_BACKUP_MINUTE };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { hour: DEFAULT_BACKUP_HOUR, minute: DEFAULT_BACKUP_MINUTE };
  }
  return { hour, minute };
};

const getZonedDateParts = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    hour: Number(getPart('hour')),
    minute: Number(getPart('minute')),
  };
};

const buildDateKey = (parts: { year: number; month: number; day: number }) =>
  `${parts.year}-${toTwoDigits(parts.month)}-${toTwoDigits(parts.day)}`;

export async function getBackupScheduleConfig(): Promise<BackupScheduleConfig> {
  const raw = await redis.get(BACKUP_SCHEDULE_KEY);
  const parsed = parseSchedule(raw);
  return {
    hour: parsed.hour,
    minute: parsed.minute,
    timezone: DEFAULT_BACKUP_TIMEZONE,
  };
}

export async function setBackupScheduleConfig(input: {
  hour: number;
  minute: number;
}): Promise<BackupScheduleConfig> {
  const hour = Math.max(0, Math.min(23, Math.floor(Number(input.hour))));
  const minute = Math.max(0, Math.min(59, Math.floor(Number(input.minute))));
  await redis.set(BACKUP_SCHEDULE_KEY, `${toTwoDigits(hour)}:${toTwoDigits(minute)}`);
  return {
    hour,
    minute,
    timezone: DEFAULT_BACKUP_TIMEZONE,
  };
}

export async function shouldRunScheduledBackup(at: Date = new Date()): Promise<boolean> {
  const schedule = await getBackupScheduleConfig();
  const parts = getZonedDateParts(at, schedule.timezone);
  if (parts.hour !== schedule.hour || parts.minute !== schedule.minute) {
    return false;
  }

  const dateKey = buildDateKey(parts);
  const lockKey = `${BACKUP_LAST_RUN_PREFIX}${dateKey}`;
  const marked = await redis.set(lockKey, '1', 'EX', 60 * 60 * 48, 'NX');
  return Boolean(marked);
}

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
  const jobId = await BackupRepository.createBackupJob(triggerSource, triggeredBy);

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

    await BackupRepository.finishBackupJob(jobId, {
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
    await BackupRepository.finishBackupJob(jobId, {
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
