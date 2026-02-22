import { Request, Response } from "express";
import * as leaveManagementService from '../services/leave-management.service.js';
import type {
  LeaveManagementListQuery,
  LeavePersonnelListQuery,
  LeaveManagementExtensionBody,
  CreateLeaveManagementBody,
  ReplaceLeaveReturnEventsBody,
} from '../leave-management.schema.js';
import { handleUploadError } from '@config/upload.js';
import fs from "node:fs";

export const listLeaveManagement = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeavePersonnel = async (req: Request, res: Response) => {
  try {
    const params = req.query as unknown as LeavePersonnelListQuery;
    const rows = await leaveManagementService.listLeavePersonnel(params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getLeaveManagementStats = async (_req: Request, res: Response) => {
  try {
    const stats = await leaveManagementService.getLeaveManagementStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createLeaveManagement = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateLeaveManagementBody;
    const id = await leaveManagementService.createLeaveManagement(payload);
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const upsertLeaveManagementExtension = async (req: Request, res: Response) => {
  try {
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const payload = req.body as LeaveManagementExtensionBody;
    await leaveManagementService.upsertLeaveManagementExtension(payload, actorId);
    res.json({ success: true, message: "Leave record updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeaveManagementDocuments = async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const rows = await leaveManagementService.listLeaveManagementDocuments(leaveManagementId);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addLeaveManagementDocuments = async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const files = (req.files as Express.Multer.File[]) ?? [];
    const ids = await leaveManagementService.addLeaveManagementDocuments(leaveManagementId, files, actorId);
    res.status(201).json({ success: true, data: { document_ids: ids } });
  } catch (error: any) {
    const message = handleUploadError(error);
    res.status(400).json({ success: false, error: message });
  }
};

export const deleteLeaveManagementDocument = async (req: Request, res: Response) => {
  try {
    const documentId = Number(req.params.documentId);
    const { deleted, filePath } = await leaveManagementService.deleteLeaveManagementDocument(documentId);
    if (deleted && filePath) {
      fs.unlink(filePath, () => undefined);
    }
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteLeaveManagementExtension = async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const deleted = await leaveManagementService.deleteLeaveManagementExtension(leaveManagementId);
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeaveReturnReportEvents = async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const rows = await leaveManagementService.listLeaveReturnReportEvents(leaveManagementId);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const replaceLeaveReturnReportEvents = async (req: Request, res: Response) => {
  try {
    const leaveManagementId = Number(req.params.leaveManagementId);
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const payload = req.body as ReplaceLeaveReturnEventsBody;
    await leaveManagementService.replaceLeaveReturnReportEvents(
      leaveManagementId,
      payload,
      actorId,
    );
    res.json({ success: true, message: "Return report events updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
