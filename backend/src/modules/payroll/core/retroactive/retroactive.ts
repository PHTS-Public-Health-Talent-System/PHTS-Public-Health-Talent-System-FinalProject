import { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from '@config/database.js';
import { calculateMonthly, RetroDetail } from '@/modules/payroll/core/calculator/facade/calculator.js';

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
    `
      SELECT calculated_amount, deducted_days, eligible_days, pts_rate_snapshot
      FROM pay_results
      WHERE citizen_id = ? AND period_id = ?
    `,
    [citizenId, period.period_id],
  );
  const historicalPayout = payoutRows.length ? (payoutRows[0] as any) : null;
  const hasHistoricalPayout = Boolean(historicalPayout);
  const originalPaid = historicalPayout ? Number(historicalPayout.calculated_amount) : 0;

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

  const factorParts: string[] = [];
  const previousEligibleDays = hasHistoricalPayout
    ? Number(historicalPayout?.eligible_days ?? 0)
    : null;
  const previousDeductedDays = hasHistoricalPayout
    ? Number(historicalPayout?.deducted_days ?? 0)
    : null;
  const previousRate = hasHistoricalPayout
    ? Number(historicalPayout?.pts_rate_snapshot ?? 0)
    : null;
  const nextEligibleDays = Number(recalculated.eligibleDays ?? 0);
  const nextDeductedDays = Number(recalculated.totalDeductionDays ?? 0);
  const nextRate = Number(recalculated.rateSnapshot ?? 0);

  if (hasHistoricalPayout) {
    if (Math.abs(nextEligibleDays - Number(previousEligibleDays ?? 0)) > 0.01) {
      factorParts.push(
        `วันมีสิทธิ ${Number(previousEligibleDays ?? 0).toLocaleString("th-TH")} → ${nextEligibleDays.toLocaleString("th-TH")} วัน`,
      );
    }
    if (Math.abs(nextDeductedDays - Number(previousDeductedDays ?? 0)) > 0.01) {
      factorParts.push(
        `วันถูกหัก ${Number(previousDeductedDays ?? 0).toLocaleString("th-TH")} → ${nextDeductedDays.toLocaleString("th-TH")} วัน`,
      );
    }
    if (Math.abs(nextRate - Number(previousRate ?? 0)) > 0.01) {
      factorParts.push(
        `อัตราเงิน ${Number(previousRate ?? 0).toLocaleString("th-TH")} → ${nextRate.toLocaleString("th-TH")} บาท`,
      );
    }
  } else {
    if (nextEligibleDays > 0.01) {
      factorParts.push(
        `วันมีสิทธิ ไม่มีข้อมูลเดิม → ${nextEligibleDays.toLocaleString("th-TH")} วัน`,
      );
    }
    if (nextDeductedDays > 0.01) {
      factorParts.push(
        `วันถูกหัก ไม่มีข้อมูลเดิม → ${nextDeductedDays.toLocaleString("th-TH")} วัน`,
      );
    }
    if (nextRate > 0.01) {
      factorParts.push(
        `อัตราเงิน ไม่มีข้อมูลเดิม → ${nextRate.toLocaleString("th-TH")} บาท`,
      );
    }
  }
  if (factorParts.length === 0 && Array.isArray(recalculated.checks) && recalculated.checks.length > 0) {
    const topTitles = [...recalculated.checks]
      .sort(
        (a, b) => Math.abs(Number(b.impactAmount ?? 0)) - Math.abs(Number(a.impactAmount ?? 0)),
      )
      .slice(0, 2)
      .map((check) => String(check.title).trim())
      .filter(Boolean);
    if (topTitles.length > 0) {
      factorParts.push(`ตรวจพบ: ${topTitles.join(", ")}`);
    }
  }

  const comparisonText = hasHistoricalPayout
    ? `คำนวณใหม่ ${shouldBeAmount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} เทียบเคยจ่าย ${paidAmount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} บาท`
    : `คำนวณใหม่ ${shouldBeAmount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} บาท • ไม่พบข้อมูลจ่ายเดิมของงวดนี้`;
  const factorText = factorParts.length > 0 ? ` • ปัจจัย: ${factorParts.join(" / ")}` : "";

  return {
    diff,
    detail: {
      month: targetMonth,
      year: targetYear,
      diff,
      remark: `ตกเบิกยอดเดือน ${targetMonth}/${targetYear} • ${comparisonText}${factorText}`,
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
