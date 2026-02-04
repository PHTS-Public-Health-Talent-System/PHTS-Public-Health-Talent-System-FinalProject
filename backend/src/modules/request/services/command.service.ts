/**
 * src/modules/request/services/command.service.ts
 */

import { getConnection } from "../../../config/database.js";
import { readFile } from "node:fs/promises";
import { PoolConnection } from "mysql2/promise";
import {
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  RequestWithDetails,
} from "../request.types.js";
import { CreateRequestDTO, UpdateRequestDTO } from "../dto/index.js";
import { NotificationService } from "../../notification/services/notification.service.js";
import {
  generateRequestNoFromId,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
  parseJsonField,
} from "./helpers.js";
import { requestQueryService } from "./query.service.js"; // Use the class instance
import { emitAuditEvent, AuditEventType } from "../../audit/services/audit.service.js";
import { requestRepository } from "../repositories/request.repository.js"; // [NEW]

export class RequestCommandService {
  // --- Helpers (Internal) ---

  private buildSubmissionDataJson(data: CreateRequestDTO): string | null {
    if (data.submission_data) {
      return JSON.stringify({
        ...data.submission_data,
        main_duty: data.main_duty ?? null,
      });
    }
    if (data.main_duty) {
      return JSON.stringify({ main_duty: data.main_duty });
    }
    return null;
  }

  private async insertAttachments(
    connection: PoolConnection,
    requestId: number,
    files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (!file.path) continue; // Skip files without path (e.g., MemoryStorage signatures)

      let fileType: string = FileType.OTHER;
      if (file.fieldname === "license_file") fileType = FileType.LICENSE;
      if (file.fieldname === "applicant_signature")
        fileType = FileType.SIGNATURE;
      await requestRepository.insertAttachment(
        {
          request_id: requestId,
          file_type: fileType,
          file_path: file.path,
          file_name: file.originalname,
        },
        connection,
      );
    }
  }

  // ============================================================================
  // Create Request (DRAFT)
  // ============================================================================

  async createRequest(
    userId: number,
    data: CreateRequestDTO,
    files?: Express.Multer.File[],
    _signatureFile?: Express.Multer.File,
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const citizenId = await requestRepository.findUserCitizenId(userId);
      if (!citizenId) {
        throw new Error("User not found");
      }

      const signatureId = await requestRepository.findSignatureIdByUserId(
        userId,
        connection,
      );
      if (!signatureId && !_signatureFile) {
        throw new Error("ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนยื่นคำขอ");
      }

      const requestedAmount = data.requested_amount ?? 0;
      // Rate validation skipped - allowing any amount for testing

      const effectiveDateStr = normalizeDateToYMD(
        data.effective_date as string | Date,
      );

      // [REFACTOR] Use Repo Create
      const requestId = await requestRepository.create(
        {
          user_id: userId,
          citizen_id: citizenId,
          personnel_type: data.personnel_type,
          current_position_number: data.position_number || null,
          current_department: data.department_group || null,
          work_attributes: data.work_attributes, // Repo handles JSON.stringify
          applicant_signature_id: signatureId ?? null,
          request_type: data.request_type,
          requested_amount: requestedAmount,
          effective_date: new Date(effectiveDateStr),
          status: RequestStatus.DRAFT,
          current_step: 1,
          submission_data: this.buildSubmissionDataJson(data)
            ? JSON.parse(this.buildSubmissionDataJson(data)!)
            : null,
        },
        connection,
      );

      const requestNo = generateRequestNoFromId(requestId);
      await requestRepository.updateRequestNo(requestId, requestNo, connection);

      await this.insertAttachments(connection, requestId, files);

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_CREATE,
          entityType: "request",
          entityId: requestId,
          actorId: userId,
          actorRole: "USER", // Creating user usually has role USER in this context
          actionDetail: {
            request_no: requestNo,
            personnel_type: data.personnel_type,
            request_type: data.request_type,
            requested_amount: requestedAmount,
            effective_date: effectiveDateStr,
          },
        },
        connection,
      );

      await connection.commit();

      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Verification Snapshot (PTS_OFFICER/HEAD_HR)
  // ============================================================================

  async createVerificationSnapshot(
    requestId: number,
    actorId: number,
    actorRole: string,
    payload: {
      master_rate_id: number;
      effective_date: string;
      expiry_date?: string;
      snapshot_data: Record<string, unknown>;
    },
  ) {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );
      if (!requestEntity) {
        throw new Error("Request not found");
      }

      if (!["PTS_OFFICER", "HEAD_HR"].includes(actorRole)) {
        throw new Error("Invalid role for verification snapshot");
      }

      const snapshotId = await requestRepository.insertVerificationSnapshot(
        {
          request_id: requestId,
          citizen_id: requestEntity.citizen_id,
          master_rate_id: payload.master_rate_id,
          effective_date: payload.effective_date,
          expiry_date: payload.expiry_date ?? null,
          snapshot_data: payload.snapshot_data,
          created_by: actorId,
        },
        connection,
      );

      const snapshot = await requestRepository.findVerificationSnapshotById(
        snapshotId,
        connection,
      );

      await connection.commit();
      return snapshot;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Submit Request
  // ============================================================================

  async submitRequest(requestId: number, userId: number): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // [REFACTOR] Lock row for update check
      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("Request not found");
      }

      // Check Permission
      if (requestEntity.user_id !== userId) {
        throw new Error("You do not have permission to submit this request");
      }

      if (requestEntity.status !== RequestStatus.DRAFT) {
        throw new Error(
          `Cannot submit request with status: ${requestEntity.status}`,
        );
      }

      if (
        !requestEntity.requested_amount ||
        requestEntity.requested_amount <= 0
      ) {
        throw new Error("requested_amount is required before submit");
      }



      const stepNo =
        requestEntity.current_step && requestEntity.current_step > 0
          ? requestEntity.current_step
          : 1;

      // Capture signature snapshot on submit (sig_images or applicant signature)
      let signatureSnapshot = await requestRepository.findSignatureSnapshot(
        userId,
        connection,
      );
      if (!signatureSnapshot) {
        const signaturePath =
          await requestRepository.findSignatureAttachmentPath(
            requestId,
            connection,
          );
        if (signaturePath) {
          signatureSnapshot = await readFile(signaturePath);
        }
      }

      if (!signatureSnapshot) {
        throw new Error("ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนส่งคำขอ");
      }

      // [REFACTOR] Use Repo Update
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.PENDING,
          current_step: stepNo,
        },
        connection,
      );

      // [REFACTOR] Use Repo Insert Approval
      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: userId,
          step_no: stepNo,
          action: ActionType.SUBMIT,
          comment: null,
          signature_snapshot: signatureSnapshot,
        },
        connection,
      );


      await connection.commit();

      // Notification (After commit)
      const nextRole = STEP_ROLE_MAP[stepNo] || "HEAD_WARD";
      await NotificationService.notifyRole(
        nextRole,
        "มีคำขอใหม่รออนุมัติ",
        `มีคำขอเลขที่ ${requestEntity.request_no} รอการตรวจสอบจากท่าน`,
        getRequestLinkForRole(nextRole, requestId),
        connection,
      );

      const updatedEntity = await requestRepository.findById(requestId);
      return mapRequestRow(updatedEntity!) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Update Request (DRAFT or RETURNED only)
  // ============================================================================

  async updateRequest(
    requestId: number,
    userId: number,
    userRole: string,
    data: UpdateRequestDTO,
    files?: Express.Multer.File[],
    _signatureFile?: Express.Multer.File,
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // [REFACTOR] Lock row
      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("ไม่พบคำขอที่ต้องการแก้ไข");
      }

      const isOwner = requestEntity.user_id === userId;
      const isOfficer = userRole === "PTS_OFFICER";

      if (!isOwner && !isOfficer) {
        throw new Error("คุณไม่มีสิทธิ์แก้ไขคำขอนี้");
      }

      if (isOwner) {
        if (
          requestEntity.status !== RequestStatus.DRAFT &&
          requestEntity.status !== RequestStatus.RETURNED
        ) {
          throw new Error(
            `ไม่สามารถแก้ไขคำขอที่มีสถานะ ${requestEntity.status} ได้ (ต้องเป็น DRAFT หรือ RETURNED เท่านั้น)`,
          );
        }
      }

      if (isOfficer) {
        const officerStep = ROLE_STEP_MAP["PTS_OFFICER"];
        if (
          requestEntity.status !== RequestStatus.PENDING ||
          requestEntity.current_step !== officerStep
        ) {
          throw new Error(
            "คำขอนี้ไม่อยู่ในขั้นตอนที่เจ้าหน้าที่สามารถแก้ไขได้",
          );
        }
        if (
          requestEntity.assigned_officer_id &&
          requestEntity.assigned_officer_id !== userId
        ) {
          throw new Error("คำขอนี้ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่นแล้ว");
        }
        if ((files && files.length > 0) || _signatureFile) {
          throw new Error("PTS_OFFICER cannot modify attachments or signature");
        }

        const hasDisallowedFields =
          data.personnel_type !== undefined ||
          data.position_number !== undefined ||
          data.department_group !== undefined ||
          data.main_duty !== undefined ||
          data.work_attributes !== undefined ||
          data.request_type !== undefined ||
          data.requested_amount !== undefined ||
          data.effective_date !== undefined ||
          data.reason !== undefined;

        if (hasDisallowedFields) {
          throw new Error(
            "PTS_OFFICER can only update verification checks via submission_data",
          );
        }

        if (data.submission_data) {
          const keys = Object.keys(data.submission_data || {});
          const allowedKeys = new Set(["verification_checks"]);
          const hasOther = keys.some((key) => !allowedKeys.has(key));
          if (hasOther) {
            throw new Error(
              "PTS_OFFICER can only update verification_checks in submission_data",
            );
          }
        }
      }

      // Build update object
      const updateData: any = {};

      if (data.personnel_type !== undefined)
        updateData.personnel_type = data.personnel_type;
      if (data.position_number !== undefined)
        updateData.current_position_number = data.position_number || null;
      if (data.department_group !== undefined)
        updateData.current_department = data.department_group || null;
      if (data.main_duty !== undefined)
        updateData.main_duty = data.main_duty || null;
      if (data.work_attributes !== undefined)
        updateData.work_attributes = data.work_attributes;
      if (data.request_type !== undefined)
        updateData.request_type = data.request_type;

      if (data.requested_amount !== undefined) {
        const amount = Number(data.requested_amount);
        // Rate validation skipped - allowing any amount for testing
        updateData.requested_amount = amount;
      }

      if (data.effective_date !== undefined) {
        updateData.effective_date = new Date(
          normalizeDateToYMD(data.effective_date),
        );
      }

      if (data.submission_data !== undefined) {
        updateData.submission_data = data.submission_data;
      }

      // Reset status if RETURNED -> DRAFT
      if (isOwner && requestEntity.status === RequestStatus.RETURNED) {
        updateData.status = RequestStatus.DRAFT;
      }

      // [REFACTOR] Use Repo Update
      if (Object.keys(updateData).length > 0) {
        await requestRepository.update(requestId, updateData, connection);
      }

      // Insert new files
      await this.insertAttachments(connection, requestId, files);

      await connection.commit();
      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Update Verification Checks
  // ============================================================================

  async updateVerificationChecks(
    requestId: number,
    actorId: number,
    actorRole: string,
    checks: any, // Typed specifically in real code
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("Request not found");
      }

      if (requestEntity.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot update verification checks with status: ${requestEntity.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[requestEntity.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid role for verification update. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      // Logic to handle JSON
      const submissionData =
        parseJsonField<Record<string, unknown>>(
          requestEntity.submission_data,
          "submission_data",
        ) || {};
      const existingChecks =
        (submissionData.verification_checks as
          | Record<string, unknown>
          | undefined) || {};
      const nextChecks: Record<string, unknown> = { ...existingChecks };

      const buildCheck = (input: any) => ({
        ...input,
        updated_by: actorId,
        updated_role: actorRole,
        updated_at: new Date().toISOString(),
      });

      if (checks.qualification_check) {
        nextChecks.qualification_check = buildCheck(checks.qualification_check);
      }
      if (checks.evidence_check) {
        nextChecks.evidence_check = buildCheck(checks.evidence_check);
      }

      const nextSubmissionData = {
        ...submissionData,
        verification_checks: nextChecks,
      };

      // [REFACTOR] Repo Update
      await requestRepository.update(
        requestId,
        {
          submission_data: nextSubmissionData,
        },
        connection,
      );

      await connection.commit();
      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Cancel Request
  // ============================================================================

  async cancelRequest(
    requestId: number,
    userId: number,
    reason?: string,
  ): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );
      if (!requestEntity) {
        throw new Error("ไม่พบคำขอที่ต้องการยกเลิก");
      }

      if (requestEntity.user_id !== userId) {
        throw new Error("คุณไม่มีสิทธิ์ยกเลิกคำขอนี้");
      }

      const nonCancellableStatuses = [
        RequestStatus.APPROVED,
        RequestStatus.CANCELLED,
      ];
      if (
        nonCancellableStatuses.includes(requestEntity.status as RequestStatus)
      ) {
        throw new Error(
          `ไม่สามารถยกเลิกคำขอที่มีสถานะ ${requestEntity.status} ได้`,
        );
      }

      // [REFACTOR] Update Status
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.CANCELLED,
        },
        connection,
      );

      // [REFACTOR] Record Action
      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: userId,
          step_no: requestEntity.current_step || 0,
          action: ActionType.CANCEL,
          comment: reason || "ผู้ยื่นขอยกเลิกคำขอ",
          signature_snapshot: null,
        },
        connection,
      );

      await connection.commit();

      const updatedEntity = await requestRepository.findById(requestId);
      return mapRequestRow(updatedEntity!) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Data Correction (Admin/Officer Only)
  // ============================================================================

  async adjustLeaveRequest(
    id: number,
    manual_start_date: string,
    manual_end_date: string,
    manual_duration_days: number,
    remark: string,
    editorName: string,
  ): Promise<void> {
    const fullRemark = `${remark ?? ""} [Edited by ${editorName}]`;

    // [REFACTOR] Use Repo
    await requestRepository.updateLeaveAdjustment(id, {
      manual_start_date,
      manual_end_date,
      manual_duration_days,
      remark: fullRemark,
    });
  }

  // ============================================================================
  // Update Rate Mapping
  // ============================================================================

  async updateRateMapping(
    requestId: number,
    _userId: number,
    _role: string,
    data: { group_no: number; item_no?: string | null; sub_item_no?: string | null },
  ): Promise<any> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const request = await requestRepository.findById(requestId, connection);
      if (!request) throw new Error("Request not found");

      if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.DRAFT) {
        throw new Error("Cannot update rate mapping of processed request");
      }

      // Resolve profession from position name (joined field) or fallback
      const positionName = request.position_name || "";
      let professionCode = this.resolveProfessionCode(positionName);

      console.log(`[DEBUG_RATE] RequestId=${requestId}`);
      console.log(`[DEBUG_RATE] Position="${positionName}"`);
      console.log(`[DEBUG_RATE] ResolvedCode="${professionCode}"`);
      console.log(`[DEBUG_RATE] Params: Group=${data.group_no}, Item=${data.item_no}, Sub=${data.sub_item_no}`);

      if (!professionCode) {
         throw new Error(
           `Cannot resolve profession from position: ${positionName}`,
         );
      }

      const rate = await requestRepository.findRateByDetails(
        professionCode!,
        data.group_no,
        data.item_no ?? null,
        data.sub_item_no ?? null,
      );

      if (!rate) {
        throw new Error("Invalid rate mapping");
      }

      const submissionData =
        parseJsonField<Record<string, unknown>>(
          request.submission_data,
          "submission_data",
        ) || {};
      const existingRateMapping =
        (submissionData as any).rate_mapping || (submissionData as any).classification;
      const nextSubmissionData = {
        ...submissionData,
        rate_mapping: {
          ...(existingRateMapping || {}),
          group_no: rate.group_no,
          item_no: rate.item_no,
          sub_item_no: rate.sub_item_no ?? null,
          rate_id: rate.rate_id,
          amount: rate.amount,
          profession_code: professionCode,
        },
      };

      await requestRepository.update(
        requestId,
        { requested_amount: rate.amount, submission_data: nextSubmissionData },
        connection,
      );

      await connection.commit();

      // Return merged data
      return {
        request_id: requestId,
        rate_id: rate.rate_id,
        amount: rate.amount,
        group_no: rate.group_no,
        item_no: rate.item_no,
        sub_item_no: rate.sub_item_no
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private resolveProfessionCode(positionName: string): string | null {
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
  }
}

export const requestCommandService = new RequestCommandService();
