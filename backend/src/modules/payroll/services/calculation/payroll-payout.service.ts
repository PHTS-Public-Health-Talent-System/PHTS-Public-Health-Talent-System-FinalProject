import { PoolConnection } from "mysql2/promise";
import { Decimal } from "decimal.js";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import { formatLocalDate } from "@/modules/payroll/core/utils/date.utils.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { PayrollQueryRepository } from "@/modules/payroll/repositories/query.repository.js";
import { buildPayrollLeaveImpactSummary } from "@/modules/payroll/services/calculation/payroll-leave-impact.service.js";
import { PayrollWorkflowService } from "@/modules/payroll/services/workflow/payroll-workflow.service.js";
import { formatDateOnly } from "@/shared/utils/date-only.js";

type RateBreakdownSegment = {
  start_date: string;
  end_date: string;
  days: number;
  rate: number;
  amount: number;
  eligibility_id?: number | null;
  master_rate_id?: number | null;
  group_no?: number | null;
  item_no?: number | null;
  sub_item_no?: number | null;
};

const toDateOnly = (value: unknown): string => {
  if (!value) return "";
  try {
    return formatDateOnly(value as Date | string, {
      timezone: process.env.DB_TIMEZONE || "+07:00",
    });
  } catch {
    return String(value).slice(0, 10);
  }
};

const buildRateBreakdown = (params: {
  monthStart: string;
  monthEnd: string;
  daysInMonth: number;
  eligibilityRows: any[];
}): RateBreakdownSegment[] => {
  const { monthStart, monthEnd, daysInMonth, eligibilityRows } = params;
  if (daysInMonth <= 0 || !eligibilityRows.length) return [];

  const eligibilities = eligibilityRows
    .map((row) => ({
      eligibilityId: Number((row as any).eligibility_id ?? 0) || null,
      masterRateId:
        Number((row as any).master_rate_id ?? (row as any).rate_id ?? 0) || null,
      groupNo: Number((row as any).group_no ?? 0) || null,
      itemNo: Number((row as any).item_no ?? 0) || null,
      subItemNo: Number((row as any).sub_item_no ?? 0) || null,
      start: toDateOnly((row as any).effective_date),
      end: (row as any).expiry_date ? toDateOnly((row as any).expiry_date) : monthEnd,
      rate: Number((row as any).rate ?? 0),
    }))
    .filter((row) => row.start && row.end && row.rate > 0)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!eligibilities.length) return [];

  const dailyMap = new Map<
    string,
    {
      rate: number;
      eligibilityId: number | null;
      masterRateId: number | null;
      groupNo: number | null;
      itemNo: number | null;
      subItemNo: number | null;
    }
  >();
  const cursor = new Date(`${monthStart}T00:00:00`);
  const monthEndDate = new Date(`${monthEnd}T00:00:00`);
  while (cursor <= monthEndDate) {
    const day = formatLocalDate(cursor);
    const active = eligibilities
      .filter((elig) => day >= elig.start && day <= elig.end)
      .sort((a, b) => a.start.localeCompare(b.start))
      .at(-1);
    if (active && active.rate > 0) {
      dailyMap.set(day, {
        rate: active.rate,
        eligibilityId: active.eligibilityId,
        masterRateId: active.masterRateId,
        groupNo: active.groupNo,
        itemNo: active.itemNo,
        subItemNo: active.subItemNo,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const segments: Array<{
    start: string;
    end: string;
    days: number;
    rate: number;
    eligibilityId: number | null;
    masterRateId: number | null;
    groupNo: number | null;
    itemNo: number | null;
    subItemNo: number | null;
  }> = [];
  for (const [day, active] of Array.from(dailyMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const last = segments[segments.length - 1];
    const isSameSegment =
      last &&
      last.rate === active.rate &&
      last.eligibilityId === active.eligibilityId &&
      last.masterRateId === active.masterRateId &&
      last.groupNo === active.groupNo &&
      last.itemNo === active.itemNo &&
      last.subItemNo === active.subItemNo;
    if (!isSameSegment) {
      segments.push({
        start: day,
        end: day,
        days: 1,
        rate: active.rate,
        eligibilityId: active.eligibilityId,
        masterRateId: active.masterRateId,
        groupNo: active.groupNo,
        itemNo: active.itemNo,
        subItemNo: active.subItemNo,
      });
      continue;
    }
    const nextOfLast = new Date(`${last.end}T00:00:00`);
    nextOfLast.setDate(nextOfLast.getDate() + 1);
    const expected = formatLocalDate(nextOfLast);
    if (day === expected) {
      last.end = day;
      last.days += 1;
    } else {
      segments.push({
        start: day,
        end: day,
        days: 1,
        rate: active.rate,
        eligibilityId: active.eligibilityId,
        masterRateId: active.masterRateId,
        groupNo: active.groupNo,
        itemNo: active.itemNo,
        subItemNo: active.subItemNo,
      });
    }
  }

  return segments.map((segment) => ({
    start_date: segment.start,
    end_date: segment.end,
    days: segment.days,
    rate: segment.rate,
    amount: Number(((segment.rate / daysInMonth) * segment.days).toFixed(2)),
    eligibility_id: segment.eligibilityId,
    master_rate_id: segment.masterRateId,
    group_no: segment.groupNo,
    item_no: segment.itemNo,
    sub_item_no: segment.subItemNo,
  }));
};

type PayoutEditPayload = {
  eligible_days?: number;
  deducted_days?: number;
  retroactive_amount?: number;
  remark?: string | null;
};

type ResolvedPayoutValues = {
  eligibleDays: number;
  deductedDays: number;
  retroactiveAmount: number;
  remark: string | null;
};

export class PayrollPayoutService {
  static async searchPayouts(params: {
    q: string;
    periodYear?: number;
    periodMonth?: number;
    role?: string | null;
  }) {
    const rows = await PayrollRepository.searchPayouts(params);
    return rows
      .filter((row: any) =>
        PayrollWorkflowService.canRoleViewPeriod(
          params.role,
          String(row?.period_status ?? ""),
        ),
      )
      .map(({ period_status: _ignore, ...row }: any) => row);
  }

  static async getPeriodPayouts(periodId: number) {
    const payouts = await PayrollRepository.findPayoutsByPeriod(periodId);
    if (!payouts.length) return payouts;

    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) return payouts;

    const month = Number(period.period_month ?? 0);
    const rawYear = Number(period.period_year ?? 0);
    const year = rawYear > 2400 ? rawYear - 543 : rawYear;
    if (month <= 0 || year <= 0) return payouts;

    const citizenIds = Array.from(
      new Set(
        payouts
          .map((row: any) => String(row?.citizen_id ?? "").trim())
          .filter(Boolean),
      ),
    );
    if (!citizenIds.length) return payouts;

    // leave_quotas/leave-domain use Buddhist fiscal year (e.g. 2568)
    const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const conn = await PayrollRepository.getConnection();
    try {
      const batchData = await PayrollQueryRepository.fetchBatchData(
        citizenIds,
        startOfMonth,
        endOfMonth,
        fiscalYear,
        conn,
      );
      const leaveCountsByCitizenId = new Map<
        string,
        { leaveCountInPeriod: number; educationLeaveCountInPeriod: number }
      >();

      for (const leave of batchData.leaveRows as any[]) {
        const citizenId = String(leave?.citizen_id ?? "").trim();
        if (!citizenId) continue;
        const current = leaveCountsByCitizenId.get(citizenId) ?? {
          leaveCountInPeriod: 0,
          educationLeaveCountInPeriod: 0,
        };
        current.leaveCountInPeriod += 1;
        if (String(leave?.leave_type ?? "").trim().toLowerCase() === "education") {
          current.educationLeaveCountInPeriod += 1;
        }
        leaveCountsByCitizenId.set(citizenId, current);
      }

      return payouts.map((row: any) => {
        const citizenId = String(row?.citizen_id ?? "").trim();
        const leaveInfo = leaveCountsByCitizenId.get(citizenId);
        return {
          ...row,
          leave_count_in_period: leaveInfo?.leaveCountInPeriod ?? 0,
          education_leave_count_in_period: leaveInfo?.educationLeaveCountInPeriod ?? 0,
        };
      });
    } finally {
      conn.release();
    }
  }

  static async getPayoutDetail(
    payoutId: number,
    role?: string | null,
  ) {
    const payout = await PayrollRepository.findPayoutDetailById(payoutId);
    if (!payout) throw new Error("Payout not found");
    if (
      !PayrollWorkflowService.canRoleViewPeriod(
        role,
        String((payout as any).period_status ?? ""),
      )
    ) {
      throw new Error("Forbidden period access");
    }
    const items = await PayrollRepository.findPayoutItemsByPayoutId(payoutId);
    const checksRaw =
      await PayrollRepository.findPayoutChecksByPayoutId(payoutId);
    const referencedRateIds = new Set<number>();
    for (const row of checksRaw as any[]) {
      const evidenceRaw = row?.evidence_json;
      let evidenceList: unknown[] = [];
      if (Array.isArray(evidenceRaw)) {
        evidenceList = evidenceRaw;
      } else if (typeof evidenceRaw === "string" && evidenceRaw.trim()) {
        try {
          evidenceList = JSON.parse(evidenceRaw);
        } catch {
          evidenceList = [];
        }
      }
      for (const evidence of evidenceList) {
        if (!evidence || typeof evidence !== "object") continue;
        const ev = evidence as any;
        if (String(ev.type ?? "") !== "eligibility") continue;
        const rateId = Number(ev.rate_id ?? 0);
        if (Number.isFinite(rateId) && rateId > 0) referencedRateIds.add(rateId);
      }
    }
    const rateMetaById = new Map<number, { group_no: unknown; item_no: unknown; sub_item_no: unknown }>();
    if (referencedRateIds.size > 0) {
      const rows = await PayrollRepository.findPaymentRatesByIds(Array.from(referencedRateIds));
      for (const row of rows as any[]) {
        const rateId = Number(row?.rate_id ?? 0);
        if (!Number.isFinite(rateId) || rateId <= 0) continue;
        rateMetaById.set(rateId, {
          group_no: row?.group_no ?? null,
          item_no: row?.item_no ?? null,
          sub_item_no: row?.sub_item_no ?? null,
        });
      }
    }
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
      const normalizedEvidence = evidence.map((item) => {
        if (!item || typeof item !== "object") return item;
        const ev = item as any;
        if (String(ev.type ?? "") !== "eligibility") return item;
        const rateId = Number(ev.rate_id ?? 0);
        if (!Number.isFinite(rateId) || rateId <= 0) return item;
        const meta = rateMetaById.get(rateId);
        if (!meta) return item;
        return {
          ...ev,
          group_no: meta.group_no,
          item_no: meta.item_no,
          sub_item_no: meta.sub_item_no,
        };
      });
      const { evidence_json: _ignore, ...rest } = row;
      return { ...rest, evidence: normalizedEvidence };
    });

    let leaveImpactSummary;
    let rateBreakdown: RateBreakdownSegment[] = [];
    const citizenId = String((payout as any).citizen_id ?? "").trim();
    const month = Number((payout as any).period_month ?? 0);
    const rawYear = Number((payout as any).period_year ?? 0);
    const year = rawYear > 2400 ? rawYear - 543 : rawYear;
    if (citizenId && month > 0 && year > 0) {
      // leave_quotas/leave-domain use Buddhist fiscal year (e.g. 2568)
      const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const conn = await PayrollRepository.getConnection();
      try {
        const holidayRows = await PayrollRepository.findHolidayDatesInRange(
          formatLocalDate(startOfMonth),
          formatLocalDate(endOfMonth),
        );
        const batchData = await PayrollQueryRepository.fetchBatchData(
          [citizenId],
          startOfMonth,
          endOfMonth,
          fiscalYear,
          conn,
        );
        rateBreakdown = buildRateBreakdown({
          monthStart: formatLocalDate(startOfMonth),
          monthEnd: formatLocalDate(endOfMonth),
          daysInMonth: endOfMonth.getDate(),
          eligibilityRows: (batchData.eligibilityRows as any[]) ?? [],
        });
        leaveImpactSummary = buildPayrollLeaveImpactSummary({
          year,
          month,
          baseRate: Number((payout as any).pts_rate_snapshot ?? 0),
          leaveRows: batchData.leaveRows as any[],
          quotaRow: (batchData.quotaRows?.[0] as any) ?? null,
          holidays: (holidayRows ?? []).map((row: any) =>
            String(row?.holiday_date ?? "").slice(0, 10),
          ),
          movementRows: batchData.movementRows as any[],
          noSalaryRows: batchData.noSalaryRows as any[],
          returnReportRows: batchData.returnReportRows,
        });
      } finally {
        conn.release();
      }
    }

    return { payout, items, checks, leaveImpactSummary, rateBreakdown };
  }

  static async updatePayout(
    payoutId: number,
    payload: PayoutEditPayload,
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
      const isLocked = Boolean((ctx as any).is_locked);
      if (periodStatus !== PeriodStatus.OPEN || isLocked) {
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

      const nextValues = resolvePayoutValues(ctx, payload, daysInMonth);

      const baseRate = Number((ctx as any).pts_rate_snapshot ?? 0);
      const calculatedAmount = new Decimal(baseRate)
        .div(daysInMonth)
        .mul(nextValues.eligibleDays)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const totalPayable = new Decimal(calculatedAmount)
        .plus(nextValues.retroactiveAmount)
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
          nextValues.eligibleDays,
          nextValues.deductedDays,
          nextValues.retroactiveAmount,
          calculatedAmount,
          totalPayable,
          nextValues.remark,
          payoutId,
        ],
      );

      await syncPayoutItems(conn, {
        payoutId,
        month,
        rawYear,
        calculatedAmount,
        retroactiveAmount: nextValues.retroactiveAmount,
      });

      const totals = await PayrollRepository.sumPayResultsByPeriod(
        periodId,
        conn,
      );
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
        eligible_days: nextValues.eligibleDays,
        deducted_days: nextValues.deductedDays,
        calculated_amount: calculatedAmount,
        retroactive_amount: nextValues.retroactiveAmount,
        total_payable: totalPayable,
        remark: nextValues.remark,
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

    const total = await PayrollRepository.findPayResultCountByPeriod(periodId);
    if (total === 0) throw new Error("Period not calculated");

    return PayrollRepository.findProfessionSummaryByPeriod(periodId);
  }
}

function resolvePayoutValues(
  ctx: any,
  payload: PayoutEditPayload,
  daysInMonth: number,
): ResolvedPayoutValues {
  const eligibleDays =
    payload.eligible_days !== undefined
      ? Number(payload.eligible_days)
      : Number(ctx.eligible_days ?? 0);
  const deductedDays =
    payload.deducted_days !== undefined
      ? Number(payload.deducted_days)
      : Number(ctx.deducted_days ?? 0);
  const retroactiveAmount =
    payload.retroactive_amount !== undefined
      ? Number(payload.retroactive_amount)
      : Number(ctx.retroactive_amount ?? 0);
  const remark =
    payload.remark !== undefined ? payload.remark : (ctx.remark ?? null);

  if (!Number.isFinite(eligibleDays) || eligibleDays < 0) {
    throw new Error("eligible_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0");
  }
  if (!Number.isFinite(deductedDays) || deductedDays < 0) {
    throw new Error("deducted_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0");
  }
  if (eligibleDays > daysInMonth) {
    throw new Error(`eligible_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`);
  }
  if (deductedDays > daysInMonth) {
    throw new Error(`deducted_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`);
  }
  if (eligibleDays + deductedDays > daysInMonth) {
    throw new Error(
      `eligible_days + deducted_days ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`,
    );
  }
  if (!Number.isFinite(retroactiveAmount)) {
    throw new Error("retroactive_amount ต้องเป็นตัวเลข");
  }

  return {
    eligibleDays,
    deductedDays,
    retroactiveAmount,
    remark,
  };
}

async function syncPayoutItems(
  conn: PoolConnection,
  params: {
    payoutId: number;
    month: number;
    rawYear: number;
    calculatedAmount: number;
    retroactiveAmount: number;
  },
): Promise<void> {
  const { payoutId, month, rawYear, calculatedAmount, retroactiveAmount } = params;
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
  const currentItemId = currentRows?.[0]?.item_id
    ? Number(currentRows[0].item_id)
    : null;
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

  const retroDelta = new Decimal(retroactiveAmount)
    .minus(retroSumExcludingManual)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

  if (Math.abs(retroDelta) <= 0.01) {
    return;
  }
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
