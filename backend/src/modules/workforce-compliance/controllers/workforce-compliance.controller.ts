/**
 * workforce-compliance module - request orchestration
 *
 */
import { Request, Response } from "express";
import { RetirementsRepository } from '@/modules/workforce-compliance/repositories/retirements.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import {
  createRetirement,
  updateRetirement,
} from "@/modules/workforce-compliance/services/retirement-admin.service.js";

export async function getRetirements(_req: Request, res: Response) {
  const records = await RetirementsRepository.list();
  res.json({ success: true, data: records });
}

export async function getPersonnelMovements(_req: Request, res: Response) {
  const records = await WorkforceComplianceRepository.getPersonnelMovements();
  res.json({ success: true, data: records });
}

export async function postPersonnelMovement(req: Request, res: Response) {
  await WorkforceComplianceRepository.createPersonnelMovement(req.body);
  res.json({ success: true });
}

export async function putPersonnelMovement(req: Request, res: Response) {
  const movementId = Number(req.params.id);
  await WorkforceComplianceRepository.updatePersonnelMovement(movementId, req.body);
  res.json({ success: true });
}

export async function removePersonnelMovement(req: Request, res: Response) {
  const movementId = Number(req.params.id);
  await WorkforceComplianceRepository.deletePersonnelMovement(movementId);
  res.json({ success: true });
}

export async function postRetirement(req: Request, res: Response) {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  const record = await createRetirement(req.body, userId);
  res.json({ success: true, data: record });
}

export async function putRetirement(req: Request, res: Response) {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;
  const retirementId = Number(req.params.id);
  await updateRetirement(retirementId, req.body, userId);
  res.json({ success: true });
}

export async function removeRetirement(req: Request, res: Response) {
  const retirementId = Number(req.params.id);
  await RetirementsRepository.delete(retirementId);
  res.json({ success: true });
}
