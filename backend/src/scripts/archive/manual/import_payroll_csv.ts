import fs from "node:fs";
import path from "node:path";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getConnection, closePool } from "@config/database.js";
import { normalizeImportedName, resolveClosestImportedCandidate } from "@/modules/payroll/services/import/payroll-import-match.js";
import { parseImportPayrollConfig, type ImportPayrollConfig } from "@/scripts/archive/manual/import-payroll-csv-config.js";

type ParsedPayrollRow = {
  sourceLineNo: number;
  sourceIndex: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  sourcePositionName: string;
  licenseExpiryRaw: string | null;
  licenseExpiryDate: string | null;
  monthlyAmount: number | null;
  retroactiveAmount: number | null;
  totalAmount: number | null;
  sourceGroupNo: string | null;
  sourceClause: string | null;
  sourceItemNo: string | null;
  announcedRate: number | null;
  note: string | null;
  rawPayload: Record<string, unknown>;
};

type MatchCandidate = {
  citizen_id: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  position_name: string;
  department: string | null;
};

type MatchResult =
  | {
      status: "MATCHED";
      candidate: MatchCandidate;
      professionCode: string | null;
      note: string | null;
    }
  | {
      status: "UNMATCHED" | "AMBIGUOUS";
      candidate: null;
      professionCode: null;
      note: string | null;
    };

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
  "มกราคม": 1,
  "กุมภาพันธ์": 2,
  "มีนาคม": 3,
  "เมษายน": 4,
  "พฤษภาคม": 5,
  "มิถุนายน": 6,
  "กรกฎาคม": 7,
  "สิงหาคม": 8,
  "กันยายน": 9,
  "ตุลาคม": 10,
  "พฤศจิกายน": 11,
  "ธันวาคม": 12,
};

const EN_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const trimValue = (value: unknown): string => String(value ?? "").replace(/\u00a0/g, " ").trim();

const toNullableString = (value: unknown): string | null => {
  const text = trimValue(value);
  return text.length > 0 ? text : null;
};

const parseMoney = (value: unknown): number | null => {
  const text = trimValue(value).replace(/,/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeYear = (year: number): number => (year > 2400 ? year - 543 : year);

const toSqlDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const parseDate = (value: unknown): string | null => {
  const text = trimValue(value);
  if (!text) return null;

  const thaiMatch = text.match(/^(\d{1,2})[-\s]([ก-๙.]+)[-\s](\d{4})$/);
  if (thaiMatch) {
    const day = Number(thaiMatch[1]);
    const month = THAI_MONTHS[thaiMatch[2]];
    const year = normalizeYear(Number(thaiMatch[3]));
    if (month && day >= 1 && day <= 31) return toSqlDate(year, month, day);
  }

  const engMatch = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (engMatch) {
    const day = Number(engMatch[1]);
    const month = EN_MONTHS[engMatch[2].toLowerCase()];
    const year = normalizeYear(Number(engMatch[3]));
    if (month && day >= 1 && day <= 31) return toSqlDate(year, month, day);
  }

  return null;
};

const isDataRow = (row: string[]): boolean => /^\d+$/.test(trimValue(row[0]));

const parsePayrollRows = (csvPath: string): ParsedPayrollRow[] => {
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.split("\t"));

  return rows
    .map((row, idx) => ({ row, lineNo: idx + 1 }))
    .filter(({ row }) => isDataRow(row))
    .map(({ row, lineNo }) => {
      const padded = [...row];
      while (padded.length < 14) padded.push("");
      const isCompactNoItemFormat =
        parseMoney(padded[5]) !== null &&
        parseMoney(padded[7]) !== null &&
        parseMoney(padded[10]) !== null;

      if (isCompactNoItemFormat) {
        return {
          sourceLineNo: lineNo,
          sourceIndex: toNullableString(padded[0]),
          title: toNullableString(padded[1]),
          firstName: trimValue(padded[2]),
          lastName: trimValue(padded[3]),
          sourcePositionName: trimValue(padded[4]),
          licenseExpiryRaw: null,
          licenseExpiryDate: null,
          monthlyAmount: parseMoney(padded[5]),
          retroactiveAmount: parseMoney(padded[6]),
          totalAmount: parseMoney(padded[7]),
          sourceGroupNo: toNullableString(padded[8]),
          sourceClause: toNullableString(padded[9]),
          sourceItemNo: null,
          announcedRate: parseMoney(padded[10]),
          note: toNullableString(padded[11]),
          rawPayload: {
            row,
            isCompactNoItemFormat,
          },
        } satisfies ParsedPayrollRow;
      }

      const hasLicenseColumn = parseMoney(padded[5]) === null;
      const amountStartIndex = hasLicenseColumn ? 6 : 5;
      const groupStartIndex = hasLicenseColumn ? 9 : 8;
      return {
        sourceLineNo: lineNo,
        sourceIndex: toNullableString(padded[0]),
        title: toNullableString(padded[1]),
        firstName: trimValue(padded[2]),
        lastName: trimValue(padded[3]),
        sourcePositionName: trimValue(padded[4]),
        licenseExpiryRaw: hasLicenseColumn ? toNullableString(padded[5]) : null,
        licenseExpiryDate: hasLicenseColumn ? parseDate(padded[5]) : null,
        monthlyAmount: parseMoney(padded[amountStartIndex]),
        retroactiveAmount: parseMoney(padded[amountStartIndex + 1]),
        totalAmount: parseMoney(padded[amountStartIndex + 2]),
        sourceGroupNo: toNullableString(padded[groupStartIndex]),
        sourceClause: toNullableString(padded[groupStartIndex + 1]),
        sourceItemNo: toNullableString(padded[groupStartIndex + 2]),
        announcedRate: parseMoney(padded[groupStartIndex + 3]),
        note: toNullableString(padded[groupStartIndex + 4]),
        rawPayload: {
          row,
          hasLicenseColumn,
        },
      } satisfies ParsedPayrollRow;
    });
};

const getPositionLikeByScope = (scope: ImportPayrollConfig["personnelScope"]): string => {
  if (scope === "PHARMACIST") return "เภสัชกร%";
  return "พยาบาลวิชาชีพ%";
};

const loadCandidates = async (
  conn: PoolConnection,
  scope: ImportPayrollConfig["personnelScope"],
): Promise<MatchCandidate[]> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        ep.citizen_id,
        u.id AS user_id,
        ep.first_name,
        ep.last_name,
        ep.position_name,
        ep.department
      FROM emp_profiles ep
      LEFT JOIN users u ON u.citizen_id = ep.citizen_id
      WHERE ep.position_name LIKE ?
      ORDER BY ep.citizen_id ASC
    `,
    [getPositionLikeByScope(scope)],
  );

  return rows.map((candidate: any) => ({
    citizen_id: String(candidate.citizen_id),
    user_id: candidate.user_id === null || candidate.user_id === undefined ? null : Number(candidate.user_id),
    first_name: String(candidate.first_name),
    last_name: String(candidate.last_name),
    position_name: String(candidate.position_name),
    department: candidate.department ? String(candidate.department) : null,
  }));
};

const resolveProfessionCode = (positionName: string): string | null => {
  if (positionName.startsWith("เภสัชกร")) return "PHARMACIST";
  if (positionName.startsWith("พยาบาลวิชาชีพ")) return "NURSE";
  return null;
};

const matchRow = async (
  candidatesInScope: MatchCandidate[],
  row: ParsedPayrollRow,
): Promise<MatchResult> => {
  const normalizedFirst = normalizeImportedName(row.firstName);
  const normalizedLast = normalizeImportedName(row.lastName);
  const candidates = candidatesInScope.filter(
    (candidate) =>
      normalizeImportedName(candidate.first_name) === normalizedFirst &&
      normalizeImportedName(candidate.last_name) === normalizedLast,
  );

  if (candidates.length > 0) {
    const exactPosition = candidates.filter(
      (candidate) => candidate.position_name === row.sourcePositionName,
    );

    if (exactPosition.length === 1) {
      return {
        status: "MATCHED",
        candidate: exactPosition[0],
        professionCode: resolveProfessionCode(exactPosition[0].position_name),
        note: "จับคู่จากชื่อ สกุล และตำแหน่งตรงกัน",
      };
    }

    if (candidates.length === 1) {
      return {
        status: "MATCHED",
        candidate: candidates[0],
        professionCode: resolveProfessionCode(candidates[0].position_name),
        note: "จับคู่จากชื่อและสกุล โดยตำแหน่งในระบบเป็นพยาบาลวิชาชีพสายเดียวกัน",
      };
    }

    return {
      status: "AMBIGUOUS",
      candidate: null,
      professionCode: null,
      note: `พบผู้มีชื่อและสกุลซ้ำ ${candidates.length} รายการ`,
    };
  }

  const closestCandidate = resolveClosestImportedCandidate(
    {
      firstName: row.firstName,
      lastName: row.lastName,
    },
    candidatesInScope,
  );

  if (closestCandidate) {
    return {
      status: "MATCHED",
      candidate: closestCandidate,
      professionCode: resolveProfessionCode(closestCandidate.position_name),
      note: "จับคู่จากชื่อที่สะกดใกล้เคียงกับข้อมูลบุคลากรในระบบ",
    };
  }

  return {
    status: "UNMATCHED",
    candidate: null,
    professionCode: null,
    note: "ไม่พบบุคลากรใน emp_profiles จากชื่อและสกุล",
  };
};

async function createBatch(
  conn: PoolConnection,
  totalRows: number,
  sourceFile: string,
  periodMonth: number,
  periodYear: number,
  personnelScope: string,
): Promise<number> {
  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO pay_import_batches (
        source_file,
        source_type,
        period_month,
        period_year,
        personnel_scope,
        total_rows
      ) VALUES (?, 'PAYROLL_CSV', ?, ?, ?, ?)
    `,
    [path.basename(sourceFile), periodMonth, periodYear, personnelScope, totalRows],
  );
  return result.insertId;
}

async function saveImportRow(
  conn: PoolConnection,
  batchId: number,
  row: ParsedPayrollRow,
  match: MatchResult,
): Promise<void> {
  await conn.execute(
    `
      INSERT INTO pay_import_rows (
        batch_id,
        source_line_no,
        source_index,
        title,
        first_name,
        last_name,
        source_position_name,
        license_expiry_raw,
        license_expiry_date,
        monthly_amount,
        retroactive_amount,
        total_amount,
        source_group_no,
        source_clause,
        source_item_no,
        announced_rate,
        note,
        match_status,
        matched_citizen_id,
        matched_user_id,
        matched_position_name,
        matched_department,
        matched_profession_code,
        match_note,
        raw_payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batchId,
      row.sourceLineNo,
      row.sourceIndex,
      row.title,
      row.firstName,
      row.lastName,
      row.sourcePositionName,
      row.licenseExpiryRaw,
      row.licenseExpiryDate,
      row.monthlyAmount,
      row.retroactiveAmount,
      row.totalAmount,
      row.sourceGroupNo,
      row.sourceClause,
      row.sourceItemNo,
      row.announcedRate,
      row.note,
      match.status,
      match.candidate?.citizen_id ?? null,
      match.candidate?.user_id ?? null,
      match.candidate?.position_name ?? null,
      match.candidate?.department ?? null,
      match.professionCode,
      match.note,
      JSON.stringify(row.rawPayload),
    ],
  );
}

async function finalizeBatch(conn: PoolConnection, batchId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        SUM(CASE WHEN match_status = 'MATCHED' THEN 1 ELSE 0 END) AS matched_rows,
        SUM(CASE WHEN match_status = 'UNMATCHED' THEN 1 ELSE 0 END) AS unmatched_rows,
        SUM(CASE WHEN match_status = 'AMBIGUOUS' THEN 1 ELSE 0 END) AS ambiguous_rows
      FROM pay_import_rows
      WHERE batch_id = ?
    `,
    [batchId],
  );

  const summary: any = rows[0] ?? {};
  await conn.execute(
    `
      UPDATE pay_import_batches
      SET matched_rows = ?,
          unmatched_rows = ?,
          ambiguous_rows = ?,
          status = 'IMPORTED'
      WHERE batch_id = ?
    `,
    [
      Number(summary.matched_rows ?? 0),
      Number(summary.unmatched_rows ?? 0),
      Number(summary.ambiguous_rows ?? 0),
      batchId,
    ],
  );
}

async function main(): Promise<void> {
  const config = parseImportPayrollConfig(process.argv.slice(2));
  const rows = parsePayrollRows(config.sourceFile);
  if (!rows.length) {
    throw new Error("ไม่พบข้อมูล payroll ที่ parse ได้จากไฟล์");
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const candidatesInScope = await loadCandidates(conn, config.personnelScope);
    const batchId = await createBatch(
      conn,
      rows.length,
      config.sourceFile,
      config.periodMonth,
      config.periodYear,
      config.personnelScope,
    );

    for (const row of rows) {
      const match = await matchRow(candidatesInScope, row);
      await saveImportRow(conn, batchId, row, match);
    }

    await finalizeBatch(conn, batchId);
    await conn.commit();

    const [summaryRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT batch_id, total_rows, matched_rows, unmatched_rows, ambiguous_rows
        FROM pay_import_batches
        WHERE batch_id = ?
      `,
      [batchId],
    );
    const summary = summaryRows[0] as any;
    console.log("[import_payroll_csv] Imported batch:", summary);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await closePool();
  }
}

main().catch((error) => {
  console.error("[import_payroll_csv] Failed:", error);
  process.exit(1);
});
