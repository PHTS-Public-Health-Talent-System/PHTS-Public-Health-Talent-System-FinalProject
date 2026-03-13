import { Request, Response } from "express";
import multer from "multer";
import * as leaveManagementService from '../services/leave-management.service.js';
import type {
  LeaveManagementListQuery,
  LeavePersonnelListQuery,
  LeaveManagementExtensionBody,
  CreateLeaveManagementBody,
  ReplaceLeaveReturnEventsBody,
} from '../leave-management.schema.js';
import { handleUploadError } from '@config/upload.js';
import { asyncHandler } from "@middlewares/errorHandler.js";
import { ValidationError } from "@shared/utils/errors.js";

export const listLeaveManagement = asyncHandler(async (req: Request, res: Response) => {
  const params = req.query as unknown as LeaveManagementListQuery;
  const [rows, total] = await Promise.all([
    leaveManagementService.listLeaveManagement(params),
    leaveManagementService.countLeaveManagement(params),
  ]);
  res.json({
    success: true,
    data: rows,
    meta: {
      total,
      limit: params.limit ?? null,
      offset: params.offset ?? 0,
    },
  });
});

export const listLeavePersonnel = asyncHandler(async (req: Request, res: Response) => {
  const params = req.query as unknown as LeavePersonnelListQuery;
  const rows = await leaveManagementService.listLeavePersonnel(params);
  res.json({ success: true, data: rows });
});

export const getLeaveManagementStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await leaveManagementService.getLeaveManagementStats();
  res.json({ success: true, data: stats });
});

export const createLeaveManagement = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as CreateLeaveManagementBody;
  const id = await leaveManagementService.createLeaveManagement(payload);
  res.status(201).json({ success: true, data: { id } });
});

export const upsertLeaveManagementExtension = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
  const payload = req.body as LeaveManagementExtensionBody;
  await leaveManagementService.upsertLeaveManagementExtension(payload, actorId);
  res.json({ success: true, message: "Leave record updated" });
});

export const listLeaveManagementDocuments = asyncHandler(async (req: Request, res: Response) => {
  const leaveManagementId = Number(req.params.leaveManagementId);
  const rows = await leaveManagementService.listLeaveManagementDocuments(leaveManagementId);
  res.json({ success: true, data: rows });
});

export const getLeaveManagementQuotaStatus = asyncHandler(async (req: Request, res: Response) => {
  const leaveManagementId = Number(req.params.leaveManagementId);
  const data = await leaveManagementService.getLeaveManagementQuotaStatus(leaveManagementId);
  res.json({ success: true, data });
});

export const addLeaveManagementDocuments = asyncHandler(async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const files = (req.files as Express.Multer.File[]) ?? [];
    const ids = await leaveManagementService.addLeaveManagementDocuments(leaveManagementId, files, actorId);
    res.status(201).json({ success: true, data: { document_ids: ids } });
  } catch (error: any) {
    if (error instanceof multer.MulterError || error?.message?.includes("Invalid file type")) {
      const message = handleUploadError(error);
      throw new ValidationError(message);
    }
    throw error;
  }
});

export const deleteLeaveManagementDocument = asyncHandler(async (req: Request, res: Response) => {
  const documentId = Number(req.params.documentId);
  const { deleted } = await leaveManagementService.deleteLeaveManagementDocument(documentId);
  res.json({ success: true, data: { deleted } });
});

export const deleteLeaveManagementExtension = asyncHandler(async (req: Request, res: Response) => {
  const leaveManagementId = Number(req.params.leaveManagementId);
  const deleted = await leaveManagementService.deleteLeaveManagementExtension(leaveManagementId);
  res.json({ success: true, data: { deleted } });
});

export const listLeaveReturnReportEvents = asyncHandler(async (req: Request, res: Response) => {
  const leaveManagementId = Number(req.params.leaveManagementId);
  const rows = await leaveManagementService.listLeaveReturnReportEvents(leaveManagementId);
  res.json({ success: true, data: rows });
});

export const replaceLeaveReturnReportEvents = asyncHandler(async (req: Request, res: Response) => {
  const leaveManagementId = Number(req.params.leaveManagementId);
  const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
  const payload = req.body as ReplaceLeaveReturnEventsBody;
  await leaveManagementService.replaceLeaveReturnReportEvents(
    leaveManagementId,
    payload,
    actorId,
  );
  res.json({ success: true, message: "Return report events updated" });
});
