import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { closePool, getConnection } from "@config/database.js";
import { PeriodStatus, PayResultItemType } from "@/modules/payroll/entities/payroll.entity.js";
import { deriveImportedPayoutMetrics, resolveImportedRateId, type ImportedRateRow } from "@/modules/payroll/services/import/payroll-import-mapping.js";

type BatchRow = {
  batch_id: number;
  period_month: number;
  period_year: number;
  status: string;
  matched_rows: number;
  unmatched_rows: number;
  ambiguous_rows: number;
};

type ImportRow = {
  import_row_id: number;
  matched_citizen_id: string;
  matched_user_id: number | null;
  matched_profession_code: string | null;
  source_group_no: string | null;
  source_clause: string | null;
  source_item_no: string | null;
  announced_rate: number | null;
  monthly_amount: number | null;
  retroactive_amount: number | null;
  total_amount: number | null;
  note: string | null;
  first_name: string;
  last_name: string;
};

const buildUnresolvedRateReason = (row: ImportRow): string => {
  const groupNo = String(row.source_group_no ?? "").trim();
  const clause = String(row.source_clause ?? "").trim();
  const itemNo = String(row.source_item_no ?? "").trim();

  if (groupNo === "3" && clause === "3.1" && itemNo.length === 0) {
    return "ไฟล์นำเข้าระบุข้อ 3.1 แต่ไม่ได้ระบุข้อย่อย 3.1.1 ถึง 3.1.5 จึงยังไม่ผูกอัตราเงิน พ.ต.ส. อัตโนมัติ";
  }

  if (groupNo.length === 0 && clause === "1.1") {
    return "ไฟล์นำเข้าไม่ระบุกลุ่ม แต่ระบุข้อ 1.1 จึงยังไม่ผูกอัตราเงิน พ.ต.ส. อัตโนมัติ";
  }

  if (groupNo === "1" && clause === "1" && itemNo.length === 0) {
    return "ไฟล์นำเข้าระบุกลุ่ม 1 และข้อ 1 แต่ยังไม่ชัดว่าเป็นข้อ 1.1 หรือ 1.2";
  }

  return "ข้อมูลจากไฟล์นำเข้าระบุกลุ่ม/ข้อไม่ละเอียดพอสำหรับผูกกับ cfg_payment_rates";
};

const parseApplyArgs = (): { batchId: number | null; mergeMode: boolean } => {
  const args = process.argv.slice(2);
  const first = args[0];
  const mergeMode = args.includes("--merge");
  if (!first || first === "--merge") {
    return { batchId: null, mergeMode };
  }
  const parsed = Number.parseInt(first, 10);
  return {
    batchId: Number.isFinite(parsed) ? parsed : null,
    mergeMode,
  };
};

const getDaysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

async function findBatch(conn: PoolConnection, batchId: number | null): Promise<BatchRow> {
  const sql = batchId
    ? `
        SELECT batch_id, period_month, period_year, status, matched_rows, unmatched_rows, ambiguous_rows
        FROM pay_import_batches
        WHERE batch_id = ?
        LIMIT 1
      `
    : `
        SELECT batch_id, period_month, period_year, status, matched_rows, unmatched_rows, ambiguous_rows
        FROM pay_import_batches
        WHERE status IN ('IMPORTED', 'REVIEWED', 'APPLIED')
        ORDER BY batch_id DESC
        LIMIT 1
      `;
  const params = batchId ? [batchId] : [];
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  const row = rows[0] as BatchRow | undefined;
  if (!row) {
    throw new Error(batchId ? `ไม่พบ pay import batch ${batchId}` : "ไม่พบ pay import batch ล่าสุด");
  }
  return row;
}

async function findOrCreatePeriod(
  conn: PoolConnection,
  month: number,
  year: number,
): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT period_id
      FROM pay_periods
      WHERE period_month = ? AND period_year = ?
      LIMIT 1
    `,
    [month, year],
  );
  const existing = rows[0] as { period_id: number } | undefined;
  if (existing) return Number(existing.period_id);

  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO pay_periods (period_month, period_year, status, created_by)
      VALUES (?, ?, ?, NULL)
    `,
    [month, year, PeriodStatus.OPEN],
  );
  return result.insertId;
}

async function clearPeriodData(conn: PoolConnection, periodId: number): Promise<void> {
  await conn.execute(
    `
      DELETE c
      FROM pay_result_checks c
      INNER JOIN pay_results p ON p.payout_id = c.payout_id
      WHERE p.period_id = ?
    `,
    [periodId],
  );
  await conn.execute(
    `
      DELETE i
      FROM pay_result_items i
      INNER JOIN pay_results p ON p.payout_id = i.payout_id
      WHERE p.period_id = ?
    `,
    [periodId],
  );
  await conn.execute("DELETE FROM pay_results WHERE period_id = ?", [periodId]);
  await conn.execute("DELETE FROM pay_period_profession_reviews WHERE period_id = ?", [periodId]);
  await conn.execute("DELETE FROM pay_period_items WHERE period_id = ?", [periodId]);
}

async function clearPeriodDataForBatchCitizens(
  conn: PoolConnection,
  periodId: number,
  batchId: number,
): Promise<void> {
  await conn.execute(
    `
      DELETE c
      FROM pay_result_checks c
      INNER JOIN pay_results p ON p.payout_id = c.payout_id
      WHERE p.period_id = ?
        AND p.citizen_id IN (
          SELECT pir.matched_citizen_id COLLATE utf8mb4_unicode_ci
          FROM pay_import_rows pir
          WHERE pir.batch_id = ?
            AND pir.match_status = 'MATCHED'
            AND pir.matched_citizen_id IS NOT NULL
        )
    `,
    [periodId, batchId],
  );
  await conn.execute(
    `
      DELETE i
      FROM pay_result_items i
      INNER JOIN pay_results p ON p.payout_id = i.payout_id
      WHERE p.period_id = ?
        AND p.citizen_id IN (
          SELECT pir.matched_citizen_id COLLATE utf8mb4_unicode_ci
          FROM pay_import_rows pir
          WHERE pir.batch_id = ?
            AND pir.match_status = 'MATCHED'
            AND pir.matched_citizen_id IS NOT NULL
        )
    `,
    [periodId, batchId],
  );
  await conn.execute(
    `
      DELETE FROM pay_results
      WHERE period_id = ?
        AND citizen_id IN (
          SELECT pir.matched_citizen_id COLLATE utf8mb4_unicode_ci
          FROM pay_import_rows pir
          WHERE pir.batch_id = ?
            AND pir.match_status = 'MATCHED'
            AND pir.matched_citizen_id IS NOT NULL
        )
    `,
    [periodId, batchId],
  );
}

async function loadMatchedRows(conn: PoolConnection, batchId: number): Promise<ImportRow[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        import_row_id,
        matched_citizen_id,
        matched_user_id,
        matched_profession_code,
        source_group_no,
        source_clause,
        source_item_no,
        announced_rate,
        monthly_amount,
        retroactive_amount,
        total_amount,
        note,
        first_name,
        last_name
      FROM pay_import_rows
      WHERE batch_id = ?
        AND match_status = 'MATCHED'
      ORDER BY source_line_no ASC
    `,
    [batchId],
  );
  return rows as ImportRow[];
}

async function loadRates(conn: PoolConnection): Promise<ImportedRateRow[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        rate_id,
        profession_code,
        group_no,
        item_no,
        sub_item_no,
        amount
      FROM cfg_payment_rates
      WHERE is_active = 1
    `,
  );
  return rows.map((row: any) => ({
    rateId: Number(row.rate_id),
    professionCode: String(row.profession_code),
    groupNo: Number(row.group_no),
    itemNo: row.item_no ? String(row.item_no) : null,
    subItemNo: row.sub_item_no ? String(row.sub_item_no) : null,
    amount: Number(row.amount),
  }));
}

async function insertPayout(
  conn: PoolConnection,
  periodId: number,
  row: ImportRow,
  periodMonth: number,
  periodYear: number,
  daysInMonth: number,
  rates: ImportedRateRow[],
): Promise<{ payoutId: number; totalPayable: number; rateResolved: boolean }> {
  const professionCode = row.matched_profession_code ?? "NURSE";
  const masterRateId = resolveImportedRateId(
    {
      sourceGroupNo: row.source_group_no,
      sourceClause: row.source_clause,
      sourceItemNo: row.source_item_no,
      announcedRate: row.announced_rate === null ? null : Number(row.announced_rate),
    },
    rates,
    professionCode,
  );

  const metrics = deriveImportedPayoutMetrics({
    daysInMonth,
    announcedRate: row.announced_rate === null ? null : Number(row.announced_rate),
    monthlyAmount: row.monthly_amount === null ? null : Number(row.monthly_amount),
    retroactiveAmount: row.retroactive_amount === null ? null : Number(row.retroactive_amount),
    totalAmount: row.total_amount === null ? null : Number(row.total_amount),
  });

  const remarkParts = [row.note?.trim() || ""];
  const unresolvedRateReason = !masterRateId ? buildUnresolvedRateReason(row) : null;
  if (unresolvedRateReason) remarkParts.push(unresolvedRateReason);
  const remark = remarkParts.filter(Boolean).join(" | ") || null;

  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO pay_results (
        period_id,
        user_id,
        citizen_id,
        master_rate_id,
        profession_code,
        pts_rate_snapshot,
        calculated_amount,
        retroactive_amount,
        total_payable,
        deducted_days,
        eligible_days,
        remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      row.matched_user_id,
      row.matched_citizen_id,
      masterRateId,
      professionCode,
      row.announced_rate ?? 0,
      metrics.calculatedAmount,
      metrics.retroactiveAmount,
      metrics.totalPayable,
      metrics.deductedDays,
      metrics.eligibleDays,
      remark,
    ],
  );

  const payoutId = result.insertId;

  if (!masterRateId) {
    await conn.execute(
      `
        INSERT INTO pay_result_checks (
          payout_id,
          code,
          severity,
          title,
          summary,
          impact_amount,
          evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          payoutId,
          "MISSING_MASTER_RATE_MAPPING",
          "BLOCKER",
          "ยังจับคู่อัตราเงิน พ.ต.ส. ไม่ได้",
          unresolvedRateReason,
          metrics.totalPayable,
          JSON.stringify([
            {
            source_group_no: row.source_group_no,
            source_clause: row.source_clause,
              source_item_no: row.source_item_no,
              announced_rate: row.announced_rate,
              note: row.note,
              unresolved_reason: unresolvedRateReason,
            },
          ]),
        ],
    );
  }

  if (metrics.calculatedAmount !== 0) {
    await conn.execute(
      `
        INSERT INTO pay_result_items (
          payout_id,
          reference_month,
          reference_year,
          item_type,
          amount,
          description
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        periodMonth,
        periodYear,
        PayResultItemType.CURRENT,
        metrics.calculatedAmount,
        "นำเข้ายอดงวดปัจจุบันจากไฟล์ payroll จริง",
      ],
    );
  }

  if (metrics.retroactiveAmount !== 0) {
    await conn.execute(
      `
        INSERT INTO pay_result_items (
          payout_id,
          reference_month,
          reference_year,
          item_type,
          amount,
          description
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        0,
        0,
        metrics.retroactiveAmount > 0
          ? PayResultItemType.RETROACTIVE_ADD
          : PayResultItemType.RETROACTIVE_DEDUCT,
        Math.abs(metrics.retroactiveAmount),
        "นำเข้าตกเบิกย้อนหลังจากไฟล์ payroll จริง",
      ],
    );
  }

  return {
    payoutId,
    totalPayable: metrics.totalPayable,
    rateResolved: masterRateId !== null,
  };
}

async function updatePeriodTotals(conn: PoolConnection, periodId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        COALESCE(SUM(total_payable), 0) AS total_amount,
        COUNT(*) AS headcount
      FROM pay_results
      WHERE period_id = ?
    `,
    [periodId],
  );
  const row = (rows[0] as any) ?? {};
  await conn.execute(
    `
      UPDATE pay_periods
      SET total_amount = ?, total_headcount = ?, updated_at = NOW()
      WHERE period_id = ?
    `,
    [Number(row.total_amount ?? 0), Number(row.headcount ?? 0), periodId],
  );
}

async function markBatchApplied(
  conn: PoolConnection,
  batchId: number,
  periodId: number,
  appliedCount: number,
  unresolvedRateCount: number,
): Promise<void> {
  await conn.execute(
    `
      UPDATE pay_import_batches
      SET status = 'APPLIED',
          notes = ?
      WHERE batch_id = ?
    `,
    [
      `Applied into pay_periods.period_id=${periodId}; applied_rows=${appliedCount}; unresolved_master_rate_rows=${unresolvedRateCount}`,
      batchId,
    ],
  );
}

async function main(): Promise<void> {
  const { batchId: batchIdArg, mergeMode } = parseApplyArgs();
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const batch = await findBatch(conn, batchIdArg);
    const periodId = await findOrCreatePeriod(conn, batch.period_month, batch.period_year);
    if (mergeMode) {
      await clearPeriodDataForBatchCitizens(conn, periodId, batch.batch_id);
    } else {
      await clearPeriodData(conn, periodId);
    }

    const rows = await loadMatchedRows(conn, batch.batch_id);
    const rates = await loadRates(conn);
    const daysInMonth = getDaysInMonth(batch.period_year, batch.period_month);

    let appliedCount = 0;
    let unresolvedRateCount = 0;
    for (const row of rows) {
      const result = await insertPayout(
        conn,
        periodId,
        row,
        batch.period_month,
        batch.period_year,
        daysInMonth,
        rates,
      );
      appliedCount += 1;
      if (!result.rateResolved) unresolvedRateCount += 1;
    }

    await updatePeriodTotals(conn, periodId);
    await markBatchApplied(conn, batch.batch_id, periodId, appliedCount, unresolvedRateCount);
    await conn.commit();

    console.log(
      JSON.stringify(
        {
          batch_id: batch.batch_id,
          merge_mode: mergeMode,
          period_id: periodId,
          period_month: batch.period_month,
          period_year: batch.period_year,
          applied_rows: appliedCount,
          unmatched_rows: batch.unmatched_rows,
          ambiguous_rows: batch.ambiguous_rows,
          unresolved_master_rate_rows: unresolvedRateCount,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await closePool();
  }
}

main().catch((error) => {
  console.error("[apply_payroll_import_batch] Failed:", error);
  process.exit(1);
});
