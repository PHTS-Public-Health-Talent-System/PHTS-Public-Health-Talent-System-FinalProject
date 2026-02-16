import { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from '@config/database.js';
import { calculateMonthly, RetroDetail } from '@/modules/payroll/core/calculator.js';

const shiftMonth = (year: number, month: number, offset: number) => {
  let targetMonth = month - offset;
  let targetYear = year;
  if (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  return { targetMonth, targetYear };
};

const calculateRetroForPeriod = async (
  dbConn: Pick<PoolConnection, "query">,
  citizenId: string,
  targetYear: number,
  targetMonth: number,
  connection?: PoolConnection,
): Promise<{ diff: number; detail: RetroDetail } | null> => {
  const [periodRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT period_id, status FROM pay_periods WHERE period_month = ? AND period_year = ?`,
    [targetMonth, targetYear],
  );
  if (!Array.isArray(periodRows) || periodRows.length === 0) return null;
  const period = periodRows[0] as any;
  if (period.status && period.status !== "CLOSED") return null;

  const [payoutRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT calculated_amount FROM pay_results WHERE citizen_id = ? AND period_id = ?`,
    [citizenId, period.period_id],
  );
  const originalPaid = payoutRows.length
    ? Number((payoutRows[0] as any).calculated_amount)
    : 0;

  const [adjustmentRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT pi.item_type, pi.amount
      FROM pay_result_items pi
      JOIN pay_results p ON pi.payout_id = p.payout_id
      WHERE p.citizen_id = ?
        AND pi.reference_month = ?
        AND pi.reference_year = ?
        AND pi.item_type IN ('RETROACTIVE_ADD', 'RETROACTIVE_DEDUCT')
    `,
    [citizenId, targetMonth, targetYear],
  );

  let historicalAdjustment = 0;
  if (Array.isArray(adjustmentRows)) {
    for (const adj of adjustmentRows as any[]) {
      if (adj.item_type === "RETROACTIVE_ADD") {
        historicalAdjustment += Number(adj.amount);
      } else if (adj.item_type === "RETROACTIVE_DEDUCT") {
        historicalAdjustment -= Number(adj.amount);
      }
    }
  }

  const paidAmount = originalPaid + historicalAdjustment;
  const recalculated = await calculateMonthly(
    citizenId,
    targetYear,
    targetMonth,
    connection,
  );
  const shouldBeAmount = recalculated.netPayment;
  const diff = Number.parseFloat((shouldBeAmount - paidAmount).toFixed(2));

  if (Math.abs(diff) <= 0.01) return null;

  return {
    diff,
    detail: {
      month: targetMonth,
      year: targetYear,
      diff,
      remark: `ตกเบิกยอดเดือน ${targetMonth}/${targetYear}`,
    },
  };
};

export async function calculateRetroactive(
  citizenId: string,
  currentYear: number,
  currentMonth: number,
  lookBackMonths = 6,
  connection?: PoolConnection,
): Promise<{ totalRetro: number; retroDetails: RetroDetail[] }> {
  let totalRetro = 0;
  const retroDetails: RetroDetail[] = [];
  const dbConn: Pick<PoolConnection, "query"> = connection ?? pool;

  for (let i = 1; i <= lookBackMonths; i++) {
    const { targetMonth, targetYear } = shiftMonth(
      currentYear,
      currentMonth,
      i,
    );
    const result = await calculateRetroForPeriod(
      dbConn,
      citizenId,
      targetYear,
      targetMonth,
      connection,
    );
    if (!result) continue;
    totalRetro += result.diff;
    retroDetails.push(result.detail);
  }

  return { totalRetro: Number.parseFloat(totalRetro.toFixed(2)), retroDetails };
}
