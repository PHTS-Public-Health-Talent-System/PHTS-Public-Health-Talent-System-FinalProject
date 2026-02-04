/**
 * src/modules/request/services/query.service.ts
 */
import {
  RequestStatus,
  RequestAttachment,
  RequestWithDetails,
  ROLE_STEP_MAP,
  RequestActionWithActor,
} from "../request.types.js";
import { mapRequestRow, hydrateRequests } from "./helpers.js";
import {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
} from "../scope/scope.service.js";
import { requestRepository } from "../repositories/request.repository.js"; // [NEW]

// ============================================================================
// User's Requests
// ============================================================================

export class RequestQueryService {
  async getMyRequests(userId: number): Promise<RequestWithDetails[]> {
    // Use Repo instead of raw SQL
    const requestRows = await requestRepository.findByUserId(userId);
    // Need to cast or map entity to what hydrateRequests expects if types differ slightly
    return await hydrateRequests(requestRows as any[]);
  }

  // ============================================================================
  // Pending Requests for Approver
  // ============================================================================

  async getPendingForApprover(
    userRole: string,
    userId?: number,
    selectedScope?: string,
  ): Promise<RequestWithDetails[]> {
    const stepNo = ROLE_STEP_MAP[userRole as keyof typeof ROLE_STEP_MAP];

    if (!stepNo) {
      throw new Error(`Invalid approver role: ${userRole}`);
    }

    if (userRole === "PTS_OFFICER") {
      if (userId === undefined || userId === null) {
        throw new Error("User ID is required for PTS_OFFICER");
      }
      const requestRows =
        await requestRepository.findPendingByStepForOfficer(stepNo, userId);
      return await hydrateRequests(requestRows as any[]);
    }

    let extraWhere = "";
    const extraParams: any[] = [];

    // Apply scope filter for HEAD_WARD and HEAD_DEPT
    if (
      userId !== undefined &&
      userId !== null &&
      (userRole === "HEAD_WARD" || userRole === "HEAD_DEPT")
    ) {
      const scopeFilter = selectedScope
        ? await getScopeFilterForSelectedScope(userId, userRole, selectedScope)
        : await getScopeFilterForApprover(userId, userRole);

      if (scopeFilter) {
        // Remove leading " AND " from scopeFilter logic
        const clause = scopeFilter.whereClause.replace(/^ AND /, "");
        extraWhere += ` AND (${clause} OR r.user_id = ?)`;
        extraParams.push(...scopeFilter.params, userId);
      } else {
        extraWhere += " AND r.user_id = ?";
        extraParams.push(userId);
      }
    }

    const requestRows = await requestRepository.findPendingByStep(
      stepNo,
      userId,
      extraWhere,
      extraParams,
    );
    return await hydrateRequests(requestRows as any[]);
  }

  // ============================================================================
  // Approval History
  // ============================================================================

  async getApprovalHistory(actorId: number): Promise<RequestWithDetails[]> {
    const historyIds = await requestRepository.findApprovalHistoryIds(actorId);

    if (historyIds.length === 0) return [];

    const requestIds = historyIds.map((row) => row.request_id);
    const fullRequests = await requestRepository.findByIds(requestIds);

    return await hydrateRequests(fullRequests as any[]);
  }

  // ============================================================================
  // Get Request by ID (with Access Control)
  // ============================================================================

  async getRequestById(
    requestId: number,
    userId: number,
    userRole: string,
  ): Promise<RequestWithDetails> {
    const request = await requestRepository.findById(requestId); // Simple find

    if (!request) {
      throw new Error("Request not found");
    }

    const isOwner = request.user_id === userId;
    const isAdmin = userRole === "ADMIN";

    // Check if user is approver at the current step
    let isApprover =
      ROLE_STEP_MAP[userRole as keyof typeof ROLE_STEP_MAP] !== undefined &&
      request.status === RequestStatus.PENDING &&
      request.current_step ===
        ROLE_STEP_MAP[userRole as keyof typeof ROLE_STEP_MAP];

    let hasScopeAccess = false;
    // For HEAD_WARD and HEAD_DEPT, also verify scope access
    if (userRole === "HEAD_WARD" || userRole === "HEAD_DEPT") {
      const reqAny = request as any;
      hasScopeAccess = await canApproverAccessRequest(
        userId,
        userRole,
        reqAny.emp_department || request.current_department || "",
        reqAny.emp_sub_department || "",
      );
      if (!hasScopeAccess) {
        isApprover = false;
      }
    }

    // Allow HEAD_WARD/HEAD_DEPT to view within their scope even if not current step
    const canViewByScope =
      (userRole === "HEAD_WARD" || userRole === "HEAD_DEPT") && hasScopeAccess;

    if (canViewByScope) {
      isApprover = true;
    }

    if (!isOwner && !isApprover && !isAdmin) {
      // Check if actor by fetching approvals
      const approvals =
        await requestRepository.findApprovalsWithActor(requestId);
      const isActor = approvals.some((a) => a.actor_id === userId);

      if (!isActor) {
        throw new Error("You do not have permission to view this request");
      }
    }

    const details = await this.getRequestDetails(requestId);

    const reqAny = request as any;
    details.requester = {
      citizen_id: reqAny.citizen_id,
      role: "USER",
      first_name: reqAny.first_name,
      last_name: reqAny.last_name,
      position: reqAny.position_name,
    };

    return details;
  }

  // ============================================================================
  // Get Request Details (Internal)
  // ============================================================================

  async getRequestDetails(requestId: number): Promise<RequestWithDetails> {
    const request = await requestRepository.findById(requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    const attachments =
      await requestRepository.findAttachmentsWithMetadata(requestId);
    const actions = await requestRepository.findApprovalsWithActor(requestId);

    const actionsWithActor: RequestActionWithActor[] = actions.map(
      (action) => ({
        action_id: action.action_id,
        request_id: action.request_id,
        actor_id: action.actor_id,
        action: action.action,
        step_no: action.step_no,
        from_step: action.step_no,
        to_step: action.step_no,
        comment: action.comment,
        action_date: action.created_at,
        created_at: action.created_at,
        actor: {
          citizen_id: action.actor_citizen_id,
          role: action.actor_role,
          first_name: action.actor_first_name,
          last_name: action.actor_last_name,
        },
      }),
    );

    // Map Entity to Domain Object using helper
    const mappedRequest = mapRequestRow(request);

    return {
      ...mappedRequest,
      attachments: attachments.map((att) => ({
        attachment_id: att.attachment_id,
        request_id: att.request_id,
        file_type: att.file_type,
        file_path: att.file_path,
        file_name: att.file_name,
        original_filename: att.file_name,
        file_size: att.file_size,
        mime_type: att.mime_type,
        uploaded_at: att.uploaded_at,
      })) as RequestAttachment[],
      actions: actionsWithActor,
    };
  }
}

export const requestQueryService = new RequestQueryService();
