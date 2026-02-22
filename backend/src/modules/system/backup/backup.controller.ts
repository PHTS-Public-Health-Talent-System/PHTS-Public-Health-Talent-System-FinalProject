import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { SystemRepository } from "@/modules/system/repositories/system.repository.js";
import { runBackupJob } from "@/modules/system/backup/services/backup.service.js";
import type { BackupHistoryQuery } from "@/modules/system/system.schema.js";

export const triggerBackup = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.userId ?? (req as any).user?.id ?? null;
  const result = await runBackupJob({
    triggerSource: "MANUAL",
    triggeredBy: actorId,
  });
  res.json({ success: true, data: result });
});

export const getBackupHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as BackupHistoryQuery;
    const rows = await SystemRepository.getBackupHistory(Number(limit || 20));
    res.json({ success: true, data: rows });
  },
);
