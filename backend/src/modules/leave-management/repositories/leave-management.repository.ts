import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import db from '@/config/database.js';
import type {
  LeaveManagementListQuery,
  LeavePersonnelListQuery,
  LeaveManagementExtensionBody,
} from '../leave-management.schema.js';

export type LeaveManagementRow = RowDataPacket & {
  id: number;
  citizen_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  remark?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
  sub_department?: string | null;
  extension_id?: number | null;
  document_start_date?: string | null;
  document_end_date?: string | null;
  document_duration_days?: number | null;
  require_return_report?: number | null;
  return_report_status?: string | null;
  return_date?: string | null;
  return_remark?: string | null;
  pay_exception?: number | null;
  is_no_pay?: number | null;
  pay_exception_reason?: string | null;
  study_institution?: string | null;
  study_program?: string | null;
  study_major?: string | null;
  study_start_date?: string | null;
  study_note?: string | null;
  note?: string | null;
  profession_code?: string | null;
};

export type LeaveManagementQuotaContextRow = RowDataPacket & {
  id: number;
  citizen_id: string;
  leave_type: string;
  fiscal_year: number;
  duration_days?: number | null;
};

export type LeaveManagementDocumentInput = {
  leave_management_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  uploaded_by?: number | null;
};

export type LeaveManagementDocumentRow = RowDataPacket & {
  document_id: number;
  leave_record_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  uploaded_by?: number | null;
  uploaded_at: string;
};

export type LeaveManagementCreateInput = {
  citizen_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  fiscal_year: number;
  remark?: string | null;
};

export type LeaveManagementStats = {
  total: number;
  study: number;
  pending_report: number;
};

export type LeavePersonnelRow = RowDataPacket & {
  citizen_id: string;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
  profession_code?: string | null;
};

export type LeaveQuotaLeaveRow = RowDataPacket & {
  id?: number;
  citizen_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  remark?: string | null;
  document_start_date?: string | null;
  document_end_date?: string | null;
  document_duration_days?: number | null;
  duration_days?: number | null;
  is_no_pay?: number | null;
  pay_exception?: number | null;
  study_institution?: string | null;
  study_program?: string | null;
  study_major?: string | null;
};

type LeaveManagementInternalQuery = LeaveManagementListQuery & {
  citizen_ids?: string[];
};

export type LeaveManagementPeriodQuery = LeaveManagementInternalQuery & {
  start_date: string;
  end_date: string;
};

export type LeaveQuotaRow = RowDataPacket & {
  fiscal_year?: number;
  quota_vacation?: number | string | null;
  quota_personal?: number | string | null;
  quota_sick?: number | string | null;
};

export type EmployeeServiceDatesRow = RowDataPacket & {
  start_work_date?: string | null;
  first_entry_date?: string | null;
};

export type LeaveReturnReportEventRow = RowDataPacket & {
  event_id: number;
  leave_record_id: number;
  report_date: string;
  resume_date?: string | null;
  resume_study_institution?: string | null;
  resume_study_program?: string | null;
  resume_study_major?: string | null;
  remark?: string | null;
  created_at?: string | null;
};

export type LeaveReturnReportEventInput = {
  report_date: string;
  resume_date?: string | null;
  resume_study_program?: string | null;
};

const buildProfessionCaseSql = (positionExpr: string) => `
  CASE
    WHEN ${positionExpr} LIKE '%ทันตแพทย์%' THEN 'DENTIST'
    WHEN ${positionExpr} LIKE '%นายแพทย์%' OR ${positionExpr} LIKE '%แพทย์%' THEN 'DOCTOR'
    WHEN ${positionExpr} LIKE '%เภสัชกร%' THEN 'PHARMACIST'
    WHEN ${positionExpr} LIKE 'ผู้ช่วยพยาบาล%' THEN NULL
    WHEN ${positionExpr} LIKE 'พนักงานช่วยการพยาบาล%' THEN NULL
    WHEN ${positionExpr} LIKE 'พนักงานช่วยเหลือคนไข้%' THEN NULL
    WHEN ${positionExpr} LIKE '%พยาบาล%' THEN 'NURSE'
    WHEN ${positionExpr} LIKE 'นักเทคนิคการแพทย์%' THEN 'MED_TECH'
    WHEN ${positionExpr} LIKE 'นักรังสีการแพทย์%' THEN 'RAD_TECH'
    WHEN ${positionExpr} LIKE 'นักกายภาพบำบัด%' THEN 'PHYSIO'
    WHEN ${positionExpr} LIKE 'นักกายภาพบําบัด%' THEN 'PHYSIO'
    WHEN ${positionExpr} LIKE 'นักกิจกรรมบำบัด%' THEN 'OCC_THERAPY'
    WHEN ${positionExpr} LIKE 'นักกิจกรรมบําบัด%' THEN 'OCC_THERAPY'
    WHEN ${positionExpr} LIKE 'นักอาชีวบำบัด%' THEN 'OCC_THERAPY'
    WHEN ${positionExpr} LIKE 'นักอาชีวบําบัด%' THEN 'OCC_THERAPY'
    WHEN ${positionExpr} LIKE 'นักจิตวิทยา%' THEN 'CLIN_PSY'
    WHEN ${positionExpr} LIKE 'นักแก้ไขความผิดปกติ%' THEN 'SPEECH_THERAPIST'
    WHEN ${positionExpr} LIKE 'นักวิชาการศึกษาพิเศษ%' THEN 'SPECIAL_EDU'
    WHEN ${positionExpr} LIKE 'นักเทคโนโลยีหัวใจและทรวงอก%' THEN 'CARDIO_TECH'
    ELSE NULL
  END
`;

const buildLeaveManagementFilters = (params: LeaveManagementInternalQuery) => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const positionExpr = "COALESCE(ep.position_name, ss.position_name, '')";
  const professionCaseSql = buildProfessionCaseSql(positionExpr);

  if (params.citizen_id) {
    clauses.push("lr.citizen_id = ?");
    values.push(params.citizen_id);
  }
  if (params.leave_type) {
    clauses.push("lr.leave_type = ?");
    values.push(params.leave_type);
  }
  if (params.fiscal_year) {
    clauses.push("lr.fiscal_year = ?");
    values.push(params.fiscal_year);
  }
  if (params.pending_report === true) {
    clauses.push(
      "ext.require_return_report = 1 AND (ext.return_report_status IS NULL OR ext.return_report_status != 'DONE')",
    );
  }
  if (params.profession_code) {
    if (params.profession_code === "UNKNOWN") {
      clauses.push(`${professionCaseSql} IS NULL`);
    } else {
      clauses.push(`${professionCaseSql} = ?`);
      values.push(params.profession_code);
    }
  }
  if (params.search) {
    const tokens = params.search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    tokens.forEach((token) => {
      const pattern = `%${token}%`;
      clauses.push(
        `(
          LOWER(lr.citizen_id) LIKE ?
          OR LOWER(COALESCE(ep.first_name, ss.first_name, '')) LIKE ?
          OR LOWER(COALESCE(ep.last_name, ss.last_name, '')) LIKE ?
          OR LOWER(COALESCE(ep.department, ss.department, '')) LIKE ?
          OR LOWER(COALESCE(ep.position_name, ss.position_name, '')) LIKE ?
          OR LOWER(COALESCE(ep.sub_department, '')) LIKE ?
        )`,
      );
      values.push(pattern, pattern, pattern, pattern, pattern, pattern);
    });
  }
  if (Array.isArray(params.citizen_ids)) {
    const citizenIds = params.citizen_ids
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
    if (citizenIds.length === 0) {
      clauses.push("1 = 0");
    } else {
      const placeholders = citizenIds.map(() => "?").join(",");
      clauses.push(`lr.citizen_id IN (${placeholders})`);
      values.push(...citizenIds);
    }
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, values };
};

const buildPeriodOverlapClause = () =>
  "COALESCE(ext.document_start_date, lr.start_date) <= ? AND COALESCE(ext.document_end_date, lr.end_date) >= ?";

export class LeaveManagementRepository {
  async findLeaveManagementQuotaContext(
    leaveManagementId: number,
  ): Promise<LeaveManagementQuotaContextRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          lr.id,
          lr.citizen_id,
          lr.leave_type,
          lr.fiscal_year,
          lr.duration_days
        FROM leave_records lr
        WHERE lr.id = ?
        LIMIT 1
      `,
      [leaveManagementId],
    );

    if (!rows.length) {
      return null;
    }

    return rows[0] as LeaveManagementQuotaContextRow;
  }

  async listPersonnel(params: LeavePersonnelListQuery): Promise<LeavePersonnelRow[]> {
    const q = (params.q ?? "").trim().toLowerCase();
    const limit = params.limit ?? 2000;
    const where = q
      ? `
        WHERE (
          LOWER(COALESCE(ep.citizen_id, '')) LIKE ?
          OR LOWER(COALESCE(ep.first_name, '')) LIKE ?
          OR LOWER(COALESCE(ep.last_name, '')) LIKE ?
          OR LOWER(COALESCE(ep.department, '')) LIKE ?
          OR LOWER(COALESCE(ep.position_name, '')) LIKE ?
        )
      `
      : "";
    const values = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit] : [limit];

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          ep.citizen_id,
          ep.title,
          ep.first_name,
          ep.last_name,
          ep.position_name,
          ep.department,
          ${buildProfessionCaseSql("COALESCE(ep.position_name, '')")} AS profession_code
        FROM emp_profiles ep
        ${where}
        ORDER BY ep.first_name ASC, ep.last_name ASC
        LIMIT ?
      `,
      values,
    );

    return rows as LeavePersonnelRow[];
  }

  async listLeaveManagement(params: LeaveManagementListQuery): Promise<LeaveManagementRow[]> {
    const { whereClause, values } = buildLeaveManagementFilters(params);
    const positionExpr = "COALESCE(ep.position_name, ss.position_name, '')";
    const professionCaseSql = buildProfessionCaseSql(positionExpr);
    const hasLimit = typeof params.limit === "number";
    const limitClause = hasLimit ? "LIMIT ? OFFSET ?" : "";
    if (hasLimit) {
      values.push(params.limit);
      values.push(params.offset ?? 0);
    }
    const sortBy = params.sort_by ?? "start_date";
    const sortDir = params.sort_dir === "asc" ? "ASC" : "DESC";
    const orderByClause =
      sortBy === "name"
        ? `ORDER BY COALESCE(ep.first_name, ss.first_name, ''), COALESCE(ep.last_name, ss.last_name, ''), lr.start_date ${sortDir}`
        : `ORDER BY lr.start_date ${sortDir}, lr.id ${sortDir}`;

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT lr.*, 
          COALESCE(ep.first_name, ss.first_name, '') AS first_name,
          COALESCE(ep.last_name, ss.last_name, '') AS last_name,
          COALESCE(ep.position_name, ss.position_name, '') AS position_name,
          COALESCE(ep.department, ss.department, '') AS department,
          COALESCE(ep.sub_department, '') AS sub_department,
          ${professionCaseSql} AS profession_code,
          ext.extension_id,
          ext.document_start_date,
          ext.document_end_date,
          ext.document_duration_days,
          ext.require_return_report,
          ext.return_report_status,
          ext.return_date,
          ext.return_remark,
          ext.pay_exception,
          ext.is_no_pay,
          ext.pay_exception_reason,
          ext.study_institution,
          ext.study_program,
          ext.study_major,
          ext.study_start_date,
          ext.study_note,
          ext.note
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        LEFT JOIN emp_profiles ep ON lr.citizen_id = ep.citizen_id
        LEFT JOIN emp_support_staff ss ON lr.citizen_id = ss.citizen_id
        ${whereClause}
        ${orderByClause}
        ${limitClause}
      `,
      values,
    );

    return rows as LeaveManagementRow[];
  }

  async listLeaveManagementByPeriod(
    params: LeaveManagementPeriodQuery,
  ): Promise<LeaveManagementRow[]> {
    const { start_date, end_date, ...filters } = params;
    const { whereClause, values } = buildLeaveManagementFilters(filters);
    const positionExpr = "COALESCE(ep.position_name, ss.position_name, '')";
    const professionCaseSql = buildProfessionCaseSql(positionExpr);
    const hasLimit = typeof filters.limit === "number";
    const limitClause = hasLimit ? "LIMIT ? OFFSET ?" : "";
    const clauses = [buildPeriodOverlapClause()];
    if (whereClause) clauses.push(whereClause.replace(/^WHERE\s+/i, ""));
    const finalWhere = `WHERE ${clauses.join(" AND ")}`;
    const finalValues: unknown[] = [end_date, start_date, ...values];
    if (hasLimit) {
      finalValues.push(filters.limit);
      finalValues.push(filters.offset ?? 0);
    }
    const sortBy = filters.sort_by ?? "start_date";
    const sortDir = filters.sort_dir === "asc" ? "ASC" : "DESC";
    const orderByClause =
      sortBy === "name"
        ? `ORDER BY COALESCE(ep.first_name, ss.first_name, ''), COALESCE(ep.last_name, ss.last_name, ''), lr.start_date ${sortDir}`
        : `ORDER BY lr.start_date ${sortDir}, lr.id ${sortDir}`;

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT lr.*, 
          COALESCE(ep.first_name, ss.first_name, '') AS first_name,
          COALESCE(ep.last_name, ss.last_name, '') AS last_name,
          COALESCE(ep.position_name, ss.position_name, '') AS position_name,
          COALESCE(ep.department, ss.department, '') AS department,
          COALESCE(ep.sub_department, '') AS sub_department,
          ${professionCaseSql} AS profession_code,
          ext.extension_id,
          ext.document_start_date,
          ext.document_end_date,
          ext.document_duration_days,
          ext.require_return_report,
          ext.return_report_status,
          ext.return_date,
          ext.return_remark,
          ext.pay_exception,
          ext.is_no_pay,
          ext.pay_exception_reason,
          ext.study_institution,
          ext.study_program,
          ext.study_major,
          ext.study_start_date,
          ext.study_note,
          ext.note
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        LEFT JOIN emp_profiles ep ON lr.citizen_id = ep.citizen_id
        LEFT JOIN emp_support_staff ss ON lr.citizen_id = ss.citizen_id
        ${finalWhere}
        ${orderByClause}
        ${limitClause}
      `,
      finalValues,
    );

    return rows as LeaveManagementRow[];
  }

  async insertLeaveManagement(data: LeaveManagementCreateInput): Promise<number> {
    const [result] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO leave_records (
          citizen_id,
          leave_type,
          start_date,
          end_date,
          duration_days,
          fiscal_year,
          remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.citizen_id,
        data.leave_type,
        data.start_date,
        data.end_date,
        data.duration_days,
        data.fiscal_year,
        data.remark ?? null,
      ],
    );
    return result.insertId;
  }

  async countLeaveManagement(params: LeaveManagementListQuery): Promise<number> {
    const { whereClause, values } = buildLeaveManagementFilters(params);

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        LEFT JOIN emp_profiles ep ON lr.citizen_id = ep.citizen_id
        LEFT JOIN emp_support_staff ss ON lr.citizen_id = ss.citizen_id
        ${whereClause}
      `,
      values,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countLeaveManagementByPeriod(
    params: LeaveManagementPeriodQuery,
  ): Promise<number> {
    const { start_date, end_date, ...filters } = params;
    const { whereClause, values } = buildLeaveManagementFilters(filters);
    const clauses = [buildPeriodOverlapClause()];
    if (whereClause) clauses.push(whereClause.replace(/^WHERE\s+/i, ""));
    const finalWhere = `WHERE ${clauses.join(" AND ")}`;

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        LEFT JOIN emp_profiles ep ON lr.citizen_id = ep.citizen_id
        LEFT JOIN emp_support_staff ss ON lr.citizen_id = ss.citizen_id
        ${finalWhere}
      `,
      [end_date, start_date, ...values],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async summarizeLeaveManagementByProfessionByPeriod(
    params: Pick<
      LeaveManagementPeriodQuery,
      "start_date" | "end_date" | "search" | "leave_type" | "pending_report" | "citizen_ids"
    >,
  ): Promise<Array<{ profession_code: string | null; profession_name: string; leave_count: number }>> {
    const { start_date, end_date, ...filters } = params;
    const { whereClause, values } = buildLeaveManagementFilters(filters);
    const positionExpr = "COALESCE(ep.position_name, ss.position_name, '')";
    const professionCaseSql = buildProfessionCaseSql(positionExpr);
    const clauses = [buildPeriodOverlapClause()];
    if (whereClause) clauses.push(whereClause.replace(/^WHERE\s+/i, ""));
    const finalWhere = `WHERE ${clauses.join(" AND ")}`;

    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          profession_code,
          profession_name,
          COUNT(*) AS leave_count
        FROM (
          SELECT
            ${professionCaseSql} AS profession_code,
            COALESCE(
              CASE ${professionCaseSql}
                WHEN 'DENTIST' THEN 'ทันตแพทย์'
                WHEN 'DOCTOR' THEN 'แพทย์'
                WHEN 'PHARMACIST' THEN 'เภสัชกร'
                WHEN 'NURSE' THEN 'พยาบาล'
                WHEN 'MED_TECH' THEN 'นักเทคนิคการแพทย์'
                WHEN 'RAD_TECH' THEN 'นักรังสีการแพทย์'
                WHEN 'PHYSIO' THEN 'นักกายภาพบำบัด'
                WHEN 'OCC_THERAPY' THEN 'นักกิจกรรมบำบัด'
                WHEN 'CLIN_PSY' THEN 'นักจิตวิทยาคลินิก'
                WHEN 'SPEECH_THERAPIST' THEN 'นักแก้ไขการพูด'
                WHEN 'SPECIAL_EDU' THEN 'การศึกษาพิเศษ'
                WHEN 'CARDIO_TECH' THEN 'นักเทคโนโลยีหัวใจและทรวงอก'
                ELSE 'ไม่ระบุวิชาชีพ'
              END,
              'ไม่ระบุวิชาชีพ'
            ) AS profession_name
          FROM leave_records lr
          LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
          LEFT JOIN emp_profiles ep ON lr.citizen_id = ep.citizen_id
          LEFT JOIN emp_support_staff ss ON lr.citizen_id = ss.citizen_id
          ${finalWhere}
        ) grouped_leaves
        GROUP BY profession_code, profession_name
        ORDER BY profession_name ASC
      `,
      [end_date, start_date, ...values],
    );

    return rows.map((row: any) => ({
      profession_code: row.profession_code === null || row.profession_code === undefined ? null : String(row.profession_code),
      profession_name: String(row.profession_name ?? "ไม่ระบุวิชาชีพ"),
      leave_count: Number(row.leave_count ?? 0),
    }));
  }

  async getStats(): Promise<LeaveManagementStats> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(lr.leave_type) = 'education' THEN 1 ELSE 0 END) AS study,
          SUM(
            CASE
              WHEN ext.require_return_report = 1
               AND (ext.return_report_status IS NULL OR ext.return_report_status != 'DONE')
              THEN 1 ELSE 0
            END
          ) AS pending_report
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
      `,
    );
    const row = rows[0] as any;
    return {
      total: Number(row?.total ?? 0),
      study: Number(row?.study ?? 0),
      pending_report: Number(row?.pending_report ?? 0),
    };
  }

  async upsertExtension(
    data: LeaveManagementExtensionBody & {
      created_by?: number | null;
      updated_by?: number | null;
    },
  ): Promise<void> {
    const sql = `
      INSERT INTO leave_record_extensions (
        leave_record_id,
        document_start_date,
        document_end_date,
        document_duration_days,
        require_return_report,
        return_report_status,
        return_date,
        return_remark,
        pay_exception,
        is_no_pay,
        pay_exception_reason,
        study_institution,
        study_program,
        study_major,
        study_start_date,
        study_note,
        note,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        document_start_date = VALUES(document_start_date),
        document_end_date = VALUES(document_end_date),
        document_duration_days = VALUES(document_duration_days),
        require_return_report = VALUES(require_return_report),
        return_report_status = VALUES(return_report_status),
        return_date = VALUES(return_date),
        return_remark = VALUES(return_remark),
        pay_exception = VALUES(pay_exception),
        is_no_pay = VALUES(is_no_pay),
        pay_exception_reason = VALUES(pay_exception_reason),
        study_institution = VALUES(study_institution),
        study_program = VALUES(study_program),
        study_major = VALUES(study_major),
        study_start_date = VALUES(study_start_date),
        study_note = VALUES(study_note),
        note = VALUES(note),
        updated_by = VALUES(updated_by)
    `;

    const values = [
      data.leave_management_id,
      data.document_start_date ?? null,
      data.document_end_date ?? null,
      data.document_duration_days ?? null,
      data.require_return_report ?? 0,
      data.return_report_status ?? null,
      data.return_date ?? null,
      data.return_remark ?? null,
      data.pay_exception ?? 0,
      data.is_no_pay ?? 0,
      data.pay_exception_reason ?? null,
      data.study_institution ?? null,
      data.study_program ?? null,
      data.study_major ?? null,
      data.study_start_date ?? null,
      data.study_note ?? null,
      data.note ?? null,
      data.created_by ?? null,
      data.updated_by ?? null,
    ];

    await db.execute<ResultSetHeader>(sql, values);
  }

  async replaceLeaveReturnReportEvents(
    leaveRecordId: number,
    events: LeaveReturnReportEventInput[],
    actorId?: number | null,
  ): Promise<void> {
    try {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute<ResultSetHeader>(
          `DELETE FROM leave_return_report_events WHERE leave_record_id = ?`,
          [leaveRecordId],
        );

        if (events.length > 0) {
          for (const event of events) {
            await conn.execute<ResultSetHeader>(
              `
                INSERT INTO leave_return_report_events (
                  leave_record_id,
                  report_date,
                  resume_date,
                  resume_study_program,
                  created_by
                ) VALUES (?, ?, ?, ?, ?)
              `,
              [
                leaveRecordId,
                event.report_date,
                event.resume_date ?? null,
                event.resume_study_program ?? null,
                actorId ?? null,
              ],
            );
          }
        }

        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error: any) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        return;
      }
      throw error;
    }
  }

  async insertDocument(data: LeaveManagementDocumentInput): Promise<number> {
    const [res] = await db.execute<ResultSetHeader>(
      `INSERT INTO leave_record_documents
       (leave_record_id, file_name, file_type, file_size, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.leave_management_id,
        data.file_name,
        data.file_type,
        data.file_size,
        data.file_path,
        data.uploaded_by ?? null,
      ],
    );
    return res.insertId;
  }

  async listDocuments(leaveManagementId: number): Promise<LeaveManagementDocumentRow[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM leave_record_documents WHERE leave_record_id = ? ORDER BY uploaded_at DESC`,
      [leaveManagementId],
    );
    return rows as LeaveManagementDocumentRow[];
  }

  async findDocumentById(documentId: number): Promise<LeaveManagementDocumentRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM leave_record_documents WHERE document_id = ? LIMIT 1`,
      [documentId],
    );
    return (rows[0] as LeaveManagementDocumentRow) ?? null;
  }

  async deleteDocument(documentId: number): Promise<boolean> {
    const [res] = await db.execute<ResultSetHeader>(
      `DELETE FROM leave_record_documents WHERE document_id = ?`,
      [documentId],
    );
    return res.affectedRows > 0;
  }

  async deleteExtension(leaveManagementId: number): Promise<boolean> {
    const [res] = await db.execute<ResultSetHeader>(
      `DELETE FROM leave_record_extensions WHERE leave_record_id = ?`,
      [leaveManagementId],
    );
    return res.affectedRows > 0;
  }

  async listLeaveManagementRowsForQuota(
    citizenId: string,
    fiscalYear: number,
  ): Promise<LeaveQuotaLeaveRow[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT lr.id,
               lr.citizen_id,
               lr.leave_type,
               lr.start_date,
               lr.end_date,
               lr.duration_days,
               lr.remark,
               ext.document_start_date,
               ext.document_end_date,
               ext.document_duration_days,
               ext.is_no_pay,
               ext.pay_exception,
               ext.study_institution,
               ext.study_program,
               ext.study_major
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        WHERE lr.citizen_id = ? AND lr.fiscal_year = ?
        ORDER BY lr.start_date ASC, lr.id ASC
      `,
      [citizenId, fiscalYear],
    );
    return rows as LeaveQuotaLeaveRow[];
  }

  async findQuotaRow(
    citizenId: string,
    fiscalYear: number,
  ): Promise<LeaveQuotaRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM leave_quotas WHERE citizen_id = ? AND fiscal_year = ? LIMIT 1`,
      [citizenId, fiscalYear],
    );
    return (rows[0] as LeaveQuotaRow) ?? null;
  }

  async findLatestQuotaRowBeforeFiscalYear(
    citizenId: string,
    fiscalYear: number,
  ): Promise<LeaveQuotaRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT *
        FROM leave_quotas
        WHERE citizen_id = ?
          AND fiscal_year < ?
        ORDER BY fiscal_year DESC
        LIMIT 1
      `,
      [citizenId, fiscalYear],
    );
    return (rows[0] as LeaveQuotaRow) ?? null;
  }

  async findHolidaysForFiscalYear(fiscalYear: number): Promise<string[]> {
    const start = `${fiscalYear - 1}-01-01`;
    const end = `${fiscalYear}-12-31`;
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT holiday_date
        FROM cfg_holidays
        WHERE is_active = 1
          AND holiday_date BETWEEN ? AND ?
      `,
      [start, end],
    );
    return (rows as any[]).map((row) => String(row.holiday_date));
  }

  async findEmployeeServiceDates(
    citizenId: string,
  ): Promise<EmployeeServiceDatesRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT start_work_date, first_entry_date FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    );
    return (rows[0] as EmployeeServiceDatesRow) ?? null;
  }

  async listLeaveReturnReportEventsByLeaveIds(
    leaveRecordIds: number[],
  ): Promise<LeaveReturnReportEventRow[]> {
    const uniqueIds = Array.from(
      new Set(
        (leaveRecordIds ?? []).filter(
          (id) => Number.isFinite(Number(id)) && Number(id) > 0,
        ),
      ),
    );
    if (uniqueIds.length === 0) return [];

    const placeholders = uniqueIds.map(() => "?").join(",");
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `
          SELECT
            event_id,
            leave_record_id,
            report_date,
            resume_date,
            resume_study_institution,
            resume_study_program,
            resume_study_major,
            remark,
            created_at
          FROM leave_return_report_events
          WHERE leave_record_id IN (${placeholders})
          ORDER BY leave_record_id ASC, report_date ASC, event_id ASC
        `,
        uniqueIds,
      );
      return rows as LeaveReturnReportEventRow[];
    } catch (error: any) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        return [];
      }
      throw error;
    }
  }

  async findExtensionReturnMeta(
    leaveRecordId: number,
  ): Promise<{ require_return_report: number | null } | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT require_return_report
        FROM leave_record_extensions
        WHERE leave_record_id = ?
        LIMIT 1
      `,
      [leaveRecordId],
    );
    const row = rows[0] as any;
    if (!row) return null;
    return {
      require_return_report:
        row.require_return_report === null || row.require_return_report === undefined
          ? null
          : Number(row.require_return_report),
    };
  }

  async upsertLegacyReturnReportCompat(
    leaveRecordId: number,
    input: {
      require_return_report: number;
      return_report_status: "PENDING" | "DONE" | "NOT_REQUIRED";
      return_date: string | null;
      actor_id?: number | null;
    },
  ): Promise<void> {
    await db.execute<ResultSetHeader>(
      `
        INSERT INTO leave_record_extensions (
          leave_record_id,
          require_return_report,
          return_report_status,
          return_date,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          require_return_report = VALUES(require_return_report),
          return_report_status = VALUES(return_report_status),
          return_date = VALUES(return_date),
          updated_by = VALUES(updated_by)
      `,
      [
        leaveRecordId,
        input.require_return_report,
        input.return_report_status,
        input.return_date,
        input.actor_id ?? null,
        input.actor_id ?? null,
      ],
    );
  }
}
