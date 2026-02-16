import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { PoolConnection } from "mysql2/promise";
import { Decimal } from "decimal.js";
import { payrollService as calculator } from '@/modules/payroll/core/calculator.js';
import { calculateRetroactive } from '@/modules/payroll/core/retroactive.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { PayPeriod, PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';
import { resolveNextStatus } from '@shared/policy/payroll.policy.js';
import { PayrollRepository } from '@/modules/payroll/repositories/payroll.repository.js';
import { UserRole } from '@/types/auth.js';

export { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';

const REVIEW_PROFESSION_MAP: Record<string, string> = {
  DOCTOR: "PHYSICIAN",
  DENTIST: "DENTIST",
  PHARMACIST: "PHARMACIST",
  NURSE: "NURSE",
  MED_TECH: "MED_TECH",
  RAD_TECH: "RADIOLOGIST",
  PHYSIO: "PHYSICAL_THERAPY",
  OCC_THERAPY: "OCCUPATIONAL_THERAPY",
  CLIN_PSY: "CLINICAL_PSYCHOLOGIST",
  CARDIO_TECH: "CARDIO_THORACIC_TECH",
};

function normalizeProfessionCodeForReview(code: string): string {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized) return "";
  return REVIEW_PROFESSION_MAP[normalized] ?? normalized;
}

export class PayrollService {
  static canRoleViewPeriod(
    role: string | null | undefined,
    status: PeriodStatus | string,
  ): boolean {
    // Head HR should only see periods sent into/after HR stage.
    if (role === UserRole.HEAD_HR && status === PeriodStatus.OPEN) return false;
    return true;
  }

  static async ensurePeriodVisibleForRole(
    periodId: number,
    role: string | null | undefined,
  ): Promise<PayPeriod> {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");
    if (!PayrollService.canRoleViewPeriod(role, period.status)) {
      throw new Error("Forbidden period access");
    }
    return period;
  }

  static async getPeriodByMonthYear(year: number, month: number): Promise<PayPeriod | null> {
    return PayrollRepository.findPeriodByMonthYear(month, year);
  }

  /**
   * Initialize or fetch a period; creates new row with OPEN status if missing.
   */
  static async getOrCreatePeriod(
    year: number,
    month: number,
    createdBy?: number | null,
  ): Promise<PayPeriod> {
    const existing = await PayrollRepository.findPeriodByMonthYear(month, year);
    if (existing) return existing;

    if (!createdBy) {
      // Enforce auditability: period creation must be attributed to a logged-in user.
      throw new Error("ไม่สามารถสร้างรอบได้: ไม่พบผู้สร้าง (กรุณาเข้าสู่ระบบ)");
    }

    const insertId = await PayrollRepository.insertPeriod(
      month,
      year,
      PeriodStatus.OPEN,
      createdBy,
    );

    await emitAuditEvent({
      eventType: AuditEventType.PERIOD_CREATE,
      entityType: "period",
      entityId: insertId,
      actorId: createdBy,
      actorRole: null,
      actionDetail: {
        period_month: month,
        period_year: year,
        status: PeriodStatus.OPEN,
      },
    });

    const created = await PayrollRepository.findPeriodById(insertId);
    return created!;
  }

  /**
   * Run payroll calculation for a period (re-run safe).
   */
  static async processPeriodCalculation(periodId: number) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      await PayrollRepository.ensurePayResultChecksTable();
      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || period.is_frozen) {
        throw new Error(
          "ไม่สามารถคำนวณได้เนื่องจากงวดเดือนไม่ได้อยู่ในสถานะ OPEN",
        );
      }

      const { period_year: year, period_month: month } = period;

      await PayrollRepository.deletePayResultsByPeriod(periodId, conn);

      const periodItemCitizenIds =
        await PayrollRepository.findPeriodItemCitizenIds(periodId, conn);

      // Pre-fetch holidays once
      const holidayRows = await PayrollRepository.findHolidays(
        year - 1,
        year,
        conn,
      );
      const holidays = holidayRows.map((h: any) =>
        calculator.formatLocalDate(h.holiday_date),
      );

      const eligibleCitizenIds =
        periodItemCitizenIds.length > 0
          ? periodItemCitizenIds
          : await PayrollRepository.findEligibleCitizenIds(year, month, conn);

      let totalAmount = 0;
      let headCount = 0;

      const CHUNK_SIZE = 200;
      for (let i = 0; i < eligibleCitizenIds.length; i += CHUNK_SIZE) {
        const citizenIds = eligibleCitizenIds.slice(i, i + CHUNK_SIZE);
        if (citizenIds.length === 0) continue;
        const userIdMap = await PayrollRepository.findUserIdMapByCitizenIds(
          citizenIds,
          conn,
        );

        const startOfMonth = calculator.makeLocalDate(year, month - 1, 1);
        const endOfMonth = calculator.makeLocalDate(year, month, 0);
        const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

        const batchData = await PayrollRepository.fetchBatchData(
          citizenIds,
          startOfMonth,
          endOfMonth,
          fiscalYear,
          conn,
        );

        // Build maps keyed by citizen_id
        const eligMap = buildGroupMap(batchData.eligibilityRows, (row) => {
          if (!row.expiry_date && row.expiry_date_alt)
            row.expiry_date = row.expiry_date_alt;
        });
        const moveMap = buildGroupMap(batchData.movementRows);
        const empMap = buildSingleMap(batchData.employeeRows);
        const licMap = buildGroupMap(batchData.licenseRows);
        const leaveMap = buildGroupMap(batchData.leaveRows);
        const quotaMap = buildSingleMap(batchData.quotaRows);
        const noSalaryMap = buildGroupMap(batchData.noSalaryRows);

        // Map leave IDs to citizen for return reports
        const leaveIdToCitizen = new Map<number, string>();
        (batchData.leaveRows as any[]).forEach((row) => {
          if (row.id) leaveIdToCitizen.set(row.id, row.citizen_id);
        });

        const returnReportMap = new Map<string, any[]>();
        (batchData.returnReportRows as any[]).forEach((row) => {
          const citizenId = leaveIdToCitizen.get(row.leave_record_id);
          if (!citizenId) return;
          if (!returnReportMap.has(citizenId))
            returnReportMap.set(citizenId, []);
          returnReportMap.get(citizenId)!.push(row);
        });

        // Process each employee in chunk
        for (const cid of citizenIds) {
          const employeeData = {
            eligibilityRows: eligMap.get(cid) || [],
            movementRows: moveMap.get(cid) || [],
            employeeRow: empMap.get(cid) || {},
            licenseRows: licMap.get(cid) || [],
            leaveRows: leaveMap.get(cid) || [],
            quotaRow: quotaMap.get(cid) || null,
            holidays,
            noSalaryPeriods: noSalaryMap.get(cid) || [],
            returnReportRows: returnReportMap.get(cid) || [],
          };

          const currentResult = await calculator.calculateMonthlyWithData(
            year,
            month,
            employeeData,
          );

          const retroResult = await calculateRetroactive(
            cid,
            year,
            month,
            6,
            conn as any,
          );

          currentResult.retroactiveTotal = retroResult.totalRetro;
          currentResult.retroDetails = retroResult.retroDetails;
          if (retroResult.retroDetails && retroResult.retroDetails.length > 0) {
            const negative = retroResult.retroDetails.filter((d) => d.diff < -0.01);
            if (negative.length) {
              const total = Math.abs(negative.reduce((sum, item) => sum + item.diff, 0));
              const checks = currentResult.checks ?? [];
              checks.push({
                code: "RETRO_DEDUCT",
                severity: "WARNING",
                title: "ตกเบิกย้อนหลัง (หัก)",
                summary: `มีตกเบิกย้อนหลังติดลบ ${total.toLocaleString('th-TH')} บาท`,
                impactDays: 0,
                impactAmount: Number.parseFloat(total.toFixed(2)),
                startDate: null,
                endDate: null,
                evidence: negative.map((d) => ({
                  type: "retro",
                  reference_month: d.month,
                  reference_year: d.year,
                  diff: d.diff,
                  remark: d.remark,
                })),
              });
              currentResult.checks = checks;
            }
          }

          const grandTotal =
            currentResult.netPayment + (currentResult.retroactiveTotal || 0);

          if (grandTotal > 0 || currentResult.netPayment > 0) {
            await calculator.savePayout({
              conn,
              periodId,
              userId: userIdMap.get(cid) ?? null,
              citizenId: cid,
              result: currentResult,
              masterRateId: currentResult.masterRateId,
              baseRateSnapshot: currentResult.rateSnapshot,
              referenceYear: year,
              referenceMonth: month,
            });

            totalAmount += grandTotal;
            headCount++;
          }
        }
      }

      await PayrollRepository.updatePeriodTotals(
        periodId,
        totalAmount,
        headCount,
        conn,
      );
      await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);

      await conn.commit();
      return { success: true, headCount, totalAmount };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Transition period status through workflow.
   */
  static async updatePeriodStatus(
    periodId: number,
    action:
      | "SUBMIT"
      | "APPROVE_HR"
      | "APPROVE_HEAD_FINANCE"
      | "APPROVE_DIRECTOR"
      | "REJECT",
    actorId: number,
    reason?: string,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");

      const { status: currentStatus, period_year: year, period_month: month } =
        period;
      const nextStatus = resolveNextStatus(action, currentStatus);

      if (action === "SUBMIT") {
        const requiredProfessionCodes =
          await PayrollService.getRequiredProfessionCodes(periodId, conn);
        if (requiredProfessionCodes.length === 0) {
          throw new Error("ยังไม่มีข้อมูลการคำนวณสำหรับรอบนี้");
        }
        const reviewedProfessionCodes =
          await PayrollService.getReviewedProfessionCodes(periodId, conn);
        const reviewedSet = new Set(reviewedProfessionCodes);
        const missingProfessionCodes = requiredProfessionCodes.filter(
          (code) => !reviewedSet.has(code),
        );
        if (missingProfessionCodes.length > 0) {
          const error = new Error(
            "ยังตรวจไม่ครบทุกวิชาชีพก่อนส่งให้ HR",
          ) as Error & { missingProfessionCodes?: string[] };
          error.missingProfessionCodes = missingProfessionCodes;
          throw error;
        }
      }

      // Send notifications based on workflow transition
      await sendWorkflowNotification(nextStatus, month, year, conn);

      await PayrollRepository.updatePeriodStatus(periodId, nextStatus, conn);
      if (action === "SUBMIT") {
        await PayrollRepository.updatePeriodFreeze(periodId, true, actorId, conn);
      }
      if (action === "REJECT") {
        await PayrollRepository.updatePeriodFreeze(periodId, false, null, conn);
        await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);
      }
      await conn.commit();

      // Audit log (after commit for consistency)
      let auditEventType =
        nextStatus === PeriodStatus.CLOSED
          ? AuditEventType.PERIOD_CLOSE
          : AuditEventType.PERIOD_APPROVE;
      if (action === "REJECT") {
        auditEventType = AuditEventType.PERIOD_REJECT;
      }

      await tryEmitAuditEvent({
        eventType: auditEventType,
        entityType: "period",
        entityId: periodId,
        actorId,
        actorRole: null,
        actionDetail: {
          period_month: month,
          period_year: year,
          action,
          from_status: currentStatus,
          to_status: nextStatus,
          reason: reason ?? null,
        },
      });

      if (action === "SUBMIT") {
        await tryEmitAuditEvent({
          eventType: AuditEventType.PERIOD_FREEZE,
          entityType: "period",
          entityId: periodId,
          actorId,
          actorRole: null,
          actionDetail: {
            period_month: month,
            period_year: year,
          },
        });
        await tryEmitAuditEvent({
          eventType: AuditEventType.PERIOD_SUBMIT,
          entityType: "period",
          entityId: periodId,
          actorId,
          actorRole: null,
          actionDetail: {
            period_month: month,
            period_year: year,
            from_status: currentStatus,
            to_status: nextStatus,
          },
        });
      }

      return { success: true, status: nextStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Hard delete a period and all computed artifacts.
   *
   * Allowed only when:
   * - status === OPEN
   * - is_frozen === false
   */
  static async hardDeletePeriod(periodId: number, actorId: number) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN) {
        throw new Error("สามารถลบรอบได้เฉพาะรอบที่ยังเปิดอยู่ (OPEN) เท่านั้น");
      }
      if (period.is_frozen) {
        throw new Error("ไม่สามารถลบรอบได้: รอบนี้ถูก freeze แล้ว");
      }

      // Delete children first to avoid FK issues and keep DB consistent.
      await PayrollRepository.deletePayResultChecksByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultItemsByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultsByPeriod(periodId, conn);
      await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);
      await PayrollRepository.deletePeriodItemsByPeriod(periodId, conn);
      await PayrollRepository.deletePeriodById(periodId, conn);

      await conn.commit();

      await tryEmitAuditEvent({
        eventType: AuditEventType.PERIOD_DELETE,
        entityType: "period",
        entityId: periodId,
        actorId,
        actorRole: null,
        actionDetail: {
          period_month: period.period_month,
          period_year: period.period_year,
          status: period.status,
          is_frozen: period.is_frozen,
          delete_mode: "hard",
        },
      });

      return { success: true };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Fetch period summary by id.
   */
  static async getPeriodById(periodId: number) {
    return PayrollRepository.findPeriodById(periodId);
  }

  static async getRequiredProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    const rawCodes = await PayrollRepository.findRequiredProfessionCodesByPeriod(
      periodId,
      conn,
    );
    return Array.from(
      new Set(
        rawCodes
          .map((code) => normalizeProfessionCodeForReview(code))
          .filter(Boolean),
      ),
    );
  }

  static async getReviewedProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    const rawCodes = await PayrollRepository.findReviewedProfessionCodesByPeriod(
      periodId,
      conn,
    );
    return Array.from(
      new Set(
        rawCodes
          .map((code) => normalizeProfessionCodeForReview(code))
          .filter(Boolean),
      ),
    );
  }

  static async getPeriodReviewProgress(
    periodId: number,
    role?: string | null,
  ) {
    await PayrollService.ensurePeriodVisibleForRole(periodId, role);

    const requiredProfessionCodes =
      await PayrollService.getRequiredProfessionCodes(periodId);
    const reviewedProfessionCodes =
      await PayrollService.getReviewedProfessionCodes(periodId);
    const reviewedSet = new Set(reviewedProfessionCodes);
    const missingProfessionCodes = requiredProfessionCodes.filter(
      (code) => !reviewedSet.has(code),
    );

    return {
      required_profession_codes: requiredProfessionCodes,
      reviewed_profession_codes: reviewedProfessionCodes.filter((code) =>
        requiredProfessionCodes.includes(code),
      ),
      missing_profession_codes: missingProfessionCodes,
      total_required: requiredProfessionCodes.length,
      total_reviewed: requiredProfessionCodes.filter((code) =>
        reviewedSet.has(code),
      ).length,
      all_reviewed:
        requiredProfessionCodes.length > 0 && missingProfessionCodes.length === 0,
    };
  }

  static async setPeriodProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
  ) {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");
    if (period.status !== PeriodStatus.OPEN) {
      throw new Error("สามารถยืนยันตรวจได้เฉพาะรอบที่ยังเปิดอยู่");
    }

    const normalizedCode = normalizeProfessionCodeForReview(professionCode);
    if (!normalizedCode) {
      throw new Error("profession_code is required");
    }

    const requiredProfessionCodes =
      await PayrollService.getRequiredProfessionCodes(periodId);
    if (!requiredProfessionCodes.includes(normalizedCode)) {
      throw new Error("วิชาชีพนี้ไม่มีในรอบการคำนวณปัจจุบัน");
    }

    await PayrollRepository.setProfessionReview(
      periodId,
      normalizedCode,
      reviewed,
      actorId,
    );
    return PayrollService.getPeriodReviewProgress(periodId);
  }

  /**
   * List all periods (newest first).
   */
  static async getAllPeriods(role?: string | null): Promise<PayPeriod[]> {
    const periods = await PayrollRepository.findAllPeriods();
    return periods.filter((period) => PayrollService.canRoleViewPeriod(role, period.status));
  }

  static async ensureCurrentPeriod(): Promise<void> {
    // Intentionally disabled: creating periods must be done explicitly by a logged-in user
    // via the UI/API, so we always have created_by populated.
    return;
  }

  static async getPeriodDetail(periodId: number, role?: string | null) {
    const period = await PayrollService.ensurePeriodVisibleForRole(periodId, role);
    const items = await PayrollRepository.findPeriodItems(periodId);
    const monthStart = new Date(period.period_year, period.period_month - 1, 1);
    const monthEnd = new Date(period.period_year, period.period_month, 0);
    const toDate = (d: Date) => d.toISOString().slice(0, 10);

    const holidayRows = await PayrollRepository.findHolidayDatesInRange(
      toDate(monthStart),
      toDate(monthEnd),
    );
    const publicHolidaySet = new Set<string>(
      holidayRows.map((row: any) => toDate(new Date(row.holiday_date))),
    );

    const totalDays = monthEnd.getDate();
    let weekendDays = 0;
    let publicHolidayDays = 0;
    for (let day = 1; day <= totalDays; day += 1) {
      const current = new Date(period.period_year, period.period_month - 1, day);
      const dayOfWeek = current.getDay();
      const dateKey = toDate(current);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) {
        weekendDays += 1;
        continue;
      }
      if (publicHolidaySet.has(dateKey)) {
        publicHolidayDays += 1;
      }
    }

    const holidayDays = weekendDays + publicHolidayDays;
    const workingDays = Math.max(0, totalDays - holidayDays);

    return {
      period,
      items,
      calendar: {
        total_days: totalDays,
        working_days: workingDays,
        holiday_days: holidayDays,
        weekend_days: weekendDays,
        public_holiday_days: publicHolidayDays,
      },
    };
  }

  static async addPeriodItems(
    periodId: number,
    requestIds: number[],
    actorId?: number,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || period.is_frozen) {
        throw new Error("Period is not open for changes");
      }

      const missingSnapshots: number[] = [];
      for (const requestId of requestIds) {
        const citizenId = await PayrollRepository.findRequestCitizenId(
          requestId,
          conn,
        );
        const userId = await PayrollRepository.findRequestUserId(
          requestId,
          conn,
        );
        if (!citizenId) {
          throw new Error(`Request not found: ${requestId}`);
        }
        const snapshotId =
          await PayrollRepository.findLatestVerificationSnapshotId(
            requestId,
            conn,
          );
        if (!snapshotId) {
          missingSnapshots.push(requestId);
          continue;
        }
        await PayrollRepository.insertPeriodItem(
          periodId,
          requestId,
          userId,
          citizenId,
          snapshotId,
          conn,
        );
      }

      if (missingSnapshots.length) {
        const error = new Error("Missing verification snapshot");
        (error as any).missingRequestIds = missingSnapshots;
        throw error;
      }

      await conn.commit();

      await emitAuditEvent({
        eventType: AuditEventType.PERIOD_ITEM_ADD,
        entityType: "period",
        entityId: periodId,
        actorId: actorId ?? null,
        actorRole: null,
        actionDetail: { request_ids: requestIds },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async removePeriodItem(
    periodId: number,
    itemId: number,
    actorId?: number,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || period.is_frozen) {
        throw new Error("Period is not open for changes");
      }

      await PayrollRepository.deletePeriodItem(periodId, itemId, conn);

      await conn.commit();

      await emitAuditEvent({
        eventType: AuditEventType.PERIOD_ITEM_REMOVE,
        entityType: "period",
        entityId: periodId,
        actorId: actorId ?? null,
        actorRole: null,
        actionDetail: { item_id: itemId },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async searchPayouts(params: {
    q: string;
    periodYear?: number;
    periodMonth?: number;
  }) {
    return PayrollRepository.searchPayouts(params);
  }

  /**
   * List payouts for a specific period (for officer review UI).
   */
  static async getPeriodPayouts(periodId: number) {
    await PayrollRepository.ensurePayResultChecksTable();
    return PayrollRepository.findPayoutsByPeriod(periodId);
  }

  static async getPayoutDetail(payoutId: number) {
    await PayrollRepository.ensurePayResultChecksTable();
    const payout = await PayrollRepository.findPayoutDetailById(payoutId);
    if (!payout) throw new Error("Payout not found");
    const items = await PayrollRepository.findPayoutItemsByPayoutId(payoutId);
    const checksRaw = await PayrollRepository.findPayoutChecksByPayoutId(payoutId);
    const checks = checksRaw.map((row: any) => {
      const evidenceRaw = row.evidence_json;
      let evidence: unknown[] = [];
      if (Array.isArray(evidenceRaw)) {
        evidence = evidenceRaw;
      } else if (typeof evidenceRaw === "string" && evidenceRaw.trim()) {
        try {
          evidence = JSON.parse(evidenceRaw);
        } catch {
          evidence = [];
        }
      }
      const { evidence_json: _ignore, ...rest } = row;
      return { ...rest, evidence };
    });
    return { payout, items, checks };
  }

  static async updatePayout(
    payoutId: number,
    payload: {
      eligible_days?: number;
      deducted_days?: number;
      retroactive_amount?: number;
      remark?: string | null;
    },
    meta?: { actorId?: number | null },
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const ctx = await PayrollRepository.findPayoutEditContextByIdForUpdate(
        payoutId,
        conn,
      );
      if (!ctx) throw new Error("Payout not found");

      const periodStatus = String((ctx as any).period_status ?? "");
      const isFrozen = Boolean((ctx as any).is_frozen ?? false);
      if (periodStatus !== PeriodStatus.OPEN || isFrozen) {
        throw new Error("สามารถแก้ไขได้เฉพาะรอบที่ยังเปิดอยู่");
      }

      const periodId = Number((ctx as any).period_id ?? 0);
      const month = Number((ctx as any).period_month ?? 0);
      const rawYear = Number((ctx as any).period_year ?? 0);
      const year = rawYear > 2400 ? rawYear - 543 : rawYear;
      const daysInMonth = new Date(year, month, 0).getDate();
      if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) {
        throw new Error("ข้อมูลเดือน/ปีของรอบไม่ถูกต้อง");
      }

      const nextEligibleDays =
        payload.eligible_days !== undefined
          ? Number(payload.eligible_days)
          : Number((ctx as any).eligible_days ?? 0);
      const nextDeductedDays =
        payload.deducted_days !== undefined
          ? Number(payload.deducted_days)
          : Number((ctx as any).deducted_days ?? 0);
      const nextRetroactiveAmount =
        payload.retroactive_amount !== undefined
          ? Number(payload.retroactive_amount)
          : Number((ctx as any).retroactive_amount ?? 0);
      const nextRemark =
        payload.remark !== undefined ? payload.remark : ((ctx as any).remark ?? null);

      if (!Number.isFinite(nextEligibleDays) || nextEligibleDays < 0) {
        throw new Error("eligible_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0");
      }
      if (!Number.isFinite(nextDeductedDays) || nextDeductedDays < 0) {
        throw new Error("deducted_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0");
      }
      if (nextEligibleDays > daysInMonth) {
        throw new Error(`eligible_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`);
      }
      if (nextDeductedDays > daysInMonth) {
        throw new Error(`deducted_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`);
      }
      if (nextEligibleDays + nextDeductedDays > daysInMonth) {
        throw new Error(`eligible_days + deducted_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`);
      }
      if (!Number.isFinite(nextRetroactiveAmount)) {
        throw new Error("retroactive_amount ต้องเป็นตัวเลข");
      }

      const baseRate = Number((ctx as any).pts_rate_snapshot ?? 0);
      const calculatedAmount = new Decimal(baseRate)
        .div(daysInMonth)
        .mul(nextEligibleDays)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const totalPayable = new Decimal(calculatedAmount)
        .plus(nextRetroactiveAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      await conn.execute(
        `
        UPDATE pay_results
        SET eligible_days = ?,
            deducted_days = ?,
            retroactive_amount = ?,
            calculated_amount = ?,
            total_payable = ?,
            remark = ?
        WHERE payout_id = ?
        `,
        [
          nextEligibleDays,
          nextDeductedDays,
          nextRetroactiveAmount,
          calculatedAmount,
          totalPayable,
          nextRemark,
          payoutId,
        ],
      );

      // Keep item breakdown consistent:
      // - update CURRENT item to match calculated_amount
      // - keep existing retro items, but add a single "manual" retro item to make the sum match retroactive_amount
      const manualDesc = "ตกเบิก (แก้ไขด้วยมือ)";

      const [currentRows] = await conn.query<any[]>(
        `
        SELECT item_id
        FROM pay_result_items
        WHERE payout_id = ? AND item_type = 'CURRENT'
        ORDER BY item_id ASC
        LIMIT 1
        `,
        [payoutId],
      );
      const currentItemId = currentRows?.[0]?.item_id ? Number(currentRows[0].item_id) : null;
      if (currentItemId) {
        await conn.execute(
          `UPDATE pay_result_items SET amount = ? WHERE item_id = ?`,
          [calculatedAmount, currentItemId],
        );
      } else if (Math.abs(calculatedAmount) > 0.005) {
        await conn.execute(
          `
          INSERT INTO pay_result_items
            (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
          `,
          [payoutId, month, rawYear, calculatedAmount],
        );
      }

      const [retroRows] = await conn.query<any[]>(
        `
        SELECT item_id, item_type, amount, reference_month, reference_year, description
        FROM pay_result_items
        WHERE payout_id = ?
          AND item_type IN ('RETROACTIVE_ADD', 'RETROACTIVE_DEDUCT')
        ORDER BY item_id ASC
        `,
        [payoutId],
      );

      const retroSumExcludingManual = (retroRows ?? []).reduce((sum, row) => {
        const isManual =
          Number(row.reference_month ?? 0) === 0 &&
          Number(row.reference_year ?? 0) === 0 &&
          String(row.description ?? "") === manualDesc;
        if (isManual) return sum;
        const amt = Number(row.amount ?? 0);
        const sign = String(row.item_type) === "RETROACTIVE_DEDUCT" ? -1 : 1;
        return sum + sign * (Number.isFinite(amt) ? amt : 0);
      }, 0);

      await conn.execute(
        `
        DELETE FROM pay_result_items
        WHERE payout_id = ?
          AND reference_month = 0
          AND reference_year = 0
          AND description = ?
          AND item_type IN ('RETROACTIVE_ADD', 'RETROACTIVE_DEDUCT')
        `,
        [payoutId, manualDesc],
      );

      const retroDelta = new Decimal(nextRetroactiveAmount)
        .minus(retroSumExcludingManual)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      if (Math.abs(retroDelta) > 0.01) {
        const itemType = retroDelta > 0 ? "RETROACTIVE_ADD" : "RETROACTIVE_DEDUCT";
        await conn.execute(
          `
          INSERT INTO pay_result_items
            (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, 0, 0, ?, ?, ?)
          `,
          [payoutId, itemType, Math.abs(retroDelta), manualDesc],
        );
      }

      const totals = await PayrollRepository.sumPayResultsByPeriod(periodId, conn);
      await PayrollRepository.updatePeriodTotals(
        periodId,
        totals.totalAmount,
        totals.headCount,
        conn,
      );

      await conn.commit();

      return {
        payout_id: payoutId,
        period_id: periodId,
        eligible_days: nextEligibleDays,
        deducted_days: nextDeductedDays,
        calculated_amount: calculatedAmount,
        retroactive_amount: nextRetroactiveAmount,
        total_payable: totalPayable,
        remark: nextRemark,
        updated_by: meta?.actorId ?? null,
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async getPeriodSummaryByProfession(periodId: number) {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");

    const total =
      await PayrollRepository.findPayResultCountByPeriod(periodId);
    if (total === 0) throw new Error("Period not calculated");

    return PayrollRepository.findProfessionSummaryByPeriod(periodId);
  }

  /**
   * On-demand calculation for a single employee (no persistence).
   */
  static async calculateOnDemand(
    year: number,
    month: number,
    citizenId: string,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      const currentResult = await calculator.calculateMonthly(
        citizenId,
        year,
        month,
        conn as any,
      );
      const retroResult = await calculateRetroactive(
        citizenId,
        year,
        month,
        6,
        conn as any,
      );

      const retroTotal = retroResult.totalRetro || 0;
      const total_payable = Number(
        (currentResult.netPayment + retroTotal).toFixed(2),
      );

      return [
        {
          ...currentResult,
          retroactiveTotal: retroTotal,
          retroDetails: retroResult.retroDetails,
          total_payable,
        },
      ];
    } finally {
      conn.release();
    }
  }

}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildGroupMap(
  rows: any[],
  transform?: (row: any) => void,
): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    transform?.(row);
    const key = row.citizen_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

function buildSingleMap(rows: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const row of rows) {
    map.set(row.citizen_id, row);
  }
  return map;
}

async function sendWorkflowNotification(
  nextStatus: PeriodStatus,
  month: number,
  year: number,
  conn: any,
): Promise<void> {
  const notifications: Record<
    string,
    { role: string; title: string; message: string; link: string }
  > = {
    [PeriodStatus.WAITING_HR]: {
      role: "HEAD_HR",
      title: "ตรวจสอบงวดเดือน",
      message: `งวดเดือน ${month}/${year} รอการตรวจสอบจากท่าน`,
      link: "/dashboard/head-hr/payroll-check",
    },
    [PeriodStatus.WAITING_HEAD_FINANCE]: {
      role: "HEAD_FINANCE",
      title: "ตรวจสอบงวดเดือน",
      message: `งวดเดือน ${month}/${year} ผ่านการตรวจสอบจาก HR แล้ว รอท่านอนุมัติ`,
      link: "/dashboard/head-finance/budget-check",
    },
    [PeriodStatus.WAITING_DIRECTOR]: {
      role: "DIRECTOR",
      title: "อนุมัติปิดงวดเดือน",
      message: `สรุปยอดงวดเดือน ${month}/${year} รอการอนุมัติปิดงวด`,
      link: "/dashboard/director/approvals",
    },
    [PeriodStatus.CLOSED]: {
      role: "FINANCE_OFFICER",
      title: "งวดเดือนปิดแล้ว",
      message: `งวดเดือน ${month}/${year} อนุมัติแล้ว สามารถดาวน์โหลดรายงานได้`,
      link: "/dashboard/finance-officer",
    },
  };

  const notif = notifications[nextStatus];
  if (notif) {
    await NotificationService.notifyRole(
      notif.role,
      notif.title,
      notif.message,
      notif.link,
      undefined,
      conn,
    );
  }
}

async function tryEmitAuditEvent(payload: Parameters<typeof emitAuditEvent>[0]) {
  try {
    await emitAuditEvent(payload);
  } catch (error) {
    console.error("[payroll] audit emit failed", error);
  }
}
