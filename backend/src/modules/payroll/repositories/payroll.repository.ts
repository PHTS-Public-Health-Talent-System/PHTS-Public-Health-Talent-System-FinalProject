import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from "@config/database.js";
import {
  PayPeriod,
  PeriodStatus,
  SnapshotStatus,
} from "@/modules/payroll/entities/payroll.entity.js";
import { PayrollPeriodRepository } from "@/modules/payroll/repositories/period.repository.js";
import { PayrollPayoutRepository } from "@/modules/payroll/repositories/payout.repository.js";
import {
  PayrollQueryRepository,
  BatchEmployeeData,
} from "@/modules/payroll/repositories/query.repository.js";

export type { BatchEmployeeData };

export class PayrollRepository {
  static buildListPeriodsQuery(): string {
    return PayrollPeriodRepository.buildListPeriodsQuery();
  }

  static async findPeriodByMonthYear(
    month: number,
    year: number,
  ): Promise<PayPeriod | null> {
    return PayrollPeriodRepository.findPeriodByMonthYear(month, year);
  }

  static async insertPeriod(
    month: number,
    year: number,
    status: PeriodStatus,
    createdBy?: number | null,
  ): Promise<number> {
    return PayrollPeriodRepository.insertPeriod(month, year, status, createdBy);
  }

  static async findPeriodById(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<PayPeriod | null> {
    return PayrollPeriodRepository.findPeriodById(periodId, conn);
  }

  static async findPeriodByIdForUpdate(
    periodId: number,
    conn: PoolConnection,
  ): Promise<PayPeriod | null> {
    return PayrollPeriodRepository.findPeriodByIdForUpdate(periodId, conn);
  }

  static async findAllPeriods(): Promise<PayPeriod[]> {
    return PayrollPeriodRepository.findAllPeriods();
  }

  static async findPeriodsByStatus(
    status: PeriodStatus,
    limit = 10,
  ): Promise<PayPeriod[]> {
    return PayrollPeriodRepository.findPeriodsByStatus(status, limit);
  }

  static async findPeriodItems(periodId: number): Promise<RowDataPacket[]> {
    return PayrollPeriodRepository.findPeriodItems(periodId);
  }

  static async findPeriodItemCitizenIds(
    periodId: number,
    conn: PoolConnection,
  ): Promise<string[]> {
    return PayrollPeriodRepository.findPeriodItemCitizenIds(periodId, conn);
  }

  static async insertPeriodItem(
    periodId: number,
    requestId: number,
    userId: number | null,
    citizenId: string,
    snapshotId: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.insertPeriodItem(
      periodId,
      requestId,
      userId,
      citizenId,
      snapshotId,
      conn,
    );
  }

  static async deletePeriodItem(
    periodId: number,
    itemId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.deletePeriodItem(periodId, itemId, conn);
  }

  static async findRequestCitizenId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<string | null> {
    return PayrollPeriodRepository.findRequestCitizenId(requestId, conn);
  }

  static async findRequestUserId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<number | null> {
    return PayrollPeriodRepository.findRequestUserId(requestId, conn);
  }

  static async findUserIdMapByCitizenIds(
    citizenIds: string[],
    conn: PoolConnection,
  ): Promise<Map<string, number>> {
    return PayrollPeriodRepository.findUserIdMapByCitizenIds(citizenIds, conn);
  }

  static async findLatestVerificationSnapshotId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<number | null> {
    return PayrollPeriodRepository.findLatestVerificationSnapshotId(requestId, conn);
  }

  static async updatePeriodTotals(
    periodId: number,
    totalAmount: number,
    headCount: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.updatePeriodTotals(
      periodId,
      totalAmount,
      headCount,
      conn,
    );
  }

  static async updatePeriodStatus(
    periodId: number,
    status: PeriodStatus,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.updatePeriodStatus(periodId, status, conn);
  }

  static async updatePeriodFreeze(
    periodId: number,
    isFrozen: boolean,
    actorId: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.updatePeriodFreeze(
      periodId,
      isFrozen,
      actorId,
      conn,
    );
  }

  static async updatePeriodLock(
    periodId: number,
    isLocked: boolean,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.updatePeriodLock(periodId, isLocked, conn);
  }

  static async updatePeriodSnapshotStatus(
    periodId: number,
    status: SnapshotStatus,
    conn: PoolConnection,
    options?: { readyAt?: Date | null },
  ): Promise<void> {
    return PayrollPeriodRepository.updatePeriodSnapshotStatus(
      periodId,
      status,
      conn,
      options,
    );
  }

  static async findRequiredProfessionCodesByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollPeriodRepository.findRequiredProfessionCodesByPeriod(periodId, conn);
  }

  static async findReviewedProfessionCodesByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollPeriodRepository.findReviewedProfessionCodesByPeriod(periodId, conn);
  }

  static async setProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.setProfessionReview(
      periodId,
      professionCode,
      reviewed,
      actorId,
      conn,
    );
  }

  static async clearProfessionReviewsByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.clearProfessionReviewsByPeriod(periodId, conn);
  }

  static async deletePayResultsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPayoutRepository.deletePayResultsByPeriod(periodId, conn);
  }

  static async deletePayResultChecksByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPayoutRepository.deletePayResultChecksByPeriod(periodId, conn);
  }

  static async deletePayResultItemsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPayoutRepository.deletePayResultItemsByPeriod(periodId, conn);
  }

  static async deletePeriodItemsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.deletePeriodItemsByPeriod(periodId, conn);
  }

  static async deletePeriodById(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    return PayrollPeriodRepository.deletePeriodById(periodId, conn);
  }

  static async findPayoutEditContextByIdForUpdate(
    payoutId: number,
    conn: PoolConnection,
  ): Promise<RowDataPacket | null> {
    return PayrollPayoutRepository.findPayoutEditContextByIdForUpdate(
      payoutId,
      conn,
    );
  }

  static async sumPayResultsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<{ totalAmount: number; headCount: number }> {
    return PayrollPayoutRepository.sumPayResultsByPeriod(periodId, conn);
  }

  static async findPayoutsByPeriod(periodId: number): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.findPayoutsByPeriod(periodId);
  }

  static async findPayoutChecksByPayoutId(payoutId: number): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.findPayoutChecksByPayoutId(payoutId);
  }

  static async findPaymentRatesByIds(rateIds: number[]): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.findPaymentRatesByIds(rateIds);
  }

  static async findPayoutItemsByPayoutId(payoutId: number): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.findPayoutItemsByPayoutId(payoutId);
  }

  static async findPayoutDetailById(payoutId: number): Promise<RowDataPacket | null> {
    return PayrollPayoutRepository.findPayoutDetailById(payoutId);
  }

  static async findHolidayDatesInRange(
    startDate: string,
    endDate: string,
  ): Promise<RowDataPacket[]> {
    return PayrollQueryRepository.findHolidayDatesInRange(startDate, endDate);
  }

  static async findPayResultCountByPeriod(periodId: number): Promise<number> {
    return PayrollPayoutRepository.findPayResultCountByPeriod(periodId);
  }

  static async findProfessionSummaryByPeriod(
    periodId: number,
  ): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.findProfessionSummaryByPeriod(periodId);
  }

  static async searchPayouts(params: {
    q: string;
    periodYear?: number;
    periodMonth?: number;
  }): Promise<RowDataPacket[]> {
    return PayrollPayoutRepository.searchPayouts(params);
  }

  static async findHolidays(
    yearStart: number,
    yearEnd: number,
    conn: PoolConnection,
  ): Promise<RowDataPacket[]> {
    return PayrollQueryRepository.findHolidays(yearStart, yearEnd, conn);
  }

  static async findEligibleCitizenIds(
    year: number,
    month: number,
    conn: PoolConnection,
  ): Promise<string[]> {
    return PayrollQueryRepository.findEligibleCitizenIds(year, month, conn);
  }

  static async fetchBatchData(
    citizenIds: string[],
    startOfMonth: Date,
    endOfMonth: Date,
    fiscalYear: number,
    conn: PoolConnection,
  ): Promise<BatchEmployeeData> {
    return PayrollQueryRepository.fetchBatchData(
      citizenIds,
      startOfMonth,
      endOfMonth,
      fiscalYear,
      conn,
    );
  }

  static buildLeaveRowsQuery(ph: string): string {
    return PayrollQueryRepository.buildLeaveRowsQuery(ph);
  }

  static getFiscalYearRange(fiscalYear: number): { start: string; end: string } {
    return PayrollQueryRepository.getFiscalYearRange(fiscalYear);
  }

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
