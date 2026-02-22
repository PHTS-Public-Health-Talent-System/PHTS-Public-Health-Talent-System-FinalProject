/**
 * PHTS System - Access Review Service
 *
 * Handles quarterly access review cycles and auto-disable.
 * FR-08-01: Quarterly access review reports
 * FR-08-02: 7-day advance warning and post-disable notification
 * FR-08-03: Auto-disable for terminated employees
 */

import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { RoleAssignmentService } from '@/modules/sync/services/role-assignment.service.js';
import {
  inferScopeType,
  parseSpecialPositionScopes,
  removeOverlaps,
} from '@/modules/request/scope/utils.js';
import { getSyncRuntimeStatus } from '@/modules/sync/services/sync-status.service.js';
import { AccessReviewRepository } from '@/modules/access-review/repositories/access-review.repository.js';

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

export async function getReviewCycles(year?: number): Promise<ReviewCycle[]> {
  return AccessReviewRepository.findCycles(year);
}

export async function getReviewCycle(
  cycleId: number,
): Promise<ReviewCycle | null> {
  return AccessReviewRepository.findCycleById(cycleId);
}

export async function createReviewCycle(): Promise<ReviewCycle> {
  const { quarter, year } = getCurrentQuarter();
  const { startDate, dueDate } = getQuarterDates(quarter, year);
  const syncStatus = await getSyncRuntimeStatus();
  const syncTimestampRaw = getTimestamp(syncStatus.lastResult);
  const syncTimestamp = syncTimestampRaw ? new Date(syncTimestampRaw) : null;

  const connection = await AccessReviewRepository.getConnection();

  try {
    await connection.beginTransaction();

    const users = await AccessReviewRepository.findActiveNonAdminUsers(connection);
    const reviewCandidates = (users as any[])
      .map((user) => {
        const hrRow = {
          citizen_id: String(user.citizen_id ?? ''),
          position_name: user.position_name ?? null,
          special_position: user.special_position ?? null,
          department: user.department ?? null,
          sub_department: user.sub_department ?? null,
        };

        const currentRole = String(user.role ?? '');
        const isProtectedRole = RoleAssignmentService.PROTECTED_ROLES.has(currentRole);
        const expectedRole = isProtectedRole
          ? currentRole
          : RoleAssignmentService.deriveRole(hrRow as any);
        const roleMismatch = expectedRole !== currentRole;
        const inactiveStatus = isInactiveEmployeeStatus(user.employee_status);
        const scopeExplanation = buildScopeExplanation(
          currentRole,
          user.special_position,
        );

        const profileSyncedAt = user.profile_synced_at
          ? new Date(user.profile_synced_at)
          : null;
        const changedByLatestSync =
          syncTimestamp && profileSyncedAt
            ? profileSyncedAt.getTime() >= syncTimestamp.getTime()
            : true;

        const shouldReview = roleMismatch || inactiveStatus || changedByLatestSync;
        const reviewNoteParts = [
          `sync_at=${syncTimestamp ? syncTimestamp.toISOString() : 'unknown'}`,
          `current_role=${currentRole || '-'}`,
          `expected_role=${expectedRole || '-'}`,
          `role_mismatch=${roleMismatch ? 'yes' : 'no'}`,
          `employee_status=${String(user.employee_status ?? '-')}`,
          scopeExplanation ? `scope=${scopeExplanation}` : null,
        ].filter(Boolean);

        return {
          ...user,
          shouldReview,
          reviewNote: reviewNoteParts.join(' | '),
        };
      })
      .filter((user) => user.shouldReview);

    const cycleId = await AccessReviewRepository.createCycle(
      quarter,
      year,
      startDate,
      dueDate,
      reviewCandidates.length,
      connection,
    );

    for (const user of reviewCandidates) {
      await AccessReviewRepository.createItem(
        cycleId,
        user.id,
        user.role,
        user.employee_status,
        user.last_login_at,
        user.reviewNote,
        connection,
      );
    }

    await connection.commit();

    await emitAuditEvent(
      {
        eventType: AuditEventType.ACCESS_REVIEW_CREATE,
        entityType: 'access_review_cycle',
        entityId: cycleId,
        actionDetail: {
          quarter,
          year,
          total_users: reviewCandidates.length,
          source: 'SYNC_DELTA',
          sync_timestamp: syncTimestamp ? syncTimestamp.toISOString() : null,
        },
      },
      connection,
    );

    const admins = await AccessReviewRepository.findAdminUsers(connection);
    for (const adminId of admins) {
      await NotificationService.notifyUser(
        adminId,
        'รอบตรวจทานสิทธิ์ใหม่',
        `สร้างรอบตรวจทานสิทธิ์หลัง Sync แล้ว มีผู้ใช้ทั้งหมด ${reviewCandidates.length} คนรอตรวจทาน`,
        `/dashboard/admin/access-review/${cycleId}`,
        'SYSTEM',
      );
    }

    return {
      cycle_id: cycleId,
      quarter,
      year,
      status: ReviewCycleStatus.PENDING,
      start_date: startDate,
      due_date: dueDate,
      completed_at: null,
      completed_by: null,
      total_users: reviewCandidates.length,
      reviewed_users: 0,
      disabled_users: 0,
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

export async function getReviewItems(
  cycleId: number,
  result?: ReviewResult,
): Promise<ReviewItem[]> {
  return AccessReviewRepository.findItems(cycleId, result);
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
        'บัญชีของท่านถูกปิดใช้งานจากการตรวจทานสิทธิ์ประจำไตรมาส กรุณาติดต่อผู้ดูแลระบบ',
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

export async function autoDisableTerminatedUsers(): Promise<{
  disabled: number;
  errors: string[];
}> {
  const result = { disabled: 0, errors: [] as string[] };

  const connection = await AccessReviewRepository.getConnection();

  try {
    await connection.beginTransaction();

    const { quarter, year } = getCurrentQuarter();
    const cycle = await AccessReviewRepository.findActiveCycleByQuarterYear({
      quarter,
      year,
      conn: connection,
    });

    if (!cycle) {
      await connection.rollback();
      return result;
    }

    const items = await AccessReviewRepository.findTerminatedPendingItems(
      cycle.cycle_id,
      connection,
    );

    for (const item of items as any[]) {
      try {
        await AccessReviewRepository.updateItemAutoDisabled(
          item.item_id,
          item.employee_status,
          connection,
        );
        await AccessReviewRepository.disableUser(item.user_id, connection);

        await emitAuditEvent(
          {
            eventType: AuditEventType.USER_DISABLE,
            entityType: 'users',
            entityId: item.user_id,
            actionDetail: {
              reason: 'auto_disable',
              employee_status: item.employee_status,
              cycle_id: cycle.cycle_id,
            },
          },
          connection,
        );

        result.disabled++;
      } catch (error: any) {
        result.errors.push(`User ${item.user_id}: ${error.message}`);
      }
    }

    await AccessReviewRepository.updateCycleStats(cycle.cycle_id, connection);
    await connection.commit();
  } catch (error: any) {
    await connection.rollback();
    result.errors.push(`Job error: ${error.message}`);
  } finally {
    connection.release();
  }

  return result;
}

export async function sendReviewReminders(): Promise<number> {
  let remindersSent = 0;
  const cycles = await AccessReviewRepository.findCyclesDueSoon();

  for (const cycle of cycles as any[]) {
    const daysRemaining = Math.ceil(
      (new Date(cycle.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const admins = await AccessReviewRepository.findAdminUsers();
    for (const adminId of admins) {
      await NotificationService.notifyUser(
        adminId,
        'เตือน: ครบกำหนดตรวจทานสิทธิ์',
        `รอบตรวจทานสิทธิ์ไตรมาส ${cycle.quarter}/${cycle.year} จะครบกำหนดใน ${daysRemaining} วัน`,
        `/dashboard/admin/access-review/${cycle.cycle_id}`,
        'REMINDER',
      );
      remindersSent++;
    }
  }

  return remindersSent;
}
