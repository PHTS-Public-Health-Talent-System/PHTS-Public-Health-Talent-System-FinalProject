/**
 * PHTS System - Request Controller
 * Refactored to Class-based structure
 *
 * Handles HTTP requests for PTS Request module, delegating business logic to services.
 */

import { Request, Response } from "express";
import { ApiResponse } from "../../../types/auth.js";

// Services
import { requestQueryService } from "../services/query.service.js";
import { requestCommandService } from "../services/command.service.js";
import { requestApprovalService } from "../services/approval.service.js";
import * as reassignService from "../reassign/reassign.service.js";
import * as ocrService from "../ocr/ocr.service.js";

import { getUserScopesForDisplay } from "../scope/scope.service.js";
import {
  getAllActiveMasterRates,
} from "../classification/classification.service.js";

import { requestRepository } from "../repositories/request.repository.js";
import {
  cleanupUploadSession,
} from "../helpers/utils.js";

import {
  createRequestSchema,
} from "../dto/create-request.dto.js";

import {
  catchAsync,
  AuthenticationError,
  ValidationError,
} from "../../../shared/utils/errors.js";

export class RequestController {

  // --- READ Operations ---

  getRequestById = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user) throw new AuthenticationError("Unauthorized access");
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) throw new ValidationError("Invalid Request ID");

    const request = await requestQueryService.getRequestById(
      requestId,
      req.user.userId,
      req.user.role
    );

    res.json({ success: true, data: request });
  });

  getMyRequests = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
     if (!req.user) throw new AuthenticationError("Unauthorized access");
     const requests = await requestQueryService.getMyRequests(req.user.userId);
     res.json({ success: true, data: requests });
  });

  getHistory = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const history = await requestQueryService.getApprovalHistory(req.user.userId);
      res.json({ success: true, data: history });
  });

  getPendingApprovals = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const scopeParam = req.query.scope as string | undefined;
      const requests = await requestQueryService.getPendingForApprover(
          req.user.role,
          req.user.userId,
          scopeParam
      );
      res.json({ success: true, data: requests });
  });

  // --- WRITE Operations ---

  createRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");

      const validation = createRequestSchema.safeParse(req);
      if (!validation.success) {
          cleanupUploadSession(req);
          // ZodError 'errors' property is valid for SafeParseError
          throw new ValidationError("Validation failed", { errors: (validation as any).error.format() });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const documentFiles = files?.["files"] || [];
      const licenseFiles = files?.["license_file"] || [];
      const signatureFiles = files?.["applicant_signature"] || [];
      const allFiles = [...documentFiles, ...licenseFiles, ...signatureFiles];
      const signatureFile = signatureFiles[0];

      const requestData = validation.data.body;
      const employeeExists = await requestRepository.findEmployeeExists(req.user.citizenId);
      if (!employeeExists) {
          cleanupUploadSession(req);
          res.status(404).json({ success: false, error: "Employee not found" });
          return;
      }

      const request = await requestCommandService.createRequest(
          req.user.userId,
          requestData,
          allFiles,
          signatureFile
      );

      res.status(201).json({ success: true, data: request, message: "Request created successfully" });
  });

  updateRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const documentFiles = files?.["files"] || [];
      const licenseFiles = files?.["license_file"] || [];
      const signatureFiles = files?.["applicant_signature"] || [];
      const allFiles = [...documentFiles, ...licenseFiles, ...signatureFiles];
      const signatureFile = signatureFiles[0];

      const requestData = req.body;

      const updated = await requestCommandService.updateRequest(
          requestId,
          req.user.userId,
          req.user.role,
          requestData,
          allFiles,
          signatureFile
      );

      res.json({ success: true, data: updated });
  });

  createVerificationSnapshot = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);

      const snapshot = await requestCommandService.createVerificationSnapshot(
        requestId,
        req.user.userId,
        req.user.role,
        req.body,
      );

      res.status(201).json({ success: true, data: snapshot });
    },
  );

  // --- ACTIONS ---

  processAction = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { action, comment } = req.body;

      let result;
      if (action === 'APPROVE') {
          result = await requestApprovalService.approveRequest(requestId, req.user.userId, req.user.role, comment);
      } else if (action === 'REJECT') {
          result = await requestApprovalService.rejectRequest(requestId, req.user.userId, req.user.role, comment);
      } else if (action === 'RETURN') {
          result = await requestApprovalService.returnRequest(requestId, req.user.userId, req.user.role, comment);
      } else {
          throw new ValidationError("Invalid Action");
      }

      res.json({ success: true, data: result });
  });

  approveRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { comment } = req.body;
      const result = await requestApprovalService.approveRequest(requestId, req.user.userId, req.user.role, comment);
      res.json({ success: true, data: result });
  });

  rejectRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { comment } = req.body;
      const result = await requestApprovalService.rejectRequest(requestId, req.user.userId, req.user.role, comment);
      res.json({ success: true, data: result });
  });

  returnRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { comment } = req.body;
      const result = await requestApprovalService.returnRequest(requestId, req.user.userId, req.user.role, comment);
      res.json({ success: true, data: result });
  });

  // --- REASSIGN ---

  reassignRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { target_officer_id, remark } = req.body;

      await reassignService.reassignRequest(requestId, req.user.userId, {
          targetOfficerId: target_officer_id,
          reason: remark
      });

      res.json({ success: true, message: "Request reassigned successfully" });
  });

  getReassignHistory = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      const requestId = parseInt(req.params.id);
      const history = await reassignService.getReassignmentHistory(requestId);
      res.json({ success: true, data: history });
  });

  getAvailableOfficers = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const officers = await reassignService.getAvailableOfficers(req.user.userId);
      res.json({ success: true, data: officers });
  });

  adjustLeaveRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user) throw new AuthenticationError("Unauthorized");
    const requestId = parseInt(req.params.id);
    const { manual_start_date, manual_end_date, manual_duration_days, remark } = req.body;

    // Use user ID and Role as editor identifier
    const editorName = `User ${req.user.userId} (${req.user.role})`;

    await requestCommandService.adjustLeaveRequest(
        requestId,
        manual_start_date,
        manual_end_date,
        manual_duration_days,
        remark,
        editorName
    );

    res.json({ success: true, message: "Leave request adjusted successfully" });
  });

  // --- OCR & ATTACHMENTS ---

  getAttachmentOcr = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const attachmentId = parseInt(req.params.attachmentId);
      if (isNaN(attachmentId)) throw new ValidationError("Invalid Attachment ID");

      const attachment = await requestRepository.findAttachmentById(attachmentId);
      if (!attachment) throw new ValidationError("Attachment not found");

      const request = await requestRepository.findById(attachment.request_id);
      if (!request) throw new ValidationError("Request not found");

      const isOwner = request.user_id === req.user.userId;
      const isPrivileged = req.user.role === "PTS_OFFICER" || req.user.role === "ADMIN";
      if (!isOwner && !isPrivileged) {
        throw new AuthenticationError("Unauthorized access");
      }

      const result = await ocrService.getOcrRecord(attachmentId);
      res.json({ success: true, data: result });
  });

  requestAttachmentOcr = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const attachmentId = parseInt(req.params.attachmentId);
      if (isNaN(attachmentId)) throw new ValidationError("Invalid Attachment ID");

      const attachment = await requestRepository.findAttachmentById(attachmentId);
      if (!attachment) throw new ValidationError("Attachment not found");

      const request = await requestRepository.findById(attachment.request_id);
      if (!request) throw new ValidationError("Request not found");

      const isOwner = request.user_id === req.user.userId;
      const isPrivileged = req.user.role === "PTS_OFFICER" || req.user.role === "ADMIN";
      if (!isOwner && !isPrivileged) {
        throw new AuthenticationError("Unauthorized access");
      }

      const result = await ocrService.requestOcrProcessing(attachmentId);
      res.json({ success: true, data: result });
  });

  confirmAttachments = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) throw new ValidationError("Invalid Request ID");

      const request = await requestQueryService.getRequestById(
        requestId,
        req.user.userId,
        req.user.role,
      );

      const attachments = request.attachments ?? [];
      const targets = attachments.filter(
        (att) => att.file_type && att.file_type !== "SIGNATURE",
      );

      for (const att of targets) {
        await ocrService.requestOcrProcessing(att.attachment_id);
      }

      res.json({
        success: true,
        message: "Attachments confirmed",
        data: { queued: targets.map((t) => t.attachment_id) },
      });
  });

  // --- OTHER ---

  getMasterRates = catchAsync(async (_req: Request, res: Response<ApiResponse>) => {
      const rates = await getAllActiveMasterRates();
      res.json({ success: true, data: rates });
  });


  getPrefill = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user?.citizenId) throw new AuthenticationError("Unauthorized");

      const emp = await requestRepository.findEmployeeProfile(req.user.citizenId);

      if (!emp) {
          res.json({ success: true, data: null });
          return;
      }
      const professionCode = resolveProfessionCode(emp.position_name || "");

      res.json({ success: true, data: { ...emp, profession_code: professionCode } });
  });

  getMyScopes = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user?.userId) throw new AuthenticationError("Unauthorized");
      if (!req.user?.role) throw new AuthenticationError("Unauthorized");

      const scopes = await getUserScopesForDisplay(req.user.userId, req.user.role);
      res.json({ success: true, data: scopes });
  });

  getRecommendedClassification = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
       if (!req.user) throw new AuthenticationError("Unauthorized access");
       const requestId = parseInt(req.params.id);

       // 1. Get OCR Text
       const ocrText = await ocrService.getOcrTextForRequest(requestId);

       if (!ocrText) {
          res.json({ success: true, data: null });
          return;
       }

       // 2. Get Request for Citizen ID
       const request = await requestQueryService.getRequestById(requestId, req.user.userId, req.user.role);

       // 3. Find Recommended Rate
       const { findRecommendedRate } = await import("../classification/classification.service.js");
       const result = await findRecommendedRate((request as any).citizen_id, ocrText);

       if (result) {
         const hintParts = [`กลุ่ม ${result.group_no}`, `ข้อ ${result.item_no}`];
         if (result.sub_item_no) hintParts.push(`ข้อย่อย ${result.sub_item_no}`);

         res.json({
           success: true,
           data: {
             source: "OCR",
             ...result,
             hint_text: `มีแนวโน้มเข้าข่าย${hintParts.join(" ")}`,
           },
         });
         return;
       }

       res.json({ success: true, data: result });
  });

  updateClassification = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { group_no, item_no, sub_item_no } = req.body;

      const result = await requestCommandService.updateClassification(
          requestId,
          req.user.userId,
          req.user.role,
          { group_no, item_no, sub_item_no }
      );

      res.json({ success: true, data: result });
  });

  updateVerificationChecks = catchAsync(async (_req: Request, res: Response<ApiResponse>) => {
     res.json({ success: true, message: "Verified" });
  });

  cancelRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
     const requestId = parseInt(req.params.id);
     await requestCommandService.cancelRequest(requestId, req.user!.userId);
     res.json({ success: true, message: "Cancelled" });
  });

  submitRequest = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
     const requestId = parseInt(req.params.id);
     const result = await requestCommandService.submitRequest(requestId, req.user!.userId);
     res.json({ success: true, message: "Submitted", data: result });
  });

  approveBatch = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
       if (!req.user) throw new AuthenticationError("Unauthorized access");
       const { requestIds, comment } = req.body;
       const result = await requestApprovalService.approveBatch(
         req.user.userId,
         req.user.role,
         { requestIds, comment },
       );
       res.json({ success: true, data: result });
  });
}

// Helper
const resolveProfessionCode = (positionName: string): string | null => {
  const name = positionName.trim();
  if (name.includes("ทันตแพทย์")) return "DENTIST";
  if (name.includes("นายแพทย์") || name.includes("แพทย์")) return "DOCTOR";
  if (name.includes("เภสัชกร")) return "PHARMACIST";
  if (name.includes("พยาบาล")) {
      const excluded = ["ผู้ช่วยพยาบาล", "พนักงานช่วยการพยาบาล", "พนักงานช่วยเหลือคนไข้"];
      if (excluded.some(v => name.startsWith(v))) return null;
      return "NURSE";
  }
  if (name.startsWith("นักเทคนิคการแพทย์")) return "MED_TECH";
  if (name.startsWith("นักรังสีการแพทย์")) return "RAD_TECH";
  if (name.startsWith("นักกายภาพบำบัด") || name.startsWith("นักกายภาพบําบัด")) return "PHYSIO";
  if (name.startsWith("นักกิจกรรมบำบัด") || name.startsWith("นักกิจกรรมบําบัด")) return "OCC_THERAPY";
  if (name.startsWith("นักอาชีวบำบัด") || name.startsWith("นักอาชีวบําบัด")) return "OCC_THERAPY";
  if (name.startsWith("นักจิตวิทยา")) return "CLIN_PSY";
  if (name.startsWith("นักแก้ไขความผิดปกติ")) return "SPEECH_THERAPIST";
  if (name.startsWith("นักวิชาการศึกษาพิเศษ")) return "SPECIAL_EDU";
  if (name.startsWith("นักเทคโนโลยีหัวใจและทรวงอก")) return "CARDIO_TECH";
  return null;
};

export const requestController = new RequestController();
