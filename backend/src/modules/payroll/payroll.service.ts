import { NotificationService } from "../notification/services/notification.service.js";
import { payrollService as calculator } from "./core/calculator.js";
import { calculateRetroactive } from "./core/retroactive.js";
import { logAuditEvent, AuditEventType } from "../audit/services/audit.service.js";
import { PayPeriod, PeriodStatus } from "./entities/payroll.entity.js";
import { PayrollRepository } from "./repositories/payroll.repository.js";

export { PeriodStatus } from "./entities/payroll.entity.js";

export class PayrollService {
  /**
   * Initialize or fetch a period; creates new row with OPEN status if missing.
   */
  static async getOrCreatePeriod(
    year: number,
    month: number,
  ): Promise<PayPeriod> {
    const existing = await PayrollRepository.findPeriodByMonthYear(month, year);
    if (existing) return existing;

    const insertId = await PayrollRepository.insertPeriod(
      month,
      year,
      PeriodStatus.OPEN,
    );

    await logAuditEvent({
      eventType: AuditEventType.PERIOD_CREATE,
      entityType: "period",
      entityId: insertId,
      actorId: null,
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

          const grandTotal =
            currentResult.netPayment + (currentResult.retroactiveTotal || 0);

          if (grandTotal > 0 || currentResult.netPayment > 0) {
            await calculator.savePayout({
              conn,
              periodId,
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

      // Send notifications based on workflow transition
      await sendWorkflowNotification(nextStatus, month, year, conn);

      await PayrollRepository.updatePeriodStatus(periodId, nextStatus, conn);
      if (action === "SUBMIT") {
        await PayrollRepository.updatePeriodFreeze(periodId, true, actorId, conn);
      }
      if (action === "REJECT") {
        await PayrollRepository.updatePeriodFreeze(periodId, false, null, conn);
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

      await logAuditEvent({
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
        await logAuditEvent({
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
        await logAuditEvent({
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
   * Fetch period summary by id.
   */
  static async getPeriodById(periodId: number) {
    return PayrollRepository.findPeriodById(periodId);
  }

  /**
   * List all periods (newest first).
   */
  static async getAllPeriods(): Promise<PayPeriod[]> {
    await PayrollService.ensureCurrentPeriod();
    return PayrollRepository.findAllPeriods();
  }

  static async ensureCurrentPeriod(): Promise<void> {
    const now = new Date();
    await PayrollService.getOrCreatePeriod(
      now.getFullYear(),
      now.getMonth() + 1,
    );
  }

  static async getPeriodDetail(periodId: number) {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");
    const items = await PayrollRepository.findPeriodItems(periodId);
    return { period, items };
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

      await logAuditEvent({
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

      await logAuditEvent({
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
    return PayrollRepository.findPayoutsByPeriod(periodId);
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

  // ============================================================================
  // Leave Pay Exceptions & Return Reports (PTS_OFFICER)
  // ============================================================================

  static async createLeavePayException(
    citizenId: string,
    startDate: string,
    endDate: string,
    reason: string | null,
    actorId: number,
  ) {
    const insertId = await PayrollRepository.insertLeavePayException(
      citizenId,
      startDate,
      endDate,
      reason,
      actorId,
    );
    return { exception_id: insertId };
  }

  static async listLeavePayExceptions(citizenId?: string) {
    return PayrollRepository.findLeavePayExceptions(citizenId);
  }

  static async deleteLeavePayException(exceptionId: number) {
    return PayrollRepository.deleteLeavePayException(exceptionId);
  }

  static async createLeaveReturnReport(
    leaveRecordId: number,
    returnDate: string,
    remark: string | null,
    actorId: number,
  ) {
    const leaveRecord =
      await PayrollRepository.findLeaveRecordById(leaveRecordId);
    if (!leaveRecord) throw new Error("Leave record not found");
    if (leaveRecord.leave_type !== "education") {
      throw new Error("Return report is only allowed for education leave");
    }

    const citizenId = leaveRecord.citizen_id as string;
    const insertId = await PayrollRepository.insertLeaveReturnReport(
      leaveRecordId,
      citizenId,
      returnDate,
      remark,
      actorId,
    );
    return { report_id: insertId };
  }

  static async listLeaveReturnReports(params: {
    citizenId?: string;
    leaveRecordId?: number;
  }) {
    return PayrollRepository.findLeaveReturnReports(params);
  }

  static async deleteLeaveReturnReport(reportId: number) {
    return PayrollRepository.deleteLeaveReturnReport(reportId);
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

function resolveNextStatus(
  action: string,
  currentStatus: PeriodStatus,
): PeriodStatus {
  if (action === "SUBMIT" && currentStatus === PeriodStatus.OPEN) {
    return PeriodStatus.WAITING_HR;
  }
  if (action === "APPROVE_HR" && currentStatus === PeriodStatus.WAITING_HR) {
    return PeriodStatus.WAITING_HEAD_FINANCE;
  }
  if (
    action === "APPROVE_HEAD_FINANCE" &&
    currentStatus === PeriodStatus.WAITING_HEAD_FINANCE
  ) {
    return PeriodStatus.WAITING_DIRECTOR;
  }
  if (
    action === "APPROVE_DIRECTOR" &&
    currentStatus === PeriodStatus.WAITING_DIRECTOR
  ) {
    return PeriodStatus.CLOSED;
  }
  if (action === "REJECT") {
    return PeriodStatus.OPEN;
  }
  throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
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
      conn,
    );
  }
}
