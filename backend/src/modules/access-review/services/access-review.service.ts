/**
 * PHTS System - Access Review Service
 *
 * Handles post-sync access review cycles focused on:
 * - new/changed users from sync
 * - role/scope mismatch verification
 */

import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { IdentityRolePolicyService } from '@/modules/identity/services/identity-role-policy.service.js';
import {
  inferScopeType,
  parseSpecialPositionScopes,
  removeOverlaps,
} from '@/modules/request/scope/domain/scope.utils.js';
import { getSyncRuntimeStatus } from '@/modules/sync/services/sync-status.service.js';
import { AccessReviewRepository } from '@/modules/access-review/repositories/access-review.repository.js';
import {
  AccessReviewQueueStatus,
  AccessReviewReasonCode,
} from '@/modules/access-review/entities/access-review.entity.js';

/**
 * Review cycle status
 */
export enum ReviewCycleStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

/**
 * Review result for a user
 */
export enum ReviewResult {
  KEEP = 'KEEP',
  DISABLE = 'DISABLE',
  PENDING = 'PENDING',
}

/**
 * Access review cycle
 */
export interface ReviewCycle {
  cycle_id: number;
  quarter: number;
  year: number;
  status: ReviewCycleStatus;
  start_date: Date;
  due_date: Date;
  completed_at: Date | null;
  completed_by: number | null;
  total_users: number;
  reviewed_users: number;
  disabled_users: number;
}

/**
 * Access review item (per user)
 */
export interface ReviewItem {
  item_id: number;
  cycle_id: number;
  user_id: number;
  citizen_id: string;
  user_name: string;
  current_role: string;
  employee_status: string | null;
  last_login_at: Date | null;
  review_result: ReviewResult;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  review_note: string | null;
  auto_disabled: boolean;
}

function getCurrentQuarter(): { quarter: number; year: number } {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { quarter, year: now.getFullYear() };
}

function getQuarterDates(
  quarter: number,
  year: number,
): { startDate: Date; dueDate: Date } {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const dueDate = new Date(year, startMonth, 14);
  return { startDate, dueDate };
}

const INACTIVE_STATUS_KEYWORDS = [
  'ลาออก',
  'เกษียณ',
  'เสียชีวิต',
  'โอนออก',
  'not working',
  'inactive',
  'resigned',
  'retired',
  'deceased',
  'terminated',
];

function isInactiveEmployeeStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return INACTIVE_STATUS_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

function buildScopeExplanation(
  role: string,
  specialPosition: string | null | undefined,
): string | null {
  if (role !== 'HEAD_WARD' && role !== 'HEAD_DEPT') return null;
  const rawScopes = parseSpecialPositionScopes(specialPosition ?? null);
  if (rawScopes.length === 0) return 'ไม่พบ special_position ที่ใช้คำนวณ scope';

  const wardScopes = rawScopes.filter((scope) => inferScopeType(scope) === 'UNIT');
  const deptScopes = rawScopes.filter((scope) => inferScopeType(scope) === 'DEPT');
  const cleanedWardScopes = removeOverlaps(wardScopes, deptScopes);

  return [
    `special_position: ${String(specialPosition ?? '-')}`,
    `ward_scopes: ${cleanedWardScopes.length ? cleanedWardScopes.join(', ') : '-'}`,
    `dept_scopes: ${deptScopes.length ? deptScopes.join(', ') : '-'}`,
  ].join(' | ');
}

type RiskDetectionCandidate = {
  id: number;
  citizen_id: string;
  role: string;
  expected_role: string;
  employee_status: string | null;
  last_login_at: Date | null;
  user_created_at: Date | null;
  profile_synced_at: Date | null;
  special_position: string | null;
  reasons: AccessReviewReasonCode[];
  reviewNote: string;
};

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildRiskDetectionCandidates(
  connection: Awaited<ReturnType<typeof AccessReviewRepository.getConnection>>,
  options?: { syncTimestamp?: Date | null; citizenId?: string | null },
): Promise<RiskDetectionCandidate[]> {
  const users = await AccessReviewRepository.findNonAdminUsers(connection);
  const syncTimestamp = options?.syncTimestamp ?? null;

  return (users as any[])
    .filter((user) =>
      options?.citizenId
        ? String(user.citizen_id ?? "") === String(options.citizenId)
        : true,
    )
    .map((user) => {
      const hrRow = {
        citizen_id: String(user.citizen_id ?? ""),
        position_name: user.position_name ?? null,
        special_position: user.special_position ?? null,
        department: user.department ?? null,
        sub_department: user.sub_department ?? null,
      };

      const currentRole = String(user.role ?? "");
      const isUserActive = Number(user.is_active ?? 0) === 1;
      const isProtectedRole = IdentityRolePolicyService.PROTECTED_ROLES.has(currentRole);
      const expectedRole = isProtectedRole
        ? currentRole
        : IdentityRolePolicyService.deriveRole(hrRow as any);
      const roleMismatch = isUserActive && expectedRole !== currentRole;
      const inactiveStatus = isUserActive && isInactiveEmployeeStatus(user.employee_status);
      const scopeExplanation = buildScopeExplanation(currentRole, user.special_position);

      const profileSyncedAt = toDateOrNull(user.profile_synced_at);
      const changedByLatestSync =
        isUserActive &&
        Boolean(syncTimestamp) &&
        Boolean(profileSyncedAt) &&
        profileSyncedAt!.getTime() >= syncTimestamp!.getTime();
      const userCreatedAt = toDateOrNull(user.created_at);
      const isNewUser =
        Boolean(syncTimestamp) &&
        Boolean(userCreatedAt) &&
        userCreatedAt!.getTime() >= syncTimestamp!.getTime();

      const reasons: AccessReviewReasonCode[] = [];
      if (isNewUser) reasons.push(AccessReviewReasonCode.NEW_USER);
      if (roleMismatch) reasons.push(AccessReviewReasonCode.ROLE_MISMATCH);
      if (changedByLatestSync) reasons.push(AccessReviewReasonCode.PROFILE_CHANGED);
      if (inactiveStatus) reasons.push(AccessReviewReasonCode.INACTIVE_BUT_ACTIVE);

      const reviewNoteParts = [
        `sync_at=${syncTimestamp ? syncTimestamp.toISOString() : "unknown"}`,
        `current_role=${currentRole || "-"}`,
        `expected_role=${expectedRole || "-"}`,
        `is_active=${isUserActive ? "yes" : "no"}`,
        `role_mismatch=${roleMismatch ? "yes" : "no"}`,
        `employee_status=${String(user.employee_status ?? "-")}`,
        `new_user=${isNewUser ? "yes" : "no"}`,
        `profile_changed=${changedByLatestSync ? "yes" : "no"}`,
        scopeExplanation ? `scope=${scopeExplanation}` : null,
      ].filter(Boolean);

      return {
        id: Number(user.id),
        citizen_id: String(user.citizen_id ?? ""),
        role: currentRole,
        expected_role: expectedRole,
        employee_status: user.employee_status ?? null,
        last_login_at: user.last_login_at ?? null,
        user_created_at: userCreatedAt,
        profile_synced_at: profileSyncedAt,
        special_position: user.special_position ?? null,
        reasons,
        reviewNote: reviewNoteParts.join(" | "),
      };
    })
    .filter((user) => user.reasons.length > 0);
}

async function syncGlobalReviewQueue(
  connection: Awaited<ReturnType<typeof AccessReviewRepository.getConnection>>,
  detections: RiskDetectionCandidate[],
  options?: { batchId?: number | null; citizenId?: string | null },
): Promise<void> {
  const batchId = options?.batchId ?? null;
  if (!batchId) return;

  for (const candidate of detections) {
    for (const reason of candidate.reasons) {
      await AccessReviewRepository.upsertQueueDetection({
        userId: candidate.id,
        reasonCode: reason,
        batchId,
        detectedAt: new Date(),
        payload: {
          citizen_id: candidate.citizen_id,
          current_role: candidate.role,
          expected_role: candidate.expected_role,
          employee_status: candidate.employee_status,
          profile_synced_at: candidate.profile_synced_at
            ? candidate.profile_synced_at.toISOString()
            : null,
          review_note: candidate.reviewNote,
        },
        conn: connection,
      });
    }
  }

  let targetUserId: number | null = null;
  if (options?.citizenId) {
    targetUserId = await AccessReviewRepository.findUserIdByCitizenId(options.citizenId, connection);
  }

  await AccessReviewRepository.autoResolveUnseenQueueByBatch({
    batchId,
    userId: targetUserId ?? undefined,
    conn: connection,
  });
}

export async function getReviewCycles(year?: number): Promise<ReviewCycle[]> {
  return AccessReviewRepository.findCycles(year);
}

export async function getReviewCycle(
  cycleId: number,
): Promise<ReviewCycle | null> {
  return AccessReviewRepository.findCycleById(cycleId);
}

export async function createReviewCycle(): Promise<ReviewCycle> {
  const syncStatus = await getSyncRuntimeStatus();
  const syncTimestampRaw = getTimestamp(syncStatus.lastResult);
  const syncTimestamp = syncTimestampRaw ? new Date(syncTimestampRaw) : null;
  const refreshResult = await refreshReviewCycleFromSync({
    syncTimestamp,
  });
  const cycle = await AccessReviewRepository.findCycleById(refreshResult.cycleId);
  if (!cycle) {
    throw new Error('Review cycle not found after refresh');
  }
  return cycle as ReviewCycle;
}

export async function refreshReviewCycleFromSync(options?: {
  actorId?: number | null;
  syncTimestamp?: Date | null;
  citizenId?: string | null;
  batchId?: number | null;
}): Promise<{ cycleId: number; createdCycle: boolean; insertedItems: number }> {
  const { quarter, year } = getCurrentQuarter();
  const { startDate, dueDate } = getQuarterDates(quarter, year);
  const connection = await AccessReviewRepository.getConnection();

  try {
    await connection.beginTransaction();

    let effectiveSyncTimestamp = options?.syncTimestamp ?? null;
    if (options?.batchId) {
      const batchStartedAt = await AccessReviewRepository.findSyncBatchStartedAt(
        options.batchId,
        connection,
      );
      if (batchStartedAt) {
        effectiveSyncTimestamp = batchStartedAt;
      }
    }

    let cycle = await AccessReviewRepository.findActiveCycleByQuarterYear({
      quarter,
      year,
      conn: connection,
    });
    let createdCycle = false;

    if (!cycle) {
      // If a cycle already exists for this quarter/year (including COMPLETED),
      // reuse it instead of creating a duplicate against unique key.
      const existingCycle = await AccessReviewRepository.findCycleByQuarterYear(
        quarter,
        year,
        connection,
      );
      if (existingCycle) {
        cycle = existingCycle;
      } else {
        const cycleId = await AccessReviewRepository.createCycle(
          quarter,
          year,
          startDate,
          dueDate,
          0,
          connection,
        );
        createdCycle = true;
        cycle = await AccessReviewRepository.findCycleById(cycleId, connection);
        if (!cycle) {
          throw new Error('Failed to load access review cycle after creation');
        }
      }
    }

    const riskDetections = await buildRiskDetectionCandidates(connection, {
      syncTimestamp: effectiveSyncTimestamp,
      citizenId: options?.citizenId ?? null,
    });
    await syncGlobalReviewQueue(connection, riskDetections, {
      batchId: options?.batchId ?? null,
      citizenId: options?.citizenId ?? null,
    });

    // Completed cycle for current quarter should remain immutable in post-sync refresh.
    if (cycle.status === ReviewCycleStatus.COMPLETED) {
      await connection.commit();
      return {
        cycleId: cycle.cycle_id,
        createdCycle: false,
        insertedItems: 0,
      };
    }

    const reviewCandidates = riskDetections.map((user) => ({
      id: Number(user.id),
      role: String(user.role ?? ''),
      employee_status: user.employee_status ?? null,
      last_login_at: user.last_login_at ?? null,
      reviewNote: String(user.reviewNote ?? ''),
    }));

    let insertedItems = 0;
    for (const user of reviewCandidates) {
      const inserted = await AccessReviewRepository.createItemIfNotExists(
        cycle.cycle_id,
        user.id,
        user.role,
        user.employee_status,
        user.last_login_at,
        user.reviewNote,
        connection,
      );
      if (inserted) insertedItems += 1;
    }

    const totalUsers = await AccessReviewRepository.countItemsByCycle(
      cycle.cycle_id,
      connection,
    );
    await AccessReviewRepository.updateCycleTotalUsers(
      cycle.cycle_id,
      totalUsers,
      connection,
    );
    await AccessReviewRepository.updateCycleStats(cycle.cycle_id, connection);

    await connection.commit();

    if (createdCycle || insertedItems > 0) {
      const admins = await AccessReviewRepository.findAdminUsers(connection);
      for (const adminId of admins) {
        await NotificationService.notifyUser(
          adminId,
          createdCycle
            ? 'สร้างรอบตรวจทานสิทธิ์อัตโนมัติหลัง Sync'
            : 'อัปเดตรายการตรวจทานสิทธิ์หลัง Sync',
          createdCycle
            ? `มีผู้ใช้ทั้งหมด ${totalUsers} คนในรอบตรวจทานล่าสุด`
            : `พบรายการต้องตรวจทานเพิ่ม ${insertedItems} รายการ`,
          `/dashboard/admin/access-review/${cycle.cycle_id}`,
          'SYSTEM',
        );
      }
    }

    await emitAuditEvent({
      eventType: AuditEventType.ACCESS_REVIEW_CREATE,
      entityType: 'access_review_cycle',
      entityId: cycle.cycle_id,
      actorId: options?.actorId ?? null,
      actionDetail: {
        action: createdCycle ? 'CREATE_OR_REFRESH' : 'REFRESH',
        inserted_items: insertedItems,
        total_users: totalUsers,
        quarter,
        year,
        sync_timestamp: effectiveSyncTimestamp
          ? effectiveSyncTimestamp.toISOString()
          : null,
        target_citizen_id: options?.citizenId ?? null,
        sync_batch_id: options?.batchId ?? null,
      },
    });

    return {
      cycleId: cycle.cycle_id,
      createdCycle,
      insertedItems,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function getTimestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const timestamp = (value as { timestamp?: unknown }).timestamp;
  return typeof timestamp === 'string' ? timestamp : null;
}

function extractReviewNoteValue(
  reviewNote: string | null | undefined,
  key: string,
): string | null {
  if (!reviewNote) return null;
  const parts = reviewNote.split('|').map((part) => part.trim());
  const prefix = `${key}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length).trim() || null;
    }
  }
  return null;
}

function hasRoleMismatchFromReviewNote(
  reviewNote: string | null | undefined,
): boolean | null {
  const value = extractReviewNoteValue(reviewNote, 'role_mismatch');
  if (!value) return null;
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

export type AccessReviewQueueListInput = {
  page?: number;
  limit?: number;
  status?: AccessReviewQueueStatus;
  reasonCode?: string;
  currentRole?: string;
  isActive?: number;
  detectedFrom?: string;
  detectedTo?: string;
  batchId?: number;
  search?: string;
};

export type AccessReviewQueueResolveAction = "RESOLVE" | "DISMISS";

export async function getAccessReviewQueue(input?: AccessReviewQueueListInput) {
  return AccessReviewRepository.getReviewQueue(input);
}

export async function getAccessReviewQueueEvents(queueId: number, limit?: number) {
  return AccessReviewRepository.getReviewQueueEvents(queueId, limit);
}

export async function resolveAccessReviewQueueItem(params: {
  queueId: number;
  action: AccessReviewQueueResolveAction;
  actorId: number;
  note?: string | null;
}): Promise<void> {
  const connection = await AccessReviewRepository.getConnection();
  try {
    await connection.beginTransaction();
    await AccessReviewRepository.resolveQueueItem({
      queueId: params.queueId,
      status:
        params.action === "DISMISS"
          ? AccessReviewQueueStatus.DISMISSED
          : AccessReviewQueueStatus.RESOLVED,
      actorId: params.actorId,
      note: params.note ?? null,
      conn: connection,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getReviewItems(
  cycleId: number,
  result?: ReviewResult,
): Promise<ReviewItem[]> {
  return AccessReviewRepository.findItems(cycleId, result);
}

export async function autoReviewCycle(
  cycleId: number,
  reviewerId: number,
  options?: { disableInactive?: boolean },
): Promise<{ processed: number; kept: number; disabled: number; skipped: number }> {
  const connection = await AccessReviewRepository.getConnection();
  const disableInactive = options?.disableInactive ?? true;
  const summary = {
    processed: 0,
    kept: 0,
    disabled: 0,
    skipped: 0,
  };

  try {
    await connection.beginTransaction();

    const cycle = await AccessReviewRepository.findCycleById(cycleId, connection);
    if (!cycle) {
      throw new Error('Review cycle not found');
    }
    if (cycle.status === ReviewCycleStatus.COMPLETED) {
      throw new Error('Review cycle already completed');
    }

    const pendingItems = await AccessReviewRepository.findItems(
      cycleId,
      ReviewResult.PENDING,
      connection,
    );
    summary.processed = pendingItems.length;

    for (const item of pendingItems) {
      const inactive = isInactiveEmployeeStatus(item.employee_status);
      const roleMismatch = hasRoleMismatchFromReviewNote(item.review_note);

      if (inactive && disableInactive) {
        await AccessReviewRepository.updateItemResult(
          item.item_id,
          ReviewResult.DISABLE,
          reviewerId,
          [
            item.review_note,
            'auto_review=DISABLE(reason=inactive_status)',
          ]
            .filter(Boolean)
            .join(' | '),
          connection,
        );
        await AccessReviewRepository.disableUser(item.user_id, connection);
        summary.disabled += 1;
        await emitAuditEvent(
          {
            eventType: AuditEventType.USER_DISABLE,
            entityType: 'users',
            entityId: item.user_id,
            actorId: reviewerId,
            actionDetail: {
              reason: 'access_review_auto',
              cycle_id: cycleId,
              rule: 'inactive_status',
            },
          },
          connection,
        );
        continue;
      }

      if (roleMismatch === false && !inactive) {
        await AccessReviewRepository.updateItemResult(
          item.item_id,
          ReviewResult.KEEP,
          reviewerId,
          [
            item.review_note,
            'auto_review=KEEP(reason=role_aligned)',
          ]
            .filter(Boolean)
            .join(' | '),
          connection,
        );
        summary.kept += 1;
        continue;
      }

      summary.skipped += 1;
    }

    await AccessReviewRepository.updateCycleStats(cycleId, connection);
    await connection.commit();

    await emitAuditEvent({
      eventType: AuditEventType.ACCESS_REVIEW_COMPLETE,
      entityType: 'access_review_cycle',
      entityId: cycleId,
      actorId: reviewerId,
      actionDetail: {
        action: 'AUTO_REVIEW',
        disable_inactive: disableInactive,
        ...summary,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return summary;
}

export async function updateReviewItem(
  itemId: number,
  result: ReviewResult,
  reviewerId: number,
  note?: string,
): Promise<void> {
  const connection = await AccessReviewRepository.getConnection();

  try {
    await connection.beginTransaction();

    const item = await AccessReviewRepository.findItemById(itemId, connection);
    if (!item) {
      throw new Error('Review item not found');
    }

    await AccessReviewRepository.updateItemResult(
      itemId,
      result,
      reviewerId,
      note || null,
      connection,
    );

    if (result === ReviewResult.DISABLE) {
      await AccessReviewRepository.disableUser(item.user_id, connection);

      await NotificationService.notifyUser(
        item.user_id,
        'บัญชีถูกปิดใช้งาน',
        'บัญชีของท่านถูกปิดใช้งานจากการตรวจทานสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ',
        '/login',
        'OTHER',
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.USER_DISABLE,
          entityType: 'users',
          entityId: item.user_id,
          actorId: reviewerId,
          actionDetail: {
            reason: 'access_review',
            cycle_id: item.cycle_id,
            note,
          },
        },
        connection,
      );
    }

    await AccessReviewRepository.updateCycleStats(item.cycle_id, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completeReviewCycle(
  cycleId: number,
  completedBy: number,
  options?: { autoKeepPending?: boolean; note?: string },
): Promise<void> {
  const connection = await AccessReviewRepository.getConnection();

  try {
    await connection.beginTransaction();

    const pendingCount = await AccessReviewRepository.countPendingItems(
      cycleId,
      connection,
    );

    if (pendingCount > 0 && !options?.autoKeepPending) {
      throw new Error(`ยังมี ${pendingCount} รายการที่ยังไม่ได้ตรวจทาน`);
    }

    if (pendingCount > 0 && options?.autoKeepPending) {
      await AccessReviewRepository.updatePendingItemsToKeep({
        cycleId,
        completedBy,
        note: options.note ?? 'อนุมัติคงค้างอัตโนมัติขณะปิดรอบ',
        conn: connection,
      });
    }

    await AccessReviewRepository.updateCycleStats(cycleId, connection);
    await AccessReviewRepository.updateCycleStatus(
      cycleId,
      ReviewCycleStatus.COMPLETED,
      completedBy,
      connection,
    );

    await connection.commit();

    await emitAuditEvent(
      {
        eventType: AuditEventType.ACCESS_REVIEW_COMPLETE,
        entityType: 'access_review_cycle',
        entityId: cycleId,
        actorId: completedBy,
        actionDetail: {
          autoKeepPending: Boolean(options?.autoKeepPending),
          autoKeptCount: pendingCount,
          note: options?.note ?? null,
        },
      },
      connection,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
