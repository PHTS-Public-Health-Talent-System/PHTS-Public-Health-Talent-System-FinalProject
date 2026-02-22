import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { SyncService } from "@/modules/system/sync/services/sync.service.js";
import type { SyncUserParams } from "@/modules/system/system.schema.js";

export const triggerSync = asyncHandler(async (_req: Request, res: Response) => {
  const result = await SyncService.performFullSync();
  res.json({ success: true, data: result });
});

export const triggerUserSync = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as unknown as SyncUserParams;
    const result = await SyncService.performUserSync(Number(userId));
    res.json({ success: true, data: result });
  },
);
