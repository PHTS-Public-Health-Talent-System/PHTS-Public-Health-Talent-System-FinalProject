/**
 * src/modules/request/read/services/query.service.ts
 */
import {
  RequestStatus,
  RequestAttachment,
  RequestWithDetails,
  ROLE_STEP_MAP,
  RequestActionWithActor,
  OcrPrecheckHistoryResult,
} from '@/modules/request/contracts/request.types.js';
import { mapRequestRow, hydrateRequests } from '@/modules/request/services/helpers.js';
import { parseJsonField } from '@/modules/request/services/helpers.js';
import {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
  getApproverScopes,
  getActiveHeadScopeRoles,
} from '@/modules/request/scope/application/scope.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js'; // [NEW]
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import { AuthorizationError, NotFoundError } from '@/shared/utils/errors.js';

// ============================================================================
// User's Requests
// ============================================================================

export class RequestQueryService {
  private resolveRequesterLicenseStatus(reqAny: any):
    | "ACTIVE"
    | "EXPIRED"
    | "INACTIVE"
    | "UNKNOWN"
    | null {
    const hasLicenseData = Boolean(
      reqAny.license_no ||
        reqAny.license_name ||
        reqAny.license_valid_from ||
        reqAny.license_valid_until,
    );
    if (!hasLicenseData) {
      return null;
    }

    const licenseStatusRaw =
      (reqAny.license_raw_status as string | null)?.toUpperCase() ?? null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const licenseValidUntil = reqAny.license_valid_until
      ? new Date(reqAny.license_valid_until)
      : null;

    if (licenseStatusRaw && licenseStatusRaw !== "ACTIVE") {
      return "INACTIVE";
    }
    if (
      licenseValidUntil &&
      !Number.isNaN(licenseValidUntil.getTime()) &&
      licenseValidUntil < today
    ) {
      return "EXPIRED";
    }
    if (licenseValidUntil || licenseStatusRaw === "ACTIVE" || licenseStatusRaw === null) {
      return "ACTIVE";
    }
    return "UNKNOWN";
  }

  private async ensureRequestReadAccess(
    request: any,
    requestId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const isOwner = request.user_id === userId;
    const submissionData =
      parseJsonField<Record<string, unknown>>(request.submission_data, 'submission_data') || {};
    const createdByOfficerId = Number(submissionData.created_by_officer_id ?? 0) || null;
    const isCreatorOfficer = createdByOfficerId !== null && createdByOfficerId === userId;
    const isAdmin = userRole === "ADMIN";
    let isApprover =
      ROLE_STEP_MAP[userRole as keyof typeof ROLE_STEP_MAP] !== undefined &&
      request.status === RequestStatus.PENDING &&
      request.current_step === ROLE_STEP_MAP[userRole as keyof typeof ROLE_STEP_MAP];

    if (userRole === "HEAD_SCOPE") {
      const activeRoles = await getActiveHeadScopeRoles(userId, userRole);
      isApprover =
        request.status === RequestStatus.PENDING &&
        activeRoles.some((role) => request.current_step === ROLE_STEP_MAP[role]);
    }

    let hasScopeAccess = false;
    if (userRole === "HEAD_SCOPE") {
      hasScopeAccess = await canApproverAccessRequest(
        userId,
        userRole,
        request.emp_department || request.current_department || "",
        request.emp_sub_department || "",
      );
      if (!hasScopeAccess) {
        isApprover = false;
      }
    }
    if (userRole === "HEAD_SCOPE" && hasScopeAccess) {
      isApprover = true;
    }
    if (isOwner || isCreatorOfficer || isApprover || isAdmin) {
      return;
    }

    const approvals = await requestRepository.findApprovalsWithActor(requestId);
    const isActor = approvals.some((approval) => approval.actor_id === userId);
    if (!isActor) {
      throw new AuthorizationError("You do not have permission to view this request");
    }
  }

  async getEligibilityList(
    activeOnly = true,
  ): Promise<Record<string, unknown>[]> {
    return requestRepository.findEligibilityList(activeOnly);
  }

  async getEligibilitySummary(
    params: {
      activeOnly: boolean;
      professionCode?: string | null;
      search?: string | null;
      rateGroup?: string | null;
      department?: string | null;
      subDepartment?: string | null;
      licenseStatus?: "active" | "expiring" | "expired" | null;
      alertFilter?: "any" | "error" | "no-license" | "duplicate" | "upcoming-change" | null;
      expiringDays?: number;
    },
  ): Promise<{
    updated_at: string | null;
    total_people: number;
    total_rate_amount: number;
    alert_summary: {
      people_with_alerts: number;
      critical_people: number;
      no_license_people: number;
      duplicate_people: number;
      upcoming_change_people: number;
    };
    by_profession: {
      profession_code: string;
      people_count: number;
      total_rate_amount: number;
      people_with_alerts: number;
      critical_people: number;
      no_license_people: number;
      duplicate_people: number;
      upcoming_change_people: number;
    }[];
  }> {
    const rows = await requestRepository.findEligibilitySummary(params);
    const by_profession = rows.map((r: any) => ({
      profession_code: String(r.profession_code ?? "-"),
      people_count: Number(r.people_count ?? 0),
      total_rate_amount: Number(r.total_rate_amount ?? 0),
      people_with_alerts: Number(r.people_with_alerts ?? 0),
      critical_people: Number(r.critical_people ?? 0),
      no_license_people: Number(r.no_license_people ?? 0),
      duplicate_people: Number(r.duplicate_people ?? 0),
      upcoming_change_people: Number(r.upcoming_change_people ?? 0),
    }));
    const updated_at = rows.reduce<string | null>((acc, r: any) => {
      if (!r?.updated_at) return acc;
      const iso = new Date(r.updated_at).toISOString();
      return !acc || iso > acc ? iso : acc;
    }, null);
    const total_people = by_profession.reduce((sum, p) => sum + p.people_count, 0);
    const total_rate_amount = by_profession.reduce((sum, p) => sum + p.total_rate_amount, 0);
    const alert_summary = by_profession.reduce(
      (acc, row) => ({
        people_with_alerts: acc.people_with_alerts + row.people_with_alerts,
        critical_people: acc.critical_people + row.critical_people,
        no_license_people: acc.no_license_people + row.no_license_people,
        duplicate_people: acc.duplicate_people + row.duplicate_people,
        upcoming_change_people: acc.upcoming_change_people + row.upcoming_change_people,
      }),
      {
        people_with_alerts: 0,
        critical_people: 0,
        no_license_people: 0,
        duplicate_people: 0,
        upcoming_change_people: 0,
      },
    );

    return { updated_at, total_people, total_rate_amount, alert_summary, by_profession };
  }

  async getEligibilityListPaged(params: {
    activeOnly: boolean;
    inactiveOnly?: boolean;
    professionCode?: string | null;
    search?: string | null;
    rateGroup?: string | null;
    department?: string | null;
    subDepartment?: string | null;
    licenseStatus?: "active" | "expiring" | "expired" | null;
    alertFilter?: "any" | "error" | "no-license" | "duplicate" | "upcoming-change" | null;
    expiringDays?: number;
    page: number;
    limit: number;
  }): Promise<{
    items: Record<string, unknown>[];
    meta: {
      page: number;
      limit: number;
      total: number;
      updated_at: string | null;
      total_rate_amount: number;
      has_sub_item_no: boolean;
    };
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
        has_sub_item_no: meta.has_sub_item_no,
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

    const [attachments, eligibilityAttachments, license, eligibilityOcrPrecheck] = await Promise.all([
      requestId ? requestRepository.findAttachmentsWithMetadata(requestId) : Promise.resolve([]),
      requestRepository.findEligibilityAttachments(eligibilityId),
      citizenId ? requestRepository.findLatestLicenseByCitizenId(citizenId) : Promise.resolve(null),
      requestRepository.findEligibilityOcrPrecheck(eligibilityId),
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
      eligibility_attachments: eligibilityAttachments.map((att: any) => ({
        attachment_id: att.attachment_id,
        eligibility_id: att.eligibility_id,
        file_type: att.file_type,
        file_path: att.file_path,
        file_name: att.file_name,
        uploaded_by: att.uploaded_by,
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
      eligibility_ocr_precheck: eligibilityOcrPrecheck
        ? {
            eligibility_id: Number((eligibilityOcrPrecheck as any).eligibility_id),
            status: String((eligibilityOcrPrecheck as any).status),
            source: (eligibilityOcrPrecheck as any).source ?? null,
            service_url: (eligibilityOcrPrecheck as any).service_url ?? null,
            worker: (eligibilityOcrPrecheck as any).worker ?? null,
            started_at: (eligibilityOcrPrecheck as any).started_at ?? null,
            finished_at: (eligibilityOcrPrecheck as any).finished_at ?? null,
            count: Number((eligibilityOcrPrecheck as any).count ?? 0),
            success_count: Number((eligibilityOcrPrecheck as any).success_count ?? 0),
            failed_count: Number((eligibilityOcrPrecheck as any).failed_count ?? 0),
            error: (eligibilityOcrPrecheck as any).error ?? null,
            results:
              typeof (eligibilityOcrPrecheck as any).results_json === "string" &&
              (eligibilityOcrPrecheck as any).results_json.trim()
                ? JSON.parse((eligibilityOcrPrecheck as any).results_json)
                : [],
            created_at: (eligibilityOcrPrecheck as any).created_at ?? null,
            updated_at: (eligibilityOcrPrecheck as any).updated_at ?? null,
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
    if (userRole === "HEAD_SCOPE") {
      if (userId === undefined || userId === null) {
        throw new Error("User ID is required for HEAD_SCOPE");
      }
      const roles = await getActiveHeadScopeRoles(userId, userRole);
      if (!roles.length) return [];
      const requestIds = new Set<number>();
      const combinedRows: any[] = [];
      for (const role of roles) {
        const stepNo = ROLE_STEP_MAP[role as keyof typeof ROLE_STEP_MAP];
        if (!stepNo) continue;
        const scopeFilter = selectedScope
          ? await getScopeFilterForSelectedScope(userId, role, selectedScope)
          : await getScopeFilterForApprover(userId, role);
        const extraWhere =
          scopeFilter
            ? ` AND (${scopeFilter.whereClause.replace(/^ AND /, "")} OR r.user_id = ?)`
            : " AND r.user_id = ?";
        const extraParams = scopeFilter ? [...scopeFilter.params, userId] : [userId];
        const rows = await requestRepository.findPendingByStep(stepNo, userId, extraWhere, extraParams);
        for (const row of rows) {
          const requestId = Number((row as any).request_id);
          if (requestIds.has(requestId)) continue;
          requestIds.add(requestId);
          combinedRows.push(row);
        }
      }
      combinedRows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return await hydrateRequests(combinedRows as any[]);
    }

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

    const requestRows = await requestRepository.findPendingByStep(
      stepNo,
      userId,
      "",
      [],
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
      return await this.getHydratedHistoryRequests(requestIds);
    }

    if (actorRole === "HEAD_SCOPE") {
      const roles = await getActiveHeadScopeRoles(actorId, actorRole);
      if (!roles.length) return [];
      const actorIds = new Set<number>([actorId]);
      for (const role of roles) {
        const approverScopes = await getApproverScopes(actorId, role);
        const scopeTypes =
          role === "DEPT_SCOPE"
            ? (["DEPT"] as const)
            : (["UNIT", "DEPT"] as const);
        const scopeNames = [
          ...approverScopes.wardScopes,
          ...approverScopes.deptScopes,
        ];
        const peerIds = await requestRepository.findPeerUserIdsByScope(
          role,
          [...scopeTypes],
          scopeNames,
        );
        peerIds.forEach((peerId) => actorIds.add(peerId));
      }
      const historyIds =
        await requestRepository.findApprovalHistoryIdsForActors(Array.from(actorIds), actions);
      if (historyIds.length === 0) return [];
      const requestIds = historyIds.map((row) => row.request_id);
      return await this.getHydratedHistoryRequests(requestIds);
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
      return await this.getHydratedHistoryRequests(requestIds);
    }

    const historyIds = await requestRepository.findApprovalHistoryIds(actorId, actions);

    if (historyIds.length === 0) return [];

    const requestIds = historyIds.map((row) => row.request_id);
    return await this.getHydratedHistoryRequests(requestIds);
  }

  private mapApprovalActionWithActor(action: any): RequestActionWithActor {
    return {
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
    };
  }

  private async getHydratedHistoryRequests(
    requestIds: number[],
  ): Promise<RequestWithDetails[]> {
    if (requestIds.length === 0) return [];

    const fullRequests = await requestRepository.findByIds(requestIds);
    const hydrated = await hydrateRequests(fullRequests as any[]);
    const orderMap = new Map(requestIds.map((id, index) => [id, index]));

    const details = await Promise.all(
      hydrated.map(async (request) => {
        const actions = await requestRepository.findApprovalsWithActor(
          request.request_id,
        );
        return {
          ...request,
          actions: actions.map((action) =>
            this.mapApprovalActionWithActor(action),
          ),
        };
      }),
    );

    return details.sort((a, b) => {
      const aOrder = orderMap.get(a.request_id) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.get(b.request_id) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }

  // ============================================================================
  // Get Request by ID (with Access Control)
  // ============================================================================

  async getRequestById(
    requestId: number,
    userId: number,
    userRole: string,
  ): Promise<RequestWithDetails> {
    const request = await requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundError("คำขอ", requestId);
    }

    await this.ensureRequestReadAccess(request as any, requestId, userId, userRole);

    const details = await this.getRequestDetails(requestId);

    const reqAny = request as any;
    const licenseStatus = this.resolveRequesterLicenseStatus(reqAny);

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
      throw new NotFoundError("คำขอ", requestId);
    }

    const [attachments, actions, latestVerificationSnapshot, latestOcrPrecheck, linkedEligibility] = await Promise.all([
      requestRepository.findAttachmentsWithMetadata(requestId),
      requestRepository.findApprovalsWithActor(requestId),
      requestRepository.findLatestVerificationSnapshotByRequestId(requestId),
      OcrRequestRepository.findRequestPrecheck(requestId),
      requestRepository.findLatestEligibilityByRequestId(requestId),
    ]);

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
      linked_eligibility: linkedEligibility
        ? {
            eligibility_id: Number((linkedEligibility as any).eligibility_id),
            profession_code: (linkedEligibility as any).profession_code ?? null,
            is_active: Boolean((linkedEligibility as any).is_active),
          }
        : null,
      ocr_precheck: latestOcrPrecheck,
      latest_verification_snapshot: latestVerificationSnapshot
        ? {
            snapshot_id: Number((latestVerificationSnapshot as any).snapshot_id),
            created_at: (latestVerificationSnapshot as any).created_at ?? null,
            created_by: (latestVerificationSnapshot as any).created_by ?? null,
            snapshot_data:
              typeof (latestVerificationSnapshot as any).snapshot_data === "string"
                ? (() => {
                    try {
                      return JSON.parse((latestVerificationSnapshot as any).snapshot_data);
                    } catch {
                      return (latestVerificationSnapshot as any).snapshot_data;
                    }
                  })()
                : ((latestVerificationSnapshot as any).snapshot_data ?? null),
          }
        : null,
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

  async getOcrPrecheckHistory(params: {
    page: number;
    limit: number;
    status?: string | null;
    search?: string | null;
  }): Promise<OcrPrecheckHistoryResult> {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const limit = Number.isFinite(params.limit) && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const result = await OcrRequestRepository.findRequestPrecheckHistory({
      page,
      limit,
      status: params.status ?? null,
      search: params.search ?? null,
    });

    return {
      items: result.items,
      meta: {
        page,
        limit,
        total: result.total,
      },
    };
  }
}

export const requestQueryService = new RequestQueryService();
