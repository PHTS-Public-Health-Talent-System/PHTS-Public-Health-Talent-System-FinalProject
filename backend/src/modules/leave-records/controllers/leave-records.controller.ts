import { Request, Response } from "express";
import * as leaveRecordService from '../services/leave-records.service.js';
import type {
  LeaveRecordListQuery,
  LeavePersonnelListQuery,
  LeaveRecordExtensionBody,
  CreateLeaveRecordBody,
} from '../leave-records.schema.js';
import { handleUploadError } from '@config/upload.js';
import fs from "node:fs";

export const listLeaveRecords = async (req: Request, res: Response) => {
  try {
    const params = req.query as unknown as LeaveRecordListQuery;
    const [rows, total] = await Promise.all([
      leaveRecordService.listLeaveRecords(params),
      leaveRecordService.countLeaveRecords(params),
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
    const rows = await leaveRecordService.listLeavePersonnel(params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getLeaveRecordStats = async (_req: Request, res: Response) => {
  try {
    const stats = await leaveRecordService.getLeaveRecordStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createLeaveRecord = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateLeaveRecordBody;
    const id = await leaveRecordService.createLeaveRecord(payload);
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const upsertLeaveRecordExtension = async (req: Request, res: Response) => {
  try {
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const payload = req.body as LeaveRecordExtensionBody;
    await leaveRecordService.upsertLeaveRecordExtension(payload, actorId);
    res.json({ success: true, message: "Leave record updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeaveRecordDocuments = async (req: Request, res: Response) => {
  try {
    const leaveRecordId = Number(req.params.leaveRecordId);
    const rows = await leaveRecordService.listLeaveRecordDocuments(leaveRecordId);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addLeaveRecordDocuments = async (req: Request, res: Response) => {
  try {
    const leaveRecordId = Number(req.params.leaveRecordId);
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const files = (req.files as Express.Multer.File[]) ?? [];
    const ids = await leaveRecordService.addLeaveRecordDocuments(leaveRecordId, files, actorId);
    res.status(201).json({ success: true, data: { document_ids: ids } });
  } catch (error: any) {
    const message = handleUploadError(error);
    res.status(400).json({ success: false, error: message });
  }
};

export const deleteLeaveRecordDocument = async (req: Request, res: Response) => {
  try {
    const documentId = Number(req.params.documentId);
    const { deleted, filePath } = await leaveRecordService.deleteLeaveRecordDocument(documentId);
    if (deleted && filePath) {
      fs.unlink(filePath, () => undefined);
    }
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteLeaveRecordExtension = async (req: Request, res: Response) => {
  try {
    const leaveRecordId = Number(req.params.leaveRecordId);
    const deleted = await leaveRecordService.deleteLeaveRecordExtension(leaveRecordId);
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
