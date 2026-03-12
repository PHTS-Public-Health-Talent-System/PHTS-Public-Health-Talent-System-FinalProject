/**
 * workforce-compliance module - request orchestration
 *
 */
import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { RetirementsRepository } from '@/modules/workforce-compliance/repositories/retirements.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import {
  createRetirement,
  updateRetirement,
} from "@/modules/workforce-compliance/services/retirement-admin.service.js";

export const getRetirements = asyncHandler(async (_req: Request, res: Response) => {
  const records = await RetirementsRepository.list();
  res.json({ success: true, data: records });
});

export const getPersonnelMovements = asyncHandler(async (_req: Request, res: Response) => {
  const records = await WorkforceComplianceRepository.getPersonnelMovements();
  res.json({ success: true, data: records });
});

export const postPersonnelMovement = asyncHandler(async (req: Request, res: Response) => {
  await WorkforceComplianceRepository.createPersonnelMovement(req.body);
  res.json({ success: true });
});

export const putPersonnelMovement = asyncHandler(async (req: Request, res: Response) => {
  const movementId = Number(req.params.id);
  await WorkforceComplianceRepository.updatePersonnelMovement(movementId, req.body);
  res.json({ success: true });
});

export const removePersonnelMovement = asyncHandler(async (req: Request, res: Response) => {
  const movementId = Number(req.params.id);
  await WorkforceComplianceRepository.deletePersonnelMovement(movementId);
  res.json({ success: true });
});

export const postRetirement = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  const record = await createRetirement(req.body, userId);
  res.json({ success: true, data: record });
});

export const putRetirement = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  const retirementId = Number(req.params.id);
  await updateRetirement(retirementId, req.body, userId);
  res.json({ success: true });
});

export const removeRetirement = asyncHandler(async (req: Request, res: Response) => {
  const retirementId = Number(req.params.id);
  await RetirementsRepository.delete(retirementId);
  res.json({ success: true });
});
