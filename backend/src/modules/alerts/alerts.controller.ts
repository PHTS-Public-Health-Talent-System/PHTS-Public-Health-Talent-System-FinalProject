import { Request, Response } from "express";
import {
  listRetirements,
  createRetirement,
  updateRetirement,
  deleteRetirement,
} from "./services/alerts.service.js";

export async function getRetirements(_req: Request, res: Response) {
  const records = await listRetirements();
  res.json({ success: true, data: records });
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
