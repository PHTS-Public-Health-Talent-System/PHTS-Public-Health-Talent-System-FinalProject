/**
 * PHTS System - Finance Payment Service
 *
 * Handles payment status updates, batch payments, and cancellations.
 */

import { FinanceRepository } from '@/modules/finance/repositories/finance.repository.js';
import {
  PaymentStatus,
} from '@/modules/finance/entities/finance.entity.js';
import type { PayoutWithDetails, BatchPaymentResult } from '@/modules/finance/entities/finance.entity.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

// Re-export for backward compatibility
export { PaymentStatus } from '@/modules/finance/entities/finance.entity.js';
export type { PayoutWithDetails } from '@/modules/finance/entities/finance.entity.js';

const ensureReportablePeriod = (params: { periodStatus: string; isFrozen: number | boolean }) => {
  const isClosed = params.periodStatus === 'CLOSED';
  const isFrozen = params.isFrozen === true || Number(params.isFrozen) === 1;
  if (!isClosed || !isFrozen) {
    throw new Error('งวดนี้ยังไม่ผ่านการอนุมัติปิดรอบจากผู้บริหาร');
  }
};

/**
 * Mark a single payout as paid
 */
export async function markPayoutAsPaid(
  payoutId: number,
  paidByUserId: number,
  _comment?: string,
): Promise<void> {
  const conn = await FinanceRepository.getConnection();
  try {
    await conn.beginTransaction();

    // Check current status
    const payout = await FinanceRepository.findPayoutWorkflowContextByIdForUpdate(
      payoutId,
      conn,
    );

    if (!payout) {
      throw new Error(`Payout ${payoutId} not found`);
    }
    ensureReportablePeriod({
      periodStatus: String(payout.period_status ?? ''),
      isFrozen: payout.is_frozen,
    });
    if (payout.payment_status === PaymentStatus.PAID) {
      throw new Error(`Payout ${payoutId} is already marked as paid`);
    }
    if (payout.payment_status === PaymentStatus.CANCELLED) {
      throw new Error(`Payout ${payoutId} is cancelled`);
    }

    // Update status
    await FinanceRepository.updatePayoutStatus(
      payoutId,
      PaymentStatus.PAID,
      paidByUserId,
      conn,
    );

    // Log audit
    await emitAuditEvent(
      {
        eventType: AuditEventType.PAYOUT_MARK_PAID,
        entityType: "PAYOUT",
        entityId: payoutId,
        actorId: paidByUserId,
        actionDetail: {
          message: `Marked payout ${payoutId} as PAID`,
          payoutId,
        },
      },
      conn,
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Batch mark payouts as paid
 */
export async function batchMarkAsPaid(
  payoutIds: number[],
  paidByUserId: number,
): Promise<BatchPaymentResult> {
  const result: BatchPaymentResult = {
    success: [],
    failed: [],
  };

  const conn = await FinanceRepository.getConnection();
  try {
    await conn.beginTransaction();

    for (const payoutId of payoutIds) {
      try {
        const payout = await FinanceRepository.findPayoutWorkflowContextByIdForUpdate(
          payoutId,
          conn,
        );

        if (!payout) {
          result.failed.push({ id: payoutId, reason: "Payout not found" });
          continue;
        }
        try {
          ensureReportablePeriod({
            periodStatus: String(payout.period_status ?? ''),
            isFrozen: payout.is_frozen,
          });
        } catch (error: any) {
          result.failed.push({ id: payoutId, reason: error.message });
          continue;
        }
        if (payout.payment_status === PaymentStatus.PAID) {
          result.failed.push({ id: payoutId, reason: "Already paid" });
          continue;
        }
        if (payout.payment_status === PaymentStatus.CANCELLED) {
          result.failed.push({ id: payoutId, reason: "Cancelled" });
          continue;
        }

        await FinanceRepository.updatePayoutStatus(
          payoutId,
          PaymentStatus.PAID,
          paidByUserId,
          conn,
        );
        result.success.push(payoutId);
      } catch (err: any) {
        result.failed.push({ id: payoutId, reason: err.message });
      }
    }

    if (result.success.length > 0) {
      await emitAuditEvent(
        {
          eventType: AuditEventType.PAYOUT_MARK_PAID,
          entityType: "PAYOUT_BATCH",
          actorId: paidByUserId,
          actionDetail: {
            message: `Batch marked ${result.success.length} payouts as PAID`,
            count: result.success.length,
            ids: result.success,
          },
        },
        conn,
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return result;
}

/**
 * Mark payout as cancelled
 */
export async function cancelPayout(
  payoutId: number,
  cancelledByUserId: number,
  reason: string,
): Promise<void> {
  const conn = await FinanceRepository.getConnection();
  try {
    await conn.beginTransaction();

    const payout = await FinanceRepository.findPayoutWorkflowContextByIdForUpdate(
      payoutId,
      conn,
    );

    if (!payout) {
      throw new Error(`Payout ${payoutId} not found`);
    }
    ensureReportablePeriod({
      periodStatus: String(payout.period_status ?? ''),
      isFrozen: payout.is_frozen,
    });
    if (payout.payment_status === PaymentStatus.PAID) {
      throw new Error(`Cannot cancel PAID payout ${payoutId}`);
    }

    await FinanceRepository.updatePayoutStatus(
      payoutId,
      PaymentStatus.CANCELLED,
      null,
      conn,
    );

    await emitAuditEvent(
      {
        eventType: AuditEventType.PAYOUT_CANCEL,
        entityType: "PAYOUT",
        entityId: payoutId,
        actorId: cancelledByUserId,
        actionDetail: {
          message: `Cancelled payout ${payoutId}: ${reason}`,
          payoutId,
          reason,
        },
      },
      conn,
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Get payouts for a specific period with filtering
 */
export async function getPayoutsByPeriod(
  periodId: number,
  status?: PaymentStatus,
  search?: string,
): Promise<PayoutWithDetails[]> {
  const period = await FinanceRepository.findPeriodWorkflowContextById(periodId);
  if (!period) {
    throw new Error(`Period ${periodId} not found`);
  }
  ensureReportablePeriod({
    periodStatus: String(period.status ?? ''),
    isFrozen: period.is_frozen,
  });
  return FinanceRepository.findPayoutsByPeriod(periodId, status, search);
}
