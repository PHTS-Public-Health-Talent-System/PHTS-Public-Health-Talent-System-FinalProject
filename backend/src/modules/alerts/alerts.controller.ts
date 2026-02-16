import { Request, Response } from "express";
import {
  createPersonnelMovement,
  deletePersonnelMovement,
  listRetirements,
  listPersonnelMovements,
  updatePersonnelMovement,
  createRetirement,
  updateRetirement,
  deleteRetirement,
} from '@/modules/alerts/services/alerts.service.js';

export async function getRetirements(_req: Request, res: Response) {
  const records = await listRetirements();
  res.json({ success: true, data: records });
}

export async function getPersonnelMovements(_req: Request, res: Response) {
  const records = await listPersonnelMovements();
  res.json({ success: true, data: records });
}

export async function postPersonnelMovement(req: Request, res: Response) {
  await createPersonnelMovement(req.body);
  res.json({ success: true });
}

export async function putPersonnelMovement(req: Request, res: Response) {
  const movementId = Number(req.params.id);
  await updatePersonnelMovement(movementId, req.body);
  res.json({ success: true });
}

export async function removePersonnelMovement(req: Request, res: Response) {
  const movementId = Number(req.params.id);
  await deletePersonnelMovement(movementId);
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
  await deleteRetirement(retirementId);
  res.json({ success: true });
}
