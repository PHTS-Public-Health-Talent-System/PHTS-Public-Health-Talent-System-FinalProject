/**
 * PHTS System - Data Quality Service
 *
 * Handles data quality checks and dashboard.
 * FR-11-01: Display data issues affecting calculation
 * FR-11-02: Issue count metrics with priority
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query, getConnection } from "../../../config/database.js";
import {
  delCache,
  getJsonCache,
  setJsonCache,
} from "../../../shared/utils/cache.js";

/**
 * Issue types
 */
export enum IssueType {
  LICENSE_EXPIRED = "LICENSE_EXPIRED",
  LICENSE_MISSING = "LICENSE_MISSING",
  LEAVE_QUOTA_MISSING = "LEAVE_QUOTA_MISSING",
  WARD_MAPPING_MISSING = "WARD_MAPPING_MISSING",
  EMPLOYEE_DATA_INCOMPLETE = "EMPLOYEE_DATA_INCOMPLETE",
  RATE_CONFIG_MISSING = "RATE_CONFIG_MISSING",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  OTHER = "OTHER",
}

/**
 * Issue severity
 */
export enum IssueSeverity {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

/**
 * Issue status
 */
export enum IssueStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  IGNORED = "IGNORED",
}

/**
 * Data quality issue
 */
export interface DataQualityIssue {
  issue_id: number;
  issue_type: IssueType;
  severity: IssueSeverity;
  entity_type: string;
  entity_id: number | null;
  citizen_id: string | null;
  description: string;
  affected_calculation: boolean;
  status: IssueStatus;
  detected_at: Date;
  resolved_at: Date | null;
  resolved_by: number | null;
  resolution_note: string | null;
}

/**
 * Issue summary by type
 */
export interface IssueSummary {
  issue_type: IssueType;
  severity: IssueSeverity;
  issue_count: number;
  affecting_calc_count: number;
}

/**
 * Dashboard data
 */
export interface DataQualityDashboard {
  totalIssues: number;
  criticalIssues: number;
  affectingCalculation: number;
  byType: IssueSummary[];
  bySeverity: { severity: IssueSeverity; count: number }[];
  recentIssues: DataQualityIssue[];
}

const DASHBOARD_CACHE_KEY = "data_quality:dashboard";
const DASHBOARD_CACHE_TTL_SECONDS = 120;

/**
 * Get all issues with filters
 */
export async function getIssues(
  type?: IssueType,
  severity?: IssueSeverity,
  status?: IssueStatus,
  affectsCalc?: boolean,
  page: number = 1,
  limit: number = 50,
): Promise<{ issues: DataQualityIssue[]; total: number }> {
  const whereClauses: string[] = ["1=1"];
  const params: any[] = [];

  if (type) {
    whereClauses.push("issue_type = ?");
    params.push(type);
  }

  if (severity) {
    whereClauses.push("severity = ?");
    params.push(severity);
  }

  if (status) {
    whereClauses.push("status = ?");
    params.push(status);
  } else {
    // Default to open issues
    whereClauses.push("status IN ('OPEN', 'IN_PROGRESS')");
  }

  if (affectsCalc !== undefined) {
    whereClauses.push("affected_calculation = ?");
    params.push(affectsCalc ? 1 : 0);
  }

  const whereClause = whereClauses.join(" AND ");

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM dq_issues WHERE ${whereClause}`;
  const countResult = await query<RowDataPacket[]>(countSql, params);
  const total = (countResult as any)[0]?.total || 0;

  // Get issues
  // Note: LIMIT and OFFSET are embedded directly after validation because mysql2
  // prepared statements don't handle them well as parameters (ER_WRONG_ARGUMENTS)
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
  const safeOffset = Math.max(0, Number((page - 1) * limit) || 0);
  const sql = `
    SELECT * FROM dq_issues
    WHERE ${whereClause}
    ORDER BY FIELD(severity, 'HIGH', 'MEDIUM', 'LOW'), detected_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;

  const rows = await query<RowDataPacket[]>(sql, params);

  const issues: DataQualityIssue[] = (rows as any[]).map((row) => ({
    issue_id: row.issue_id,
    issue_type: row.issue_type,
    severity: row.severity,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    citizen_id: row.citizen_id,
    description: row.description,
    affected_calculation: row.affected_calculation === 1,
    status: row.status,
    detected_at: row.detected_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_note: row.resolution_note,
  }));

  return { issues, total };
}

/**
 * Get issue summary
 */
export async function getIssueSummary(): Promise<IssueSummary[]> {
  const sql = `SELECT * FROM vw_data_quality_summary`;
  const rows = await query<RowDataPacket[]>(sql);

  return (rows as any[]).map((row) => ({
    issue_type: row.issue_type,
    severity: row.severity,
    issue_count: row.issue_count,
    affecting_calc_count: row.affecting_calc_count,
  }));
}

/**
 * Get dashboard data
 */
export async function getDashboard(): Promise<DataQualityDashboard> {
  const cached = await getJsonCache<DataQualityDashboard>(DASHBOARD_CACHE_KEY);
  if (cached) {
    return cached;
  }

  // Get summary by type
  const byType = await getIssueSummary();

  // Calculate totals
  let totalIssues = 0;
  let criticalIssues = 0;
  let affectingCalculation = 0;

  const bySeverityMap: Record<IssueSeverity, number> = {
    [IssueSeverity.HIGH]: 0,
    [IssueSeverity.MEDIUM]: 0,
    [IssueSeverity.LOW]: 0,
  };

  for (const item of byType) {
    totalIssues += item.issue_count;
    affectingCalculation += item.affecting_calc_count;

    if (item.severity === IssueSeverity.HIGH) {
      criticalIssues += item.issue_count;
    }

    bySeverityMap[item.severity] =
      (bySeverityMap[item.severity] || 0) + item.issue_count;
  }

  const bySeverity = Object.entries(bySeverityMap).map(([severity, count]) => ({
    severity: severity as IssueSeverity,
    count,
  }));

  // Get recent issues (last 10)
  const recentResult = await getIssues(
    undefined,
    undefined,
    undefined,
    undefined,
    1,
    10,
  );

  const result = {
    totalIssues,
    criticalIssues,
    affectingCalculation,
    byType,
    bySeverity,
    recentIssues: recentResult.issues,
  };

  await setJsonCache(DASHBOARD_CACHE_KEY, result, DASHBOARD_CACHE_TTL_SECONDS);

  return result;
}

/**
 * Create a new issue
 */
export async function createIssue(
  type: IssueType,
  severity: IssueSeverity,
  entityType: string,
  description: string,
  entityId?: number,
  citizenId?: string,
  affectsCalc: boolean = false,
): Promise<number> {
  const sql = `
    INSERT INTO dq_issues
    (issue_type, severity, entity_type, entity_id, citizen_id, description, affected_calculation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await query<ResultSetHeader>(sql, [
    type,
    severity,
    entityType,
    entityId || null,
    citizenId || null,
    description,
    affectsCalc ? 1 : 0,
  ]);

  await delCache(DASHBOARD_CACHE_KEY);

  return result.insertId;
}

/**
 * Update issue status
 */
export async function updateIssueStatus(
  issueId: number,
  status: IssueStatus,
  resolvedBy?: number,
  note?: string,
): Promise<void> {
  let sql = "UPDATE dq_issues SET status = ?";
  const params: any[] = [status];

  if (status === IssueStatus.RESOLVED && resolvedBy) {
    sql += ", resolved_at = NOW(), resolved_by = ?";
    params.push(resolvedBy);
  }

  if (note) {
    sql += ", resolution_note = ?";
    params.push(note);
  }

  sql += " WHERE issue_id = ?";
  params.push(issueId);

  await query(sql, params);

  await delCache(DASHBOARD_CACHE_KEY);
}

/**
 * Run data quality checks and create issues
 * This should be run as a scheduled job
 */
export async function runDataQualityChecks(): Promise<{
  checksRun: number;
  issuesFound: number;
  errors: string[];
}> {
  const result = { checksRun: 0, issuesFound: 0, errors: [] as string[] };

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // 1. Check for expired licenses
    result.checksRun++;
    try {
      const [expiredLicenses] = await connection.query<RowDataPacket[]>(`
        SELECT e.citizen_id, e.first_name, e.last_name, e.license_end_date
        FROM emp_profiles e
        WHERE e.license_end_date IS NOT NULL
          AND e.license_end_date < CURDATE()
          AND NOT EXISTS (
            SELECT 1 FROM dq_issues i
            WHERE i.citizen_id = e.citizen_id
              AND i.issue_type = 'LICENSE_EXPIRED'
              AND i.status IN ('OPEN', 'IN_PROGRESS')
          )
      `);

      for (const emp of expiredLicenses as any[]) {
        await connection.execute(
          `INSERT INTO dq_issues
           (issue_type, severity, entity_type, citizen_id, description, affected_calculation)
           VALUES ('LICENSE_EXPIRED', 'HIGH', 'emp_profiles', ?,
                   ?, 1)`,
          [
            emp.citizen_id,
            `ใบอนุญาตของ ${emp.first_name} ${emp.last_name} หมดอายุวันที่ ${emp.license_end_date}`,
          ],
        );
        result.issuesFound++;
      }
    } catch (error: any) {
      result.errors.push(`License check: ${error.message}`);
    }

    // 2. Check for missing ward mapping
    result.checksRun++;
    try {
      const [missingWard] = await connection.query<RowDataPacket[]>(`
        SELECT e.citizen_id, e.first_name, e.last_name
        FROM emp_profiles e
        WHERE (e.sub_department IS NULL OR e.sub_department = '')
          AND NOT EXISTS (
            SELECT 1 FROM dq_issues i
            WHERE i.citizen_id = e.citizen_id
              AND i.issue_type = 'WARD_MAPPING_MISSING'
              AND i.status IN ('OPEN', 'IN_PROGRESS')
          )
      `);

      for (const emp of missingWard as any[]) {
        await connection.execute(
          `INSERT INTO dq_issues
           (issue_type, severity, entity_type, citizen_id, description, affected_calculation)
           VALUES ('WARD_MAPPING_MISSING', 'MEDIUM', 'emp_profiles', ?,
                   ?, 0)`,
          [
            emp.citizen_id,
            `${emp.first_name} ${emp.last_name} ไม่มีข้อมูล ward/sub_department`,
          ],
        );
        result.issuesFound++;
      }
    } catch (error: any) {
      result.errors.push(`Ward mapping check: ${error.message}`);
    }

    // 3. Check for employees with missing required data
    result.checksRun++;
    try {
      const [incomplete] = await connection.query<RowDataPacket[]>(`
        SELECT e.citizen_id, e.first_name, e.last_name
        FROM emp_profiles e
        WHERE (e.position_name IS NULL OR e.position_name = ''
               OR e.department IS NULL OR e.department = '')
          AND NOT EXISTS (
            SELECT 1 FROM dq_issues i
            WHERE i.citizen_id = e.citizen_id
              AND i.issue_type = 'EMPLOYEE_DATA_INCOMPLETE'
              AND i.status IN ('OPEN', 'IN_PROGRESS')
          )
      `);

      for (const emp of incomplete as any[]) {
        await connection.execute(
          `INSERT INTO dq_issues
           (issue_type, severity, entity_type, citizen_id, description, affected_calculation)
           VALUES ('EMPLOYEE_DATA_INCOMPLETE', 'MEDIUM', 'emp_profiles', ?,
                   ?, 1)`,
          [
            emp.citizen_id,
            `${emp.first_name} ${emp.last_name} ข้อมูลไม่ครบ (ตำแหน่ง/หน่วยงาน)`,
          ],
        );
        result.issuesFound++;
      }
    } catch (error: any) {
      result.errors.push(`Incomplete data check: ${error.message}`);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return result;
}

/**
 * Auto-resolve issues that no longer exist
 */
export async function autoResolveFixedIssues(): Promise<number> {
  const connection = await getConnection();
  let resolved = 0;

  try {
    await connection.beginTransaction();

    // Resolve license expired issues where license is now valid
    const [result1] = await connection.execute(`
      UPDATE dq_issues i
      JOIN emp_profiles e ON i.citizen_id = e.citizen_id
      SET i.status = 'RESOLVED',
          i.resolved_at = NOW(),
          i.resolution_note = 'Auto-resolved: License renewed'
      WHERE i.issue_type = 'LICENSE_EXPIRED'
        AND i.status = 'OPEN'
        AND e.license_end_date >= CURDATE()
    `);
    resolved += (result1 as any).affectedRows;

    // Resolve ward mapping issues where ward is now set
    const [result2] = await connection.execute(`
      UPDATE dq_issues i
      JOIN emp_profiles e ON i.citizen_id = e.citizen_id
      SET i.status = 'RESOLVED',
          i.resolved_at = NOW(),
          i.resolution_note = 'Auto-resolved: Ward mapping added'
      WHERE i.issue_type = 'WARD_MAPPING_MISSING'
        AND i.status = 'OPEN'
        AND e.sub_department IS NOT NULL
        AND e.sub_department != ''
    `);
    resolved += (result2 as any).affectedRows;

    // Resolve incomplete data issues where data is now complete
    const [result3] = await connection.execute(`
      UPDATE dq_issues i
      JOIN emp_profiles e ON i.citizen_id = e.citizen_id
      SET i.status = 'RESOLVED',
          i.resolved_at = NOW(),
          i.resolution_note = 'Auto-resolved: Data completed'
      WHERE i.issue_type = 'EMPLOYEE_DATA_INCOMPLETE'
        AND i.status = 'OPEN'
        AND e.position_name IS NOT NULL
        AND e.position_name != ''
        AND e.department IS NOT NULL
        AND e.department != ''
    `);
    resolved += (result3 as any).affectedRows;

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await delCache(DASHBOARD_CACHE_KEY);

  return resolved;
}
