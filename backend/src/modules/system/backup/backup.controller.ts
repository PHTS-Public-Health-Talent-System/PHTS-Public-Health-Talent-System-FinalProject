import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { BackupRepository } from "@/modules/system/repositories/backup.repository.js";
import { runBackupJob } from "@/modules/system/backup/services/backup.service.js";
import type { BackupHistoryQuery } from "@/modules/system/admin/admin.schema.js";

export const triggerBackup = asyncHandler(async (req: Request, res: Response) => {
  const actorId = req.user?.userId ?? null;
  const result = await runBackupJob({
    triggerSource: "MANUAL",
    triggeredBy: actorId,
  });
  res.json({ success: true, data: result });
});

export const getBackupHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as BackupHistoryQuery;
    const rows = await BackupRepository.getBackupHistory(Number(limit || 20));
    res.json({ success: true, data: rows });
  },
);
