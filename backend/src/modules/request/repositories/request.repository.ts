/**
 * src/modules/request/repositories/request.repository.ts
 */
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from '@config/database.js';
import {
  RequestSubmissionEntity,
  RequestAttachmentEntity,
  RequestApprovalEntity,
} from '@/modules/request/entities/request.entity.js';
import { ELIGIBILITY_EXPIRING_DAYS } from '@/modules/request/request.constants.js';

export class RequestRepository {
  // Helper to choose between Connection (Transaction) or Pool (Auto-commit)
  private getDb(connection?: PoolConnection) {
    return connection || pool;
  }

  // --- READ Operations ---

  async findEligibilityList(
    activeOnly: boolean = true,
    connection?: PoolConnection,
  ): Promise<RowDataPacket[]> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        e.eligibility_id,
        e.user_id,
        e.citizen_id,
        e.master_rate_id,
        e.request_id,
        e.effective_date,
        e.expiry_date,
        e.is_active,
        e.created_at,
        rs.request_no,
        ep.title,
        ep.first_name,
        ep.last_name,
        ep.position_name,
        ep.position_number,
        ep.department,
        ep.sub_department,
        ep.email,
        ep.phone,
        r.profession_code,
        r.group_no,
        r.item_no,
        r.sub_item_no,
        r.amount AS rate_amount
      FROM req_eligibility e
      LEFT JOIN req_submissions rs ON rs.request_id = e.request_id
      LEFT JOIN emp_profiles ep ON ep.citizen_id = e.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = e.master_rate_id
      WHERE (? = 0 OR e.is_active = 1)
      ORDER BY e.is_active DESC, e.effective_date DESC, e.eligibility_id DESC
      `,
      [activeOnly ? 1 : 0],
    );
    return rows;
  }

  private buildEligibilityWhere(filters: {
    activeOnly: boolean;
    professionCode?: string | null;
    search?: string | null;
    rateGroup?: string | null;
    department?: string | null;
    subDepartment?: string | null;
    licenseStatus?: "active" | "expiring" | "expired" | null;
    expiringDays?: number;
  }) {
    const where: string[] = [];
    const params: any[] = [];

    // Active-only toggle
    where.push("(? = 0 OR e.is_active = 1)");
    params.push(filters.activeOnly ? 1 : 0);

    if (filters.professionCode && filters.professionCode !== "ALL") {
      where.push("r.profession_code = ?");
      params.push(filters.professionCode);
    }

    if (filters.rateGroup && filters.rateGroup !== "all") {
      where.push("r.group_no = ?");
      params.push(Number(filters.rateGroup));
    }

    if (filters.department) {
      where.push("ep.department = ?");
      params.push(filters.department);
    }

    if (filters.subDepartment) {
      where.push("ep.sub_department = ?");
      params.push(filters.subDepartment);
    }

    const expiringDays = filters.expiringDays ?? ELIGIBILITY_EXPIRING_DAYS;
    if (filters.licenseStatus === "expired") {
      where.push("e.expiry_date IS NOT NULL AND e.expiry_date < NOW()");
    } else if (filters.licenseStatus === "expiring") {
      where.push(
        "e.expiry_date IS NOT NULL AND e.expiry_date >= NOW() AND e.expiry_date <= DATE_ADD(NOW(), INTERVAL ? DAY)",
      );
      params.push(expiringDays);
    } else if (filters.licenseStatus === "active") {
      // Treat missing expiry_date as active
      where.push(
        "(e.expiry_date IS NULL OR e.expiry_date > DATE_ADD(NOW(), INTERVAL ? DAY))",
      );
      params.push(expiringDays);
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      where.push(
        "(ep.first_name LIKE ? OR ep.last_name LIKE ? OR ep.title LIKE ? OR CONCAT(ep.first_name,' ',ep.last_name) LIKE ?)",
      );
      params.push(q, q, q, q);
    }

    return { where: where.join(" AND "), params };
  }

  async findEligibilityListPaged(
    filters: {
      activeOnly: boolean;
      professionCode?: string | null;
      search?: string | null;
      rateGroup?: string | null;
      department?: string | null;
      subDepartment?: string | null;
      licenseStatus?: "active" | "expiring" | "expired" | null;
      expiringDays?: number;
    },
    page: number,
    limit: number,
    connection?: PoolConnection,
  ): Promise<RowDataPacket[]> {
    const db = this.getDb(connection);
    const offset = (page - 1) * limit;
    const { where, params } = this.buildEligibilityWhere(filters);

    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        e.eligibility_id,
        e.user_id,
        e.master_rate_id,
        e.request_id,
        e.effective_date,
        e.expiry_date,
        e.is_active,
        e.created_at,
        rs.request_no,
        ep.title,
        ep.first_name,
        ep.last_name,
        ep.position_name,
        ep.position_number,
        ep.department,
        ep.sub_department,
        ep.emp_type,
        ep.original_status,
        ep.email,
        ep.phone,
        r.profession_code,
        r.group_no,
        r.item_no,
        r.sub_item_no,
        r.amount AS rate_amount
      FROM req_eligibility e
      LEFT JOIN req_submissions rs ON rs.request_id = e.request_id
      LEFT JOIN emp_profiles ep ON ep.citizen_id = e.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = e.master_rate_id
      WHERE ${where}
      ORDER BY e.is_active DESC, e.effective_date DESC, e.eligibility_id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );
    return rows;
  }

  async findEligibilityListMeta(
    filters: {
      activeOnly: boolean;
      professionCode?: string | null;
      search?: string | null;
      rateGroup?: string | null;
      department?: string | null;
      subDepartment?: string | null;
      licenseStatus?: "active" | "expiring" | "expired" | null;
      expiringDays?: number;
    },
    connection?: PoolConnection,
  ): Promise<{ total: number; total_rate_amount: number; updated_at: string | null }> {
    const db = this.getDb(connection);
    const { where, params } = this.buildEligibilityWhere(filters);

    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(COALESCE(r.amount, 0)), 0) AS total_rate_amount,
        MAX(e.created_at) AS updated_at
      FROM req_eligibility e
      LEFT JOIN emp_profiles ep ON ep.citizen_id = e.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = e.master_rate_id
      WHERE ${where}
      `,
      params,
    );

    const row = rows[0] || ({} as any);
    return {
      total: Number(row.total ?? 0),
      total_rate_amount: Number(row.total_rate_amount ?? 0),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async findEligibilitySummary(
    activeOnly: boolean = true,
    connection?: PoolConnection,
  ): Promise<RowDataPacket[]> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(r.profession_code, '-') AS profession_code,
        COUNT(*) AS people_count,
        COALESCE(SUM(COALESCE(r.amount, 0)), 0) AS total_rate_amount,
        MAX(e.created_at) AS updated_at
      FROM req_eligibility e
      LEFT JOIN cfg_payment_rates r ON r.rate_id = e.master_rate_id
      WHERE (? = 0 OR e.is_active = 1)
      GROUP BY COALESCE(r.profession_code, '-')
      ORDER BY people_count DESC
      `,
      [activeOnly ? 1 : 0],
    );
    return rows;
  }

  async findEligibilityById(
    eligibilityId: number,
    connection?: PoolConnection,
  ): Promise<RowDataPacket | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        e.eligibility_id,
        e.user_id,
        e.citizen_id,
        e.master_rate_id,
        e.request_id,
        e.effective_date,
        e.expiry_date,
        e.reference_doc_no,
        e.is_active,
        e.created_at,
        rs.request_no,
        rs.personnel_type,
        rs.request_type,
        rs.work_attributes,
        rs.main_duty,
        rs.submission_data,
        ep.title,
        ep.first_name,
        ep.last_name,
        ep.position_name,
        ep.position_number,
        ep.department,
        ep.sub_department,
        ep.mission_group,
        ep.emp_type,
        ep.specialist,
        ep.expert,
        ep.start_work_date,
        ep.first_entry_date,
        ep.email,
        ep.phone,
        r.profession_code,
        r.group_no,
        r.item_no,
        r.sub_item_no,
        r.amount AS rate_amount
      FROM req_eligibility e
      LEFT JOIN req_submissions rs ON rs.request_id = e.request_id
      LEFT JOIN emp_profiles ep ON ep.citizen_id = e.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = e.master_rate_id
      WHERE e.eligibility_id = ?
      LIMIT 1
      `,
      [eligibilityId],
    );
    return rows[0] ?? null;
  }

  async findLatestLicenseByCitizenId(
    citizenId: string,
    connection?: PoolConnection,
  ): Promise<RowDataPacket | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        license_id,
        citizen_id,
        license_name,
        license_no,
        valid_from,
        valid_until,
        status,
        synced_at
      FROM emp_licenses
      WHERE citizen_id = ?
      ORDER BY valid_until DESC, valid_from DESC, license_id DESC
      LIMIT 1
      `,
      [citizenId],
    );
    return rows[0] ?? null;
  }

  async findById(
    requestId: number,
    connection?: PoolConnection,
  ): Promise<RequestSubmissionEntity | null> {
    const db = this.getDb(connection);
    // Add FOR UPDATE if inside a Transaction to prevent Race Condition
    const sql = `
      SELECT
        r.*,
        e.department as emp_department,
        e.sub_department as emp_sub_department,
        e.position_name,
        e.first_name,
        e.last_name,
        (
          SELECT l.license_no
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_no,
        (
          SELECT l.license_name
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_name,
        (
          SELECT l.valid_from
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_valid_from,
        (
          SELECT l.valid_until
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_valid_until,
        (
          SELECT l.status
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_raw_status
      FROM req_submissions r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      WHERE r.request_id = ? ${connection ? "FOR UPDATE" : ""}
    `;
    const [rows] = await db.query<RowDataPacket[]>(sql, [requestId]);
    return (rows[0] as RequestSubmissionEntity) || null;
  }

  async findByRequestNo(
    requestNo: string,
    connection?: PoolConnection,
  ): Promise<RequestSubmissionEntity | null> {
    const db = this.getDb(connection);
    const sql = `
      SELECT
        r.*,
        e.department as emp_department,
        e.sub_department as emp_sub_department,
        e.position_name,
        e.first_name,
        e.last_name,
        (
          SELECT l.license_no
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_no,
        (
          SELECT l.license_name
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_name,
        (
          SELECT l.valid_from
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_valid_from,
        (
          SELECT l.valid_until
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_valid_until,
        (
          SELECT l.status
          FROM emp_licenses l
          WHERE l.citizen_id = u.citizen_id
          ORDER BY
            l.valid_until DESC,
            l.valid_from DESC,
            l.license_id DESC
          LIMIT 1
        ) AS license_raw_status
      FROM req_submissions r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      WHERE r.request_no = ? ${connection ? "FOR UPDATE" : ""}
    `;
    const [rows] = await db.query<RowDataPacket[]>(sql, [requestNo]);
    return (rows[0] as RequestSubmissionEntity) || null;
  }

  async findByUserId(userId: number): Promise<RequestSubmissionEntity[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, u.citizen_id, u.role
       FROM req_submissions r
       JOIN users u ON r.user_id = u.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId],
    );
    return rows as RequestSubmissionEntity[];
  }

  async getScopeMappings(
    userId: number,
    role: string,
    connection?: PoolConnection,
  ): Promise<{ scope_type: string; scope_name: string }[]> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT scope_type, scope_name
       FROM special_position_scope_map
       WHERE user_id = ? AND role = ? AND is_active = 1
       ORDER BY scope_type, scope_name`,
      [userId, role],
    );
    return rows as { scope_type: string; scope_name: string }[];
  }

  async getScopeMappingsByCitizenId(
    citizenId: string,
    role: string,
    connection?: PoolConnection,
  ): Promise<{ scope_type: string; scope_name: string }[]> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT scope_type, scope_name
       FROM special_position_scope_map
       WHERE citizen_id = ? AND role = ? AND is_active = 1
       ORDER BY scope_type, scope_name`,
      [citizenId, role],
    );
    return rows as { scope_type: string; scope_name: string }[];
  }

  async findEmployeesInScope(
    scopeType: "UNIT" | "DEPT",
    scopeName: string,
    connection?: PoolConnection,
  ): Promise<
    {
      citizen_id: string;
      title: string | null;
      first_name: string | null;
      last_name: string | null;
      position_name: string | null;
      department: string | null;
      sub_department: string | null;
      original_status: string | null;
      user_role: string | null;
    }[]
  > {
    const db = this.getDb(connection);
    const whereColumn = scopeType === "UNIT" ? "sub_department" : "department";
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          citizen_id,
          title,
          first_name,
          last_name,
          position_name,
          department,
          sub_department,
          original_status,
          (
            SELECT u.role
            FROM users u
            WHERE u.citizen_id = emp_profiles.citizen_id
            ORDER BY u.id DESC
            LIMIT 1
          ) AS user_role
        FROM emp_profiles
        WHERE LOWER(TRIM(${whereColumn})) = LOWER(TRIM(?))
          AND (
            original_status IS NULL
            OR UPPER(TRIM(original_status)) IN ('A', 'ACTIVE', '1')
            OR original_status LIKE 'ปฏิบัติงาน%'
          )
          AND (original_status IS NULL OR original_status NOT LIKE 'ไม่ปฏิบัติงาน%')
        ORDER BY
          first_name ASC,
          last_name ASC
      `,
      [scopeName],
    );
    return rows as {
      citizen_id: string;
      title: string | null;
      first_name: string | null;
      last_name: string | null;
      position_name: string | null;
      department: string | null;
      sub_department: string | null;
      original_status: string | null;
      user_role: string | null;
    }[];
  }

  async findPeerUserIdsByScope(
    role: string,
    scopeTypes: Array<"UNIT" | "DEPT">,
    scopeNames: string[],
  ): Promise<number[]> {
    if (!scopeTypes.length || !scopeNames.length) {
      return [];
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT DISTINCT u.id
        FROM users u
        JOIN special_position_scope_map m
          ON u.id = m.user_id
        WHERE u.role = ?
          AND m.role = ?
          AND m.is_active = 1
          AND m.scope_type IN (?)
          AND m.scope_name IN (?)
      `,
      [role, role, scopeTypes, scopeNames],
    );
    return rows.map((row) => row.id as number).filter((id) => Boolean(id));
  }

  async findUserIdsByRole(role: string): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id
       FROM users
       WHERE role = ?
         AND is_active = 1`,
      [role],
    );
    return rows.map((row) => row.id as number).filter((id) => Boolean(id));
  }

  async disableScopeMappings(
    userId: number,
    role: string,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.query(
      `UPDATE special_position_scope_map
       SET is_active = 0, updated_at = NOW()
       WHERE user_id = ? AND role = ?`,
      [userId, role],
    );
  }

  async disableScopeMappingsByCitizenId(
    citizenId: string,
    role: string,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.query(
      `UPDATE special_position_scope_map
       SET is_active = 0, updated_at = NOW()
       WHERE citizen_id = ? AND role = ?`,
      [citizenId, role],
    );
  }

  async insertScopeMappings(
    inputs: Array<{
      user_id?: number | null;
      citizen_id: string;
      role: string;
      scope_type: "UNIT" | "DEPT";
      scope_name: string;
      source: "AUTO" | "MANUAL";
      created_by?: number | null;
    }>,
    connection?: PoolConnection,
  ): Promise<void> {
    if (!inputs.length) return;
    const db = this.getDb(connection);
    const values = inputs.map((i) => [
      i.user_id ?? null,
      i.citizen_id,
      i.role,
      i.scope_type,
      i.scope_name,
      i.source,
      i.created_by ?? null,
    ]);
    await db.query(
      `INSERT INTO special_position_scope_map
       (user_id, citizen_id, role, scope_type, scope_name, source, created_by)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         is_active = 1,
         source = VALUES(source),
         created_by = VALUES(created_by),
         updated_at = NOW()`,
      [values],
    );
  }

  async findPendingByStep(
    stepNo: number,
    userId?: number,
    extraWhere = "",
    extraParams: any[] = [],
  ): Promise<RequestSubmissionEntity[]> {
    if (userId) {
      /* no-op or use in future */
    }
    let sql = `
      SELECT r.*,
             e.department AS emp_department,
             e.sub_department AS emp_sub_department,
             CASE WHEN vs.snapshot_id IS NULL THEN 0 ELSE 1 END AS has_verification_snapshot
      FROM req_submissions r
      LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
      LEFT JOIN (
        SELECT request_id, MAX(snapshot_id) AS snapshot_id
        FROM req_verification_snapshots
        GROUP BY request_id
      ) vs ON vs.request_id = r.request_id
      WHERE r.status = 'PENDING' AND r.current_step = ?
    `;

    const params: any[] = [stepNo];

    if (extraWhere) {
      sql += ` ${extraWhere}`;
      params.push(...extraParams);
    }

    sql += " ORDER BY r.created_at ASC";

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as RequestSubmissionEntity[];
  }

  async findPendingByStepForOfficer(
    stepNo: number,
    officerId: number,
  ): Promise<RequestSubmissionEntity[]> {
    const baseSelect = `
      SELECT r.*,
             e.department AS emp_department,
             e.sub_department AS emp_sub_department,
             CASE WHEN vs.snapshot_id IS NULL THEN 0 ELSE 1 END AS has_verification_snapshot
      FROM req_submissions r
      LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
      LEFT JOIN (
        SELECT request_id, MAX(snapshot_id) AS snapshot_id
        FROM req_verification_snapshots
        GROUP BY request_id
      ) vs ON vs.request_id = r.request_id
      WHERE r.status = 'PENDING' AND r.current_step = ?
    `;

    const sql = `
      (${baseSelect} AND r.assigned_officer_id = ?)
      UNION ALL
      (${baseSelect} AND r.assigned_officer_id IS NULL)
      ORDER BY created_at ASC
    `;

    const params = [stepNo, officerId, stepNo];
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as RequestSubmissionEntity[];
  }

  async findAttachments(requestId: number): Promise<RequestAttachmentEntity[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM req_attachments WHERE request_id = ? ORDER BY uploaded_at DESC`,
      [requestId],
    );
    return rows as RequestAttachmentEntity[];
  }

  async findAttachmentById(attachmentId: number): Promise<RequestAttachmentEntity | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM req_attachments WHERE attachment_id = ?`,
      [attachmentId],
    );
    return (rows[0] as RequestAttachmentEntity) || null;
  }

  async findApprovals(requestId: number): Promise<RequestApprovalEntity[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM req_approvals WHERE request_id = ? ORDER BY created_at ASC`,
      [requestId],
    );
    return rows as RequestApprovalEntity[];
  }

  async findApprovalHistoryIdsForActors(
    actorIds: number[],
    actions?: string[],
  ): Promise<{ request_id: number; last_action_date: Date }[]> {
    if (!actorIds.length) return [];
    const where = ["actor_id IN (?)"];
    const params: any[] = [actorIds];
    if (actions && actions.length > 0) {
      where.push("action IN (?)");
      params.push(actions);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT request_id, MAX(created_at) as last_action_date
       FROM req_approvals
       WHERE ${where.join(" AND ")}
       GROUP BY request_id
       ORDER BY last_action_date DESC`,
      params,
    );
    return rows as { request_id: number; last_action_date: Date }[];
  }

  // --- Advanced Reads for Query Service ---

  async findApprovalHistoryIds(
    actorId: number,
    actions: string[] = ["APPROVE", "REJECT", "RETURN"],
  ): Promise<{ request_id: number; last_action_date: Date }[]> {
    const where = ["actor_id = ?"];
    const params: any[] = [actorId];
    if (actions.length > 0) {
      where.push("action IN (?)");
      params.push(actions);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT request_id, MAX(created_at) as last_action_date
       FROM req_approvals
       WHERE ${where.join(" AND ")}
       GROUP BY request_id
       ORDER BY last_action_date DESC`,
      params,
    );
    return rows as { request_id: number; last_action_date: Date }[];
  }

  async findByIds(requestIds: number[]): Promise<RequestSubmissionEntity[]> {
    if (requestIds.length === 0) return [];

    const placeholder = requestIds.map(() => "?").join(",");
    const sql = `
      SELECT r.*,
             e.department AS emp_department,
             e.sub_department AS emp_sub_department
      FROM req_submissions r
      LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
      WHERE r.request_id IN (${placeholder})
      ORDER BY r.updated_at DESC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(sql, requestIds);
    return rows as RequestSubmissionEntity[];
  }

  // Fetch Attachments
  async findAttachmentsWithMetadata(requestId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM req_attachments WHERE request_id = ? ORDER BY uploaded_at DESC`,
      [requestId],
    );
    return rows;
  }

  // Fetch Approval Logs with Actor info
  async findApprovalsWithActor(requestId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*,
              u.citizen_id as actor_citizen_id,
              u.role as actor_role,
              COALESCE(e.first_name, s.first_name) as actor_first_name,
              COALESCE(e.last_name, s.last_name) as actor_last_name
       FROM req_approvals a
       JOIN users u ON a.actor_id = u.id
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       WHERE a.request_id = ?
       ORDER BY a.created_at ASC`,
      [requestId],
    );
    return rows;
  }

  // Fetch Approver Signature (read-only from sig_images)
  async findSignatureSnapshot(
    citizenId: string,
    connection?: PoolConnection,
  ): Promise<Buffer | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT signature_image FROM sig_images WHERE citizen_id = ? LIMIT 1",
      [citizenId],
    );
    if (rows.length && rows[0].signature_image) {
      return rows[0].signature_image;
    }
    return null;
  }

  // Fetch applicant signature attachment path (for submit snapshot)
  async findSignatureAttachmentPath(
    requestId: number,
    connection?: PoolConnection,
  ): Promise<string | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT file_path
       FROM req_attachments
       WHERE request_id = ? AND file_type = 'SIGNATURE'
       ORDER BY uploaded_at DESC
       LIMIT 1`,
      [requestId],
    );
    return rows.length ? (rows[0].file_path as string) : null;
  }

  // Find Master Rate
  async findMatchingRateId(
    amount: number,
    professionCode?: string,
    connection?: PoolConnection,
  ): Promise<number | null> {
    const db = this.getDb(connection);
    let sql = `SELECT rate_id FROM cfg_payment_rates WHERE amount = ? AND is_active = 1`;
    const params: (string | number)[] = [amount];

    if (professionCode) {
      sql += ` AND profession_code = ?`;
      params.push(professionCode);
    }
    sql += ` LIMIT 1`;

    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows.length ? rows[0].rate_id : null;
  }

  // --- Employee / Signature / Eligibility Reads ---

  async findEmployeeProfile(
    citizenId: string,
    connection?: PoolConnection,
  ): Promise<RowDataPacket | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT citizen_id, title, first_name, last_name, emp_type,
              position_name, position_number, department, sub_department, mission_group
       FROM emp_profiles WHERE citizen_id = ?`,
      [citizenId],
    );
    return rows[0] ?? null;
  }

  async findEmployeeExists(
    citizenId: string,
    connection?: PoolConnection,
  ): Promise<boolean> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT 1 FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    );
    return rows.length > 0;
  }

  async findSignatureIdByUserId(
    userId: number,
    connection?: PoolConnection,
  ): Promise<number | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT s.signature_id
        FROM sig_images s
        LEFT JOIN users u ON u.id = ?
        WHERE s.user_id = ?
           OR (u.citizen_id IS NOT NULL AND s.citizen_id = u.citizen_id)
        LIMIT 1
      `,
      [userId, userId],
    );
    return rows.length ? (rows[0].signature_id as number) : null;
  }

  async deactivateEligibility(
    userId: number | null,
    citizenId: string,
    effectiveDate: string,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.execute(
      `UPDATE req_eligibility
         SET is_active = 0, expiry_date = DATE_SUB(?, INTERVAL 1 DAY)
         WHERE (user_id = ? OR (user_id IS NULL AND citizen_id = ?))
           AND is_active = 1
           AND effective_date <= ?`,
      [effectiveDate, userId, citizenId, effectiveDate],
    );
  }

  async insertEligibility(
    userId: number | null,
    citizenId: string,
    masterRateId: number,
    requestId: number,
    effectiveDate: string,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO req_eligibility
         (user_id, citizen_id, master_rate_id, request_id, effective_date, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
      [userId, citizenId, masterRateId, requestId, effectiveDate],
    );
  }

  async insertVerificationSnapshot(
    data: {
      request_id: number;
      user_id: number | null;
      citizen_id: string;
      master_rate_id: number;
      effective_date: string;
      expiry_date?: string | null;
      snapshot_data: Record<string, unknown>;
      created_by?: number | null;
    },
    connection: PoolConnection,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO req_verification_snapshots
       (request_id, user_id, citizen_id, master_rate_id, effective_date, expiry_date, snapshot_data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.request_id,
        data.user_id ?? null,
        data.citizen_id,
        data.master_rate_id,
        data.effective_date,
        data.expiry_date ?? null,
        JSON.stringify(data.snapshot_data),
        data.created_by ?? null,
      ],
    );
    return result.insertId;
  }

  async findVerificationSnapshotById(
    snapshotId: number,
    connection?: PoolConnection,
  ) {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM req_verification_snapshots WHERE snapshot_id = ?`,
      [snapshotId],
    );
    return rows[0] ?? null;
  }

  // --- WRITE Operations ---

  async create(
    data: Partial<RequestSubmissionEntity>,
    connection: PoolConnection,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO req_submissions
       (user_id, citizen_id, request_no, personnel_type, current_position_number, current_department,
        work_attributes, applicant_signature_id, request_type, requested_amount,
        effective_date, status, current_step, submission_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.citizen_id,
        data.request_no ?? null,
        data.personnel_type,
        data.current_position_number ?? null,
        data.current_department ?? null,
        data.work_attributes ? JSON.stringify(data.work_attributes) : null,
        data.applicant_signature_id ?? null,
        data.request_type,
        data.requested_amount,
        data.effective_date,
        data.status || "DRAFT",
        data.current_step || 1,
        data.submission_data ? JSON.stringify(data.submission_data) : null,
      ],
    );
    return result.insertId;
  }

  async update(
    requestId: number,
    data: Partial<RequestSubmissionEntity>,
    connection: PoolConnection,
  ): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const values: any[] = [];
    const setClause = keys
      .map((key) => {
        const val = (data as any)[key];
        if (typeof val === "object" && val !== null && !(val instanceof Date)) {
          values.push(JSON.stringify(val));
        } else {
          values.push(val);
        }
        return `${key} = ?`;
      })
      .join(", ");

    const sql = `UPDATE req_submissions SET ${setClause}, updated_at = NOW() WHERE request_id = ?`;
    await connection.execute(sql, [...values, requestId]);
  }

  async updateRequestNo(
    requestId: number,
    requestNo: string,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.execute(
      "UPDATE req_submissions SET request_no = ? WHERE request_id = ?",
      [requestNo, requestId],
    );
  }

  async insertAttachment(
    data: Omit<RequestAttachmentEntity, "attachment_id" | "uploaded_at">,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO req_attachments (request_id, file_type, file_path, file_name) VALUES (?, ?, ?, ?)`,
      [data.request_id, data.file_type, data.file_path, data.file_name],
    );
  }

  async insertApproval(
    data: Omit<RequestApprovalEntity, "action_id" | "created_at">,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO req_approvals (request_id, actor_id, step_no, action, comment, signature_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.request_id,
        data.actor_id,
        data.step_no,
        data.action,
        data.comment,
        data.signature_snapshot,
      ],
    );
  }

  async delete(requestId: number, connection: PoolConnection): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(`DELETE FROM req_attachments WHERE request_id = ?`, [
      requestId,
    ]);
    await db.execute(`DELETE FROM req_approvals WHERE request_id = ?`, [
      requestId,
    ]);
    await db.execute(`DELETE FROM req_eligibility WHERE request_id = ?`, [
      requestId,
    ]);
    await db.execute(`DELETE FROM req_submissions WHERE request_id = ?`, [
      requestId,
    ]);
  }

  // [NEW] Update Leave Adjustment
  async updateLeaveAdjustment(
    leaveRecordId: number,
    data: {
      manual_start_date: string;
      manual_end_date: string;
      manual_duration_days: number;
      remark: string;
    },
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(
      `INSERT INTO leave_record_extensions (
        leave_record_id,
        document_start_date,
        document_end_date,
        note
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        document_start_date = VALUES(document_start_date),
        document_end_date = VALUES(document_end_date),
        note = VALUES(note)`,
      [
        leaveRecordId,
        data.manual_start_date,
        data.manual_end_date,
        data.remark,
      ],
    );
  }

  // [NEW] Find User Citizen ID
  async findUserCitizenId(userId: number): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT citizen_id FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return rows.length ? (rows[0].citizen_id as string) : null;
  }

  // --- REASSIGN Operations ---

  async findAvailableOfficers(
    excludeUserId: number,
  ): Promise<
    {
      id: number;
      citizen_id: string;
      first_name: string;
      last_name: string;
      workload_count: number;
    }[]
  > {
    // Query finds other PTS_OFFICERs with their current workload
    const sql = `
      SELECT u.id, u.citizen_id, s.first_name, s.last_name,
             (SELECT COUNT(*) FROM req_submissions r
              WHERE r.assigned_officer_id = u.id
                AND r.status = 'PENDING') as workload_count
      FROM users u
      JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.role = 'PTS_OFFICER'
        AND u.is_active = 1
        AND u.id != ?
      ORDER BY workload_count ASC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [excludeUserId]);
    return rows as any[];
  }

  async countActiveOfficers(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM users
       WHERE role = 'PTS_OFFICER'
         AND is_active = 1`,
    );
    return rows.length ? Number(rows[0].total) : 0;
  }

  async findLeastLoadedOfficer(): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT u.id,
             (
               SELECT COUNT(*)
               FROM req_submissions r
               WHERE r.assigned_officer_id = u.id
                 AND r.status = 'PENDING'
             ) AS workload_count
      FROM users u
      WHERE u.role = 'PTS_OFFICER'
        AND u.is_active = 1
      ORDER BY workload_count ASC, u.id ASC
      LIMIT 1
      `,
    );
    return rows.length ? (rows[0].id as number) : null;
  }

  async updateAssignedOfficer(
    requestId: number,
    officerId: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(
      "UPDATE req_submissions SET assigned_officer_id = ?, updated_at = NOW() WHERE request_id = ?",
      [officerId, requestId],
    );
  }

  // --- Scope Resolution ---

  async findCitizenIdByUserId(userId: number): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT citizen_id FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return rows.length ? (rows[0].citizen_id as string) : null;
  }

  async findSpecialPosition(citizenId: string): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT special_position FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    );
    return rows.length ? (rows[0].special_position as string | null) : null;
  }

  async findOriginalStatus(citizenId: string): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT original_status FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    );
    return rows.length ? (rows[0].original_status as string | null) : null;
  }

  // --- Classification / Rate Queries ---

  async findPositionNameByCitizenId(citizenId: string): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT position_name FROM emp_profiles WHERE citizen_id = ? LIMIT 1",
      [citizenId],
    );
    return rows.length ? (rows[0].position_name as string | null) : null;
  }

  async findEmployeeForClassification(
    citizenId: string,
  ): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT citizen_id, position_name, specialist, expert, sub_department, department
       FROM emp_profiles WHERE citizen_id = ?`,
      [citizenId],
    );
    return rows[0] ?? null;
  }

  async findMatchingRate(
    params: {
      groupNo: number;
      professionCode: string;
      itemNo?: string | null;
      subItemNo?: string | null;
    },
  ): Promise<RowDataPacket | null> {
    let sql = `SELECT * FROM cfg_payment_rates
         WHERE group_no = ? AND is_active = 1 AND profession_code = ?`;
    const sqlParams: any[] = [params.groupNo, params.professionCode];

    if (params.itemNo) {
      sql += " AND item_no = ?";
      sqlParams.push(params.itemNo);
    }

    if (params.subItemNo) {
      sql += " AND sub_item_no = ?";
      sqlParams.push(params.subItemNo);
    } else {
      sql += " AND sub_item_no IS NULL";
    }

    sql += " ORDER BY item_no ASC, amount DESC LIMIT 1";

    const [rows] = await pool.query<RowDataPacket[]>(sql, sqlParams);
    return rows[0] ?? null;
  }

  async findAllActiveMasterRates(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cfg_payment_rates WHERE is_active = 1`,
    );
    return rows;
  }

  async findRateByAmount(amount: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM cfg_payment_rates WHERE amount = ? AND is_active = 1 LIMIT 1",
      [amount],
    );
    return rows.length > 0;
  }

  async findRateByDetails(
    professionCode: string,
    groupNo: number,
    itemNo: string | null,
    subItemNo?: string | null,
  ): Promise<RowDataPacket | null> {
    let sql = `SELECT * FROM cfg_payment_rates
               WHERE profession_code = ?
                 AND group_no = ?
                 AND is_active = 1`;
    const params: any[] = [professionCode, groupNo];

    if (itemNo !== null && itemNo !== undefined && itemNo !== "") {
      sql += " AND item_no = ?";
      params.push(itemNo);
    } else {
      sql += " AND item_no IS NULL";
    }

    if (subItemNo !== null && subItemNo !== undefined && subItemNo !== "") {
      sql += " AND sub_item_no = ?";
      params.push(subItemNo);
    } else {
      sql += " AND sub_item_no IS NULL";
    }

    sql += " LIMIT 1";

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows[0] ?? null;
  }

  // Classification Rules removed
}

export const requestRepository = new RequestRepository();
