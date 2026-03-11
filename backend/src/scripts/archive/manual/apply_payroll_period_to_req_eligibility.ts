import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { closePool, getConnection } from "@config/database.js";
import { chooseImportRequestId } from "@/scripts/archive/manual/req-eligibility-import-schema.js";

type PeriodRow = {
  period_id: number;
  period_month: number;
  period_year: number;
};

const parsePeriodIdArg = (): number | null => {
  const raw = process.argv[2];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

async function findPeriod(conn: PoolConnection, periodId: number): Promise<PeriodRow> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT period_id, period_month, period_year
      FROM pay_periods
      WHERE period_id = ?
      LIMIT 1
    `,
    [periodId],
  );
  const row = rows[0] as PeriodRow | undefined;
  if (!row) throw new Error(`ไม่พบงวด payroll period_id=${periodId}`);
  return row;
}

async function insertEligibilityFromPeriod(
  conn: PoolConnection,
  period: PeriodRow,
): Promise<{
  inserted: number;
  replacedExisting: number;
  unresolvedRate: number;
}> {
  const effectiveDate = `${period.period_year}-${String(period.period_month).padStart(2, "0")}-01`;
  const importRequestId = await resolveImportRequestId(conn);

  const [unresolvedRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM pay_results
      WHERE period_id = ?
        AND master_rate_id IS NULL
    `,
    [period.period_id],
  );
  const unresolvedRate = Number((unresolvedRows[0] as any)?.total ?? 0);

  const [existingRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM req_eligibility re
      INNER JOIN pay_results pr
        ON pr.citizen_id = re.citizen_id
      WHERE pr.period_id = ?
        AND pr.master_rate_id IS NOT NULL
    `,
    [period.period_id],
  );
  const replacedExisting = Number((existingRows[0] as any)?.total ?? 0);

  await conn.execute(
    `
      DELETE re
      FROM req_eligibility re
      INNER JOIN pay_results pr
        ON pr.citizen_id = re.citizen_id
      WHERE pr.period_id = ?
        AND pr.master_rate_id IS NOT NULL
    `,
    [period.period_id],
  );

  const [insertResult] = await conn.execute<any>(
    `
      INSERT INTO req_eligibility (
        user_id,
        citizen_id,
        master_rate_id,
        request_id,
        effective_date,
        reference_doc_no,
        is_active
      )
      SELECT
        pr.user_id,
        pr.citizen_id,
        pr.master_rate_id,
        ?,
        ?,
        ?,
        1
      FROM pay_results pr
      WHERE pr.period_id = ?
        AND pr.master_rate_id IS NOT NULL
    `,
    [
      importRequestId,
      effectiveDate,
      `PAYROLL_IMPORT_PERIOD_${period.period_id}`,
      period.period_id,
    ],
  );

  return {
    inserted: Number(insertResult?.affectedRows ?? 0),
    replacedExisting,
    unresolvedRate,
  };
}

async function resolveImportRequestId(conn: PoolConnection): Promise<number | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT IS_NULLABLE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'req_eligibility'
        AND column_name = 'request_id'
      LIMIT 1
    `,
  );
  const nullableFlag = String((rows[0] as any)?.IS_NULLABLE ?? "NO").toUpperCase() === "YES";
  return chooseImportRequestId(nullableFlag);
}

async function main(): Promise<void> {
  const periodId = parsePeriodIdArg();
  if (!periodId) {
    throw new Error("กรุณาระบุ period_id เช่น: npx tsx src/scripts/archive/manual/apply_payroll_period_to_req_eligibility.ts 37");
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const period = await findPeriod(conn, periodId);
    const result = await insertEligibilityFromPeriod(conn, period);
    await conn.commit();

    console.log(
      JSON.stringify(
        {
          period_id: period.period_id,
          period_month: period.period_month,
          period_year: period.period_year,
          effective_date: `${period.period_year}-${String(period.period_month).padStart(2, "0")}-01`,
          inserted_rows: result.inserted,
          replaced_existing_rows: result.replacedExisting,
          unresolved_master_rate_rows: result.unresolvedRate,
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
  console.error("[apply_payroll_period_to_req_eligibility] Failed:", error);
  process.exit(1);
});
