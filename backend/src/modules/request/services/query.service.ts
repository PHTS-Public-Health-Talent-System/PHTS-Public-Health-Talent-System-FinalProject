/**
 * src/modules/request/services/query.service.ts
 */
import {
  RequestStatus,
  RequestAttachment,
  RequestWithDetails,
  ROLE_STEP_MAP,
  RequestActionWithActor,
} from '@/modules/request/request.types.js';
import { mapRequestRow, hydrateRequests } from '@/modules/request/services/helpers.js';
import {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
  getApproverScopes,
} from '@/modules/request/scope/scope.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js'; // [NEW]

// ============================================================================
// User's Requests
// ============================================================================

export class RequestQueryService {
  async getEligibilityList(
    activeOnly: boolean = true,
  ): Promise<Record<string, unknown>[]> {
    return requestRepository.findEligibilityList(activeOnly);
  }

  async getEligibilitySummary(
    activeOnly: boolean = true,
  ): Promise<{
    updated_at: string | null;
    total_people: number;
    total_rate_amount: number;
    by_profession: { profession_code: string; people_count: number; total_rate_amount: number }[];
  }> {
    const rows = await requestRepository.findEligibilitySummary(activeOnly);
    const by_profession = rows.map((r: any) => ({
      profession_code: String(r.profession_code ?? "-"),
      people_count: Number(r.people_count ?? 0),
      total_rate_amount: Number(r.total_rate_amount ?? 0),
    }));
    const updated_at = rows.reduce<string | null>((acc, r: any) => {
      if (!r?.updated_at) return acc;
      const iso = new Date(r.updated_at).toISOString();
      return !acc || iso > acc ? iso : acc;
    }, null);
    const total_people = by_profession.reduce((sum, p) => sum + p.people_count, 0);
    const total_rate_amount = by_profession.reduce((sum, p) => sum + p.total_rate_amount, 0);

    return { updated_at, total_people, total_rate_amount, by_profession };
  }

  async getEligibilityListPaged(params: {
    activeOnly: boolean;
    professionCode?: string | null;
    search?: string | null;
    rateGroup?: string | null;
    department?: string | null;
    subDepartment?: string | null;
    licenseStatus?: "active" | "expiring" | "expired" | null;
    expiringDays?: number;
    page: number;
    limit: number;
  }): Promise<{
    items: Record<string, unknown>[];
    meta: { page: number; limit: number; total: number; updated_at: string | null; total_rate_amount: number };
  }> {
    const { page, limit, ...filters } = params;
    const [items, meta] = await Promise.all([
      requestRepository.findEligibilityListPaged(filters, page, limit),
      requestRepository.findEligibilityListMeta(filters),
    ]);
    return {
      items,
      meta: {
        page,
        limit,
        total: meta.total,
        updated_at: meta.updated_at,
        total_rate_amount: meta.total_rate_amount,
      },
    };
  }

  async getEligibilityById(
    eligibilityId: number,
  ): Promise<Record<string, unknown>> {
    const row = await requestRepository.findEligibilityById(eligibilityId);
    if (!row) {
      throw new Error("Eligibility not found");
    }

    const requestId = (row as any).request_id ? Number((row as any).request_id) : null;
    const citizenId = String((row as any).citizen_id ?? "");

    const [attachments, license] = await Promise.all([
      requestId ? requestRepository.findAttachmentsWithMetadata(requestId) : Promise.resolve([]),
      citizenId ? requestRepository.findLatestLicenseByCitizenId(citizenId) : Promise.resolve(null),
    ]);

    return {
      ...row,
      attachments: attachments.map((att: any) => ({
        attachment_id: att.attachment_id,
        request_id: att.request_id,
        file_type: att.file_type,
        file_path: att.file_path,
        file_name: att.file_name,
        uploaded_at: att.uploaded_at,
      })),
      license: license
        ? {
            license_id: (license as any).license_id,
            citizen_id: (license as any).citizen_id,
            license_name: (license as any).license_name,
            license_no: (license as any).license_no,
            valid_from: (license as any).valid_from,
            valid_until: (license as any).valid_until,
            status: (license as any).status,
            synced_at: (license as any).synced_at,
          }
        : null,
    };
  }

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

  async getApprovalHistory(
    actorId: number,
    actorRole: string,
    options?: {
      view?: "mine" | "team";
      includeAllActions?: boolean;
    },
  ): Promise<RequestWithDetails[]> {
    const view = options?.view ?? "team";
    const includeAllActions = options?.includeAllActions ?? false;
    const actions = includeAllActions
      ? ["SUBMIT", "APPROVE", "REJECT", "RETURN", "CANCEL", "REASSIGN"]
      : ["APPROVE", "REJECT", "RETURN"];

    if (view === "mine") {
      const mineIds = await requestRepository.findApprovalHistoryIds(actorId, actions);
      if (mineIds.length === 0) return [];
      const requestIds = mineIds.map((row) => row.request_id);
      const fullRequests = await requestRepository.findByIds(requestIds);
      return await hydrateRequests(fullRequests as any[]);
    }

    if (actorRole === "HEAD_WARD" || actorRole === "HEAD_DEPT") {
      const approverScopes = await getApproverScopes(actorId, actorRole);
      const scopeTypes =
        actorRole === "HEAD_DEPT"
          ? (["DEPT"] as const)
          : (["UNIT", "DEPT"] as const);
      const scopeNames = [
        ...approverScopes.wardScopes,
        ...approverScopes.deptScopes,
      ];
      const peerIds = await requestRepository.findPeerUserIdsByScope(
        actorRole,
        [...scopeTypes],
        scopeNames,
      );
      const actorIds = Array.from(new Set([actorId, ...peerIds]));
      const historyIds =
        await requestRepository.findApprovalHistoryIdsForActors(actorIds, actions);

      if (historyIds.length === 0) return [];
      const requestIds = historyIds.map((row) => row.request_id);
      const fullRequests = await requestRepository.findByIds(requestIds);
      return await hydrateRequests(fullRequests as any[]);
    }

    if (
      actorRole === "PTS_OFFICER" ||
      actorRole === "HEAD_HR" ||
      actorRole === "HEAD_FINANCE" ||
      actorRole === "DIRECTOR"
    ) {
      const peerIds = await requestRepository.findUserIdsByRole(actorRole);
      const actorIds = Array.from(new Set([actorId, ...peerIds]));
      const historyIds =
        await requestRepository.findApprovalHistoryIdsForActors(actorIds, actions);

      if (historyIds.length === 0) return [];
      const requestIds = historyIds.map((row) => row.request_id);
      const fullRequests = await requestRepository.findByIds(requestIds);
      return await hydrateRequests(fullRequests as any[]);
    }

    const historyIds = await requestRepository.findApprovalHistoryIds(actorId, actions);

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
    const licenseStatusRaw = (reqAny.license_raw_status as string | null)?.toUpperCase() ?? null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const licenseValidUntil = reqAny.license_valid_until
      ? new Date(reqAny.license_valid_until)
      : null;
    let licenseStatus: "ACTIVE" | "EXPIRED" | "INACTIVE" | "UNKNOWN" | null = null;
    if (reqAny.license_no || reqAny.license_name || reqAny.license_valid_from || reqAny.license_valid_until) {
      if (licenseStatusRaw && licenseStatusRaw !== "ACTIVE") {
        licenseStatus = "INACTIVE";
      } else if (licenseValidUntil && !Number.isNaN(licenseValidUntil.getTime()) && licenseValidUntil < today) {
        licenseStatus = "EXPIRED";
      } else if (licenseValidUntil || licenseStatusRaw === "ACTIVE" || licenseStatusRaw === null) {
        licenseStatus = "ACTIVE";
      } else {
        licenseStatus = "UNKNOWN";
      }
    }

    details.requester = {
      citizen_id: reqAny.citizen_id,
      role: "USER",
      first_name: reqAny.first_name,
      last_name: reqAny.last_name,
      position: reqAny.position_name,
      license_no: reqAny.license_no ?? null,
      license_name: reqAny.license_name ?? null,
      license_valid_from: reqAny.license_valid_from ?? null,
      license_valid_until: reqAny.license_valid_until ?? null,
      license_status: licenseStatus,
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
