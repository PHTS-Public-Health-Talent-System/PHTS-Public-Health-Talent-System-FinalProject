/**
 * Request Module - Approval Service
 *
 * Approval workflow operations: approve, reject, return, batch approve
 */
import { PoolConnection } from "mysql2/promise";
import { getConnection } from '@config/database.js';
import {
  RequestStatus,
  ActionType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
} from '@/modules/request/request.types.js';
import { BatchApproveParams, BatchApproveResult } from '@/modules/request/dto/index.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import {
  mapRequestRow,
  normalizeDateToYMD,
  getRequestLinkForRole,
} from '@/modules/request/services/helpers.js';
import {
  canApproverAccessRequest,
  isRequestOwner,
} from '@/modules/request/scope/scope.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';

// ============================================================================
// Finalization
// ============================================================================

const finalizeRequest = async (
  requestId: number,
  _actorId: number,
  connection: PoolConnection,
) => {
  const request = await requestRepository.findById(requestId, connection);
  if (!request) throw new Error("Request not found during finalization");

  const citizenId = request.citizen_id;
  const amount = request.requested_amount;

  if (!amount || amount <= 0) return;
  if (!request.effective_date) {
    throw new Error("effective_date is required for finalization");
  }

  const effectiveDateStr = normalizeDateToYMD(
    request.effective_date as string | Date,
  );

  // 1. Try rate from submission_data
  let rateId = request.submission_data?.rate_id;

  // 2. Fallback: match by amount + profession
  if (!rateId) {
      let profession = request.personnel_type;
      const positionName = (request as any).position_name;
      if (positionName && typeof positionName === "string") {
        if (positionName.includes("ทันต")) profession = "DENTIST";
        else if (positionName.includes("แพทย์")) profession = "DOCTOR";
        else if (positionName.includes("เภสัช")) profession = "PHARMACIST";
      }

      rateId = await requestRepository.findMatchingRateId(
        amount,
        profession,
        connection,
      );
  }

  if (!rateId) {
    console.warn(
      `[finalizeRequest] No matching rate found for Request ${requestId}`,
    );
    return;
  }

  // Create Eligibility (Deactivate old, Insert new)
  await requestRepository.deactivateEligibility(
    request.user_id ?? null,
    citizenId,
    effectiveDateStr,
    connection,
  );

  await requestRepository.insertEligibility(
    request.user_id ?? null,
    citizenId,
    rateId,
    requestId,
    effectiveDateStr,
    connection,
  );
};

// ============================================================================
// Approval Service Class
// ============================================================================

export class RequestApprovalService {
  // ============================================================================
  // Approve Request
  // ============================================================================

  async approveRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment?: string,
    signatureSnapshot?: Buffer | null,
  ): Promise<PTSRequest> {
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

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot approve request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      const isSelfApproval = await isRequestOwner(actorId, request.user_id);

      if (actorRole === "HEAD_WARD" || actorRole === "HEAD_DEPT") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          actorRole,
          empDepartment,
          empSubDepartment,
        );

        if (!hasScope && !isSelfApproval) {
          throw new Error(
            "You do not have scope access to approve this request",
          );
        }

        if (isSelfApproval) {
          throw new Error("Self-approval is not allowed");
        }
      }

      const actorCitizenId =
        (await requestRepository.findCitizenIdByUserId(actorId)) ??
        (await requestRepository.findUserCitizenId(actorId));

      const signatureFromStore =
        signatureSnapshot ??
        (actorCitizenId
          ? await requestRepository.findSignatureSnapshot(
              actorCitizenId,
              connection,
            )
          : null);
      if (!signatureFromStore) {
        throw new Error(
          "Approver signature is required. Please set your signature before approving.",
        );
      }

      await this.performApproval(
        connection,
        request,
        requestId,
        actorId,
        comment || null,
        signatureFromStore,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_APPROVE,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: actorRole,
          actionDetail: {
            request_no: request.request_no,
            step: request.current_step,
            comment: comment || null,
          },
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
  // Reject Request
  // ============================================================================

  async rejectRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment: string,
  ): Promise<PTSRequest> {
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

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot reject request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      if (actorRole === "HEAD_WARD" || actorRole === "HEAD_DEPT") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          actorRole,
          empDepartment,
          empSubDepartment,
        );
        if (!hasScope) {
          throw new Error(
            "You do not have scope access to reject this request",
          );
        }
      }

      if (!comment || comment.trim() === "") {
        throw new Error("Rejection reason is required");
      }

      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: actorId,
          step_no: request.current_step,
          action: ActionType.REJECT,
          comment: comment,
          signature_snapshot: null,
        },
        connection,
      );

      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.REJECTED,
          step_started_at: null,
        },
        connection,
      );

      await NotificationService.notifyUser(
        request.user_id,
        "คำขอถูกปฏิเสธ",
        `คำขอเลขที่ ${request.request_no} ถูกปฏิเสธ: ${comment}`,
        `/dashboard/user/requests/${requestId}`,
        "APPROVAL",
        connection,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_REJECT,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: actorRole,
          actionDetail: {
            request_no: request.request_no,
            step: request.current_step,
            comment: comment,
          },
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
  // Return Request
  // ============================================================================

  async returnRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment: string,
  ): Promise<PTSRequest> {
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

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot return request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      if (actorRole === "HEAD_WARD" || actorRole === "HEAD_DEPT") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          actorRole,
          empDepartment,
          empSubDepartment,
        );
        if (!hasScope) {
          throw new Error(
            "You do not have scope access to return this request",
          );
        }
      }

      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: actorId,
          step_no: request.current_step,
          action: ActionType.RETURN,
          comment: comment || null,
          signature_snapshot: null,
        },
        connection,
      );

      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.RETURNED,
          step_started_at: null,
        },
        connection,
      );

      await NotificationService.notifyUser(
        request.user_id,
        "คำขอถูกส่งคืน",
        `คำขอเลขที่ ${request.request_no} ถูกส่งคืนแก้ไข: ${comment}`,
        `/dashboard/user/requests/${requestId}`,
        "APPROVAL",
        connection,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_RETURN,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: actorRole,
          actionDetail: {
            request_no: request.request_no,
            step: request.current_step,
            comment: comment,
          },
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
  // Batch Approve (DIRECTOR)
  // ============================================================================

  async approveBatch(
    actorId: number,
    actorRole: string,
    params: BatchApproveParams,
  ): Promise<BatchApproveResult> {
    const { requestIds, comment } = params;
    const result: BatchApproveResult = { success: [], failed: [] };

    const expectedStep =
      ROLE_STEP_MAP[actorRole as keyof typeof ROLE_STEP_MAP];
    const allowedSteps =
      actorRole === "DIRECTOR"
        ? [5, 6]
        : expectedStep !== undefined
          ? [expectedStep]
          : [];

    if (
      allowedSteps.length === 0 ||
      !allowedSteps.some((s) => s === 5 || s === 6)
    ) {
      throw new Error(`Batch approval not supported for role: ${actorRole}`);
    }

    const connection = await getConnection();

    try {
      const actorCitizenId =
        (await requestRepository.findCitizenIdByUserId(actorId)) ??
        (await requestRepository.findUserCitizenId(actorId));
      const signatureSnapshot = actorCitizenId
        ? await requestRepository.findSignatureSnapshot(
            actorCitizenId,
            connection,
          )
        : null;

      if (!signatureSnapshot) {
        throw new Error(
          "Approver signature is required. Please set your signature before approving.",
        );
      }

      for (const requestId of requestIds) {
        try {
          await connection.beginTransaction();

          const requestEntity = await requestRepository.findById(
            requestId,
            connection,
          );

          if (!requestEntity) {
            await connection.rollback();
            result.failed.push({ id: requestId, reason: "Request not found" });
            continue;
          }

          const request = mapRequestRow(requestEntity);

          if (!allowedSteps.includes(request.current_step)) {
            await connection.rollback();
            result.failed.push({
              id: requestId,
              reason: `Not at allowed step (${allowedSteps.join("/")}) (currently at Step ${request.current_step})`,
            });
            continue;
          }

          if (request.status !== RequestStatus.PENDING) {
            await connection.rollback();
            result.failed.push({
              id: requestId,
              reason: `Status is ${request.status}, not PENDING`,
            });
            continue;
          }

          await this.performApproval(
            connection,
            request,
            requestId,
            actorId,
            comment || null,
            signatureSnapshot,
          );

          await emitAuditEvent(
            {
              eventType: AuditEventType.REQUEST_APPROVE,
              entityType: "request",
              entityId: requestId,
              actorId: actorId,
              actorRole: actorRole,
              actionDetail: {
                request_no: request.request_no,
                step: request.current_step,
                comment: comment || null,
                batch: true,
              },
            },
            connection,
          );

          await connection.commit();
          result.success.push(requestId);
        } catch (err) {
          await connection.rollback();
          console.error("Error processing request in batch", {
            requestId,
            error: err instanceof Error ? err.message : err,
          });
          result.failed.push({
            id: requestId,
            reason: "Database error or Finalization failed",
          });
        }
      }

      return result;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Internal: Perform Approval
  // ============================================================================

  async performApproval(
    connection: PoolConnection,
    request: PTSRequest,
    requestId: number,
    actorId: number,
    comment: string | null,
    signatureSnapshot: Buffer,
  ): Promise<void> {
    const currentStep = request.current_step;
    const nextStep = currentStep + 1;

    await requestRepository.insertApproval(
      {
        request_id: requestId,
        actor_id: actorId,
        step_no: currentStep,
        action: ActionType.APPROVE,
        comment: comment,
        signature_snapshot: signatureSnapshot,
      },
      connection,
    );

    if (nextStep > 6) {
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.APPROVED,
          current_step: 7,
          step_started_at: null,
        },
        connection,
      );

      await finalizeRequest(requestId, actorId, connection);

      await NotificationService.notifyUser(
        request.user_id,
        "คำขออนุมัติแล้ว",
        `คำขอเลขที่ ${request.request_no} ได้รับการอนุมัติครบทุกขั้นตอนแล้ว`,
        `/dashboard/user/requests/${requestId}`,
        "APPROVAL",
        connection,
      );
    } else {
      await requestRepository.update(
        requestId,
        {
          current_step: nextStep,
          step_started_at: new Date(),
        },
        connection,
      );

      const nextRole = STEP_ROLE_MAP[nextStep];
      if (nextRole === "PTS_OFFICER") {
        try {
          const officerCount = await requestRepository.countActiveOfficers();
          if (officerCount > 0) {
            const officerId = await requestRepository.findLeastLoadedOfficer();
            if (officerId) {
              await requestRepository.updateAssignedOfficer(
                requestId,
                officerId,
                connection,
              );
            }
          }
        } catch (err) {
          console.error("[Approval] Auto-assign PTS_OFFICER failed:", err);
        }
      }
      if (nextRole) {
        await NotificationService.notifyRole(
          nextRole,
          "งานรออนุมัติ",
          `มีคำขอเลขที่ ${request.request_no} ส่งต่อมาถึงท่าน`,
          getRequestLinkForRole(nextRole, requestId),
          undefined,
          connection,
        );
      }
    }
  }
}

export const requestApprovalService = new RequestApprovalService();
