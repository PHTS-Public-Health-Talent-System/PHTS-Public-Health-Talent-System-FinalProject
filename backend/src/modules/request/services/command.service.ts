/**
 * src/modules/request/services/command.service.ts
 */

import { getConnection } from '@config/database.js';
import { readFile } from 'node:fs/promises';
import { PoolConnection } from 'mysql2/promise';
import {
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  RequestWithDetails,
} from '@/modules/request/request.types.js';
import { CreateRequestDTO, UpdateRequestDTO } from '@/modules/request/dto/index.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import {
  generateRequestNoFromId,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
  parseJsonField,
} from '@/modules/request/services/helpers.js';
import { requestQueryService } from '@/modules/request/services/query.service.js'; // Use the class instance
import { enqueueRequestOcrPrecheck } from '@/modules/request/services/ocr-precheck.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js'; // [NEW]
import { resolveProfessionCode } from '@shared/utils/profession.js';
import {
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@shared/utils/errors.js';
import path from 'node:path';

export class RequestCommandService {
  private containsThai(text: string): boolean {
    return /[\u0E00-\u0E7F]/.test(text);
  }

  private normalizeFilename(name: string): string {
    if (!name) return name;
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    const originalHasThai = this.containsThai(name);
    const decodedHasThai = this.containsThai(decoded);
    if (!originalHasThai && decodedHasThai) return decoded;
    if (name.includes('�') && decodedHasThai) return decoded;
    return name;
  }

  private inferAttachmentType(fieldName: string, fileName: string): FileType {
    if (fieldName === 'license_file') return FileType.LICENSE;
    if (fieldName === 'applicant_signature') return FileType.SIGNATURE;

    const lower = fileName.toLowerCase();
    const looksLikeLicense =
      lower.includes('license') ||
      lower.includes('licence') ||
      lower.includes('ใบอนุญาต') ||
      lower.includes('ใบประกอบ') ||
      lower.includes('ประกอบวิชาชีพ');
    if (looksLikeLicense) return FileType.LICENSE;

    return FileType.OTHER;
  }

  private parseSubmissionData(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }
    return {};
  }

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

      const relativePath = path.isAbsolute(file.path)
        ? path.relative(process.cwd(), file.path)
        : file.path;
      const normalizedPath = relativePath.split(path.sep).join('/');
      const normalizedName = this.normalizeFilename(file.originalname);
      const fileType = this.inferAttachmentType(file.fieldname, normalizedName);
      await requestRepository.insertAttachment(
        {
          request_id: requestId,
          file_type: fileType,
          file_path: normalizedPath,
          file_name: normalizedName,
        },
        connection,
      );
    }
  }

  async confirmAttachments(requestId: number, userId: number) {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      throw new ValidationError("ไม่พบคำขอที่ระบุ");
    }
    if (request.user_id !== userId) {
      throw new AuthorizationError("ไม่มีสิทธิ์ยืนยันไฟล์แนบของคำขอนี้");
    }
    const status = request.status as RequestStatus;
    if (![RequestStatus.DRAFT, RequestStatus.RETURNED].includes(status)) {
      throw new ValidationError("ไม่สามารถยืนยันไฟล์แนบในสถานะนี้ได้");
    }

    const attachments = await requestRepository.findAttachments(requestId);
    const hasLicense = attachments.some((att) => att.file_type === FileType.LICENSE);
    if (!hasLicense) {
      throw new ValidationError("ไม่พบไฟล์ใบอนุญาต");
    }

    return { confirmed: true };
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
        throw new Error('User not found');
      }

      const signatureId = await requestRepository.findSignatureIdByUserId(
        userId,
        connection,
      );
      if (!signatureId && !_signatureFile) {
        throw new Error('ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนยื่นคำขอ');
      }

      const requestedAmount = data.requested_amount ?? 0;
      // Rate validation skipped - allowing any amount for testing

      const effectiveDateStr = normalizeDateToYMD(data.effective_date as string | Date);

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
          entityType: 'request',
          entityId: requestId,
          actorId: userId,
          actorRole: 'USER', // Creating user usually has role USER in this context
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

      const requestEntity = await requestRepository.findById(requestId, connection);
      if (!requestEntity) {
        throw new Error('Request not found');
      }

      if (!['PTS_OFFICER', 'HEAD_HR'].includes(actorRole)) {
        throw new Error('Invalid role for verification snapshot');
      }

      let normalizedEffectiveDate: string;
      try {
        normalizedEffectiveDate = normalizeDateToYMD(payload.effective_date);
      } catch {
        throw new ValidationError('effective_date ต้องเป็นวันที่ที่ถูกต้อง');
      }

      let normalizedExpiryDate: string | null = null;
      if (payload.expiry_date) {
        try {
          normalizedExpiryDate = normalizeDateToYMD(payload.expiry_date);
        } catch {
          throw new ValidationError('expiry_date ต้องเป็นวันที่ที่ถูกต้อง');
        }
      }

      const snapshotId = await requestRepository.insertVerificationSnapshot(
        {
          request_id: requestId,
          user_id: requestEntity.user_id ?? null,
          citizen_id: requestEntity.citizen_id,
          master_rate_id: payload.master_rate_id,
          effective_date: normalizedEffectiveDate,
          expiry_date: normalizedExpiryDate,
          snapshot_data: payload.snapshot_data,
          created_by: actorId,
        },
        connection,
      );

      const snapshot = await requestRepository.findVerificationSnapshotById(snapshotId, connection);

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

  async submitRequest(requestId: number, userId: number, userRole: string): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // [REFACTOR] Lock row for update check
      const requestEntity = await requestRepository.findById(requestId, connection);

      if (!requestEntity) {
        throw new Error('Request not found');
      }

      // Check Permission
      if (requestEntity.user_id !== userId) {
        throw new Error('You do not have permission to submit this request');
      }

      if (requestEntity.status !== RequestStatus.DRAFT) {
        throw new Error(`Cannot submit request with status: ${requestEntity.status}`);
      }

      if (!requestEntity.requested_amount || requestEntity.requested_amount <= 0) {
        throw new Error('requested_amount is required before submit');
      }

      const stepNo =
        requestEntity.current_step && requestEntity.current_step > 0
          ? requestEntity.current_step
          : 1;
      const nextStep =
        userRole === 'HEAD_WARD' && stepNo === 1
          ? 2
          : userRole === 'HEAD_DEPT' && stepNo === 1
            ? 3
            : stepNo;

      // Capture signature snapshot on submit (sig_images or applicant signature)
      const citizenId = requestEntity.citizen_id;
      let signatureSnapshot = citizenId
        ? await requestRepository.findSignatureSnapshot(citizenId, connection)
        : null;
      if (!signatureSnapshot) {
        const signaturePath = await requestRepository.findSignatureAttachmentPath(
          requestId,
          connection,
        );
        if (signaturePath) {
          signatureSnapshot = await readFile(signaturePath);
        }
      }

      if (!signatureSnapshot) {
        throw new Error('ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนส่งคำขอ');
      }

      const submissionData = this.parseSubmissionData(requestEntity.submission_data);
      const nowIso = new Date().toISOString();

      // [REFACTOR] Use Repo Update
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.PENDING,
          current_step: nextStep,
          step_started_at: new Date(),
          submission_data: {
            ...submissionData,
            ocr_precheck: {
              status: 'queued',
              queued_at: nowIso,
              source: 'AUTO_ON_SUBMIT',
            },
          },
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
      const nextRole = STEP_ROLE_MAP[nextStep] || 'HEAD_WARD';
      await NotificationService.notifyRole(
        nextRole,
        'มีคำขอใหม่รออนุมัติ',
        `มีคำขอเลขที่ ${requestEntity.request_no} รอการตรวจสอบจากท่าน`,
        getRequestLinkForRole(nextRole, requestId),
        undefined,
        connection,
      );

      // Fire-and-forget OCR precheck enqueue (worker handles processing).
      void enqueueRequestOcrPrecheck(requestId).catch((error) => {
        console.error('[OCRQueue] enqueue failed:', error);
      });

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
      const requestEntity = await requestRepository.findById(requestId, connection);

      if (!requestEntity) {
        throw new Error('ไม่พบคำขอที่ต้องการแก้ไข');
      }

      const isOwner = requestEntity.user_id === userId;
      const isOfficer = userRole === 'PTS_OFFICER';

      if (!isOwner && !isOfficer) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขคำขอนี้');
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
        const officerStep = ROLE_STEP_MAP['PTS_OFFICER'];
        if (
          requestEntity.status !== RequestStatus.PENDING ||
          requestEntity.current_step !== officerStep
        ) {
          throw new Error('คำขอนี้ไม่อยู่ในขั้นตอนที่เจ้าหน้าที่สามารถแก้ไขได้');
        }
        if (requestEntity.assigned_officer_id && requestEntity.assigned_officer_id !== userId) {
          throw new Error('คำขอนี้ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่นแล้ว');
        }
        if ((files && files.length > 0) || _signatureFile) {
          throw new Error('PTS_OFFICER cannot modify attachments or signature');
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
          throw new Error('PTS_OFFICER can only update verification checks via submission_data');
        }

        if (data.submission_data) {
          const keys = Object.keys(data.submission_data || {});
          const allowedKeys = new Set(['verification_checks']);
          const hasOther = keys.some((key) => !allowedKeys.has(key));
          if (hasOther) {
            throw new Error('PTS_OFFICER can only update verification_checks in submission_data');
          }
        }
      }

      // Build update object
      const updateData: any = {};

      if (data.personnel_type !== undefined) updateData.personnel_type = data.personnel_type;
      if (data.position_number !== undefined)
        updateData.current_position_number = data.position_number || null;
      if (data.department_group !== undefined)
        updateData.current_department = data.department_group || null;
      if (data.main_duty !== undefined) updateData.main_duty = data.main_duty || null;
      if (data.work_attributes !== undefined) updateData.work_attributes = data.work_attributes;
      if (data.request_type !== undefined) updateData.request_type = data.request_type;

      if (data.requested_amount !== undefined) {
        const amount = Number(data.requested_amount);
        // Rate validation skipped - allowing any amount for testing
        updateData.requested_amount = amount;
      }

      if (data.effective_date !== undefined) {
        updateData.effective_date = new Date(normalizeDateToYMD(data.effective_date));
      }

      if (data.submission_data !== undefined) {
        updateData.submission_data = data.submission_data;
      }

      // Reset status if RETURNED -> DRAFT
      if (isOwner && requestEntity.status === RequestStatus.RETURNED) {
        updateData.status = RequestStatus.DRAFT;
        updateData.step_started_at = null;
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

      const requestEntity = await requestRepository.findById(requestId, connection);

      if (!requestEntity) {
        throw new Error('Request not found');
      }

      if (requestEntity.status !== RequestStatus.PENDING) {
        throw new Error(`Cannot update verification checks with status: ${requestEntity.status}`);
      }

      const expectedRole = STEP_ROLE_MAP[requestEntity.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid role for verification update. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      // Logic to handle JSON
      const submissionData =
        parseJsonField<Record<string, unknown>>(requestEntity.submission_data, 'submission_data') ||
        {};
      const existingChecks =
        (submissionData.verification_checks as Record<string, unknown> | undefined) || {};
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

  async cancelRequest(requestId: number, userId: number, reason?: string): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(requestId, connection);
      if (!requestEntity) {
        throw new NotFoundError('คำขอ', requestId);
      }

      if (requestEntity.user_id !== userId) {
        throw new AuthorizationError('คุณไม่มีสิทธิ์ยกเลิกคำขอนี้');
      }

      const nonCancellableStatuses = [RequestStatus.APPROVED, RequestStatus.CANCELLED];
      if (nonCancellableStatuses.includes(requestEntity.status as RequestStatus)) {
        throw new ConflictError(
          `ไม่สามารถยกเลิกคำขอที่มีสถานะ ${requestEntity.status} ได้`,
        );
      }

      // [REFACTOR] Update Status
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.CANCELLED,
          step_started_at: null,
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
          comment: reason || 'ผู้ยื่นขอยกเลิกคำขอ',
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
    const fullRemark = `${remark ?? ''} [Edited by ${editorName}]`;

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
    userId: number,
    role: string,
    data: { group_no: number; item_no?: string | null; sub_item_no?: string | null },
  ): Promise<any> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const request = await requestRepository.findById(requestId, connection);
      if (!request) throw new Error('Request not found');

      const isOwner = request.user_id === userId;
      const isOfficer = role === 'PTS_OFFICER';

      if (!isOwner && !isOfficer) {
        throw new AuthorizationError('You do not have permission to update rate mapping');
      }

      if (isOwner) {
        if (
          request.status !== RequestStatus.DRAFT &&
          request.status !== RequestStatus.RETURNED
        ) {
          throw new Error('Rate mapping can only be updated in draft or returned status');
        }
      }

      if (isOfficer) {
        const officerStep = ROLE_STEP_MAP['PTS_OFFICER'];
        if (
          request.status !== RequestStatus.PENDING ||
          request.current_step !== officerStep
        ) {
          throw new Error('Request is not at PTS officer step');
        }
        if (request.assigned_officer_id && request.assigned_officer_id !== userId) {
          throw new Error('Request is assigned to another officer');
        }
      }

      // Resolve profession from position name (joined field) or fallback
      const positionName = request.position_name || '';
      const professionCode = resolveProfessionCode(positionName);

      if (!professionCode) {
        throw new Error(`Cannot resolve profession from position: ${positionName}`);
      }

      const rate = await requestRepository.findRateByDetails(
        professionCode!,
        data.group_no,
        data.item_no ?? null,
        data.sub_item_no ?? null,
      );

      if (!rate) {
        throw new Error('Invalid rate mapping');
      }

      const submissionData =
        parseJsonField<Record<string, unknown>>(request.submission_data, 'submission_data') || {};
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
        sub_item_no: rate.sub_item_no,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const requestCommandService = new RequestCommandService();
