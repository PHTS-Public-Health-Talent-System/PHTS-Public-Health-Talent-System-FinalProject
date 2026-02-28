import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

type SummaryRow = RowDataPacket & {
  total_users: number;
  protected_users: number;
  would_update: number;
  missing_source: number;
};

type CoverageRow = RowDataPacket & {
  has_profile: number;
  has_support: number;
  has_both: number;
};

type QualityRow = RowDataPacket & {
  profile_total: number;
  profile_empty_special_position: number;
  profile_has_head_group: number;
  profile_has_head_ward: number;
  profile_has_assistant: number;
  profile_mixed_head_assistant: number;
};

type DiffRow = RowDataPacket & {
  current_role: string;
  expected_role: string;
  cnt: number;
};

const EXPECTED_ROLE_CASE_SQL = `
  CASE
    WHEN COALESCE(p.special_position, '') LIKE '%หัวหน้ากลุ่ม%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้า%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้า%'
    THEN 'HEAD_DEPT'
    WHEN COALESCE(p.special_position, '') LIKE '%หัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้า%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้า%'
    THEN 'HEAD_WARD'
    ELSE 'USER'
  END
`;

const NON_AUTOMANAGED_DEMOTION_GUARD_SQL = `
  expected_role = 'USER'
  AND current_role <> 'USER'
  AND current_role NOT IN ('HEAD_WARD', 'HEAD_DEPT')
`;

export async function getRoleMappingDiagnostics(conn: PoolConnection) {
  const [summaryRows] = await conn.query<SummaryRow[]>(
    `
      WITH role_derived AS (
        SELECT
          u.role AS current_role,
          p.citizen_id AS profile_citizen_id,
          s.citizen_id AS support_citizen_id,
          (${EXPECTED_ROLE_CASE_SQL}) COLLATE utf8mb4_unicode_ci AS expected_role
        FROM users u
        LEFT JOIN emp_profiles p ON CAST(p.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
        LEFT JOIN emp_support_staff s
          ON p.citizen_id IS NULL
         AND CAST(s.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
      )
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN current_role IN ('ADMIN','PTS_OFFICER') THEN 1 ELSE 0 END) AS protected_users,
        SUM(
          CASE
            WHEN current_role IN ('ADMIN','PTS_OFFICER') THEN 0
            WHEN ${NON_AUTOMANAGED_DEMOTION_GUARD_SQL} THEN 0
            WHEN BINARY current_role <> BINARY expected_role THEN 1
            ELSE 0
          END
        ) AS would_update,
        SUM(CASE WHEN profile_citizen_id IS NULL AND support_citizen_id IS NULL THEN 1 ELSE 0 END) AS missing_source
      FROM role_derived
    `,
  );

  const [coverageRows] = await conn.query<CoverageRow[]>(
    `
      SELECT
        SUM(CASE WHEN p.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_profile,
        SUM(CASE WHEN s.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_support,
        SUM(CASE WHEN p.citizen_id IS NOT NULL AND s.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_both
      FROM users u
      LEFT JOIN emp_profiles p ON CAST(p.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
      LEFT JOIN emp_support_staff s ON CAST(s.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
    `,
  );

  const [qualityRows] = await conn.query<QualityRow[]>(
    `
      SELECT
        COUNT(*) AS profile_total,
        SUM(CASE WHEN special_position IS NULL OR TRIM(special_position) = '' THEN 1 ELSE 0 END) AS profile_empty_special_position,
        SUM(CASE WHEN special_position LIKE '%หัวหน้ากลุ่มงาน%' OR special_position LIKE '%หัวหน้ากลุ่มภารกิจ%' THEN 1 ELSE 0 END) AS profile_has_head_group,
        SUM(CASE WHEN special_position LIKE '%หัวหน้าตึก%' THEN 1 ELSE 0 END) AS profile_has_head_ward,
        SUM(CASE WHEN special_position LIKE '%รองหัวหน้า%' OR special_position LIKE '%ผู้ช่วยหัวหน้า%' THEN 1 ELSE 0 END) AS profile_has_assistant,
        SUM(
          CASE WHEN (special_position LIKE '%หัวหน้ากลุ่ม%' OR special_position LIKE '%หัวหน้าตึก%')
              AND (special_position LIKE '%รองหัวหน้า%' OR special_position LIKE '%ผู้ช่วยหัวหน้า%')
          THEN 1 ELSE 0 END
        ) AS profile_mixed_head_assistant
      FROM emp_profiles
    `,
  );

  const [diffRows] = await conn.query<DiffRow[]>(
    `
      SELECT d.current_role, d.expected_role, COUNT(*) AS cnt
      FROM (
        SELECT
          u.role AS current_role,
          (${EXPECTED_ROLE_CASE_SQL}) COLLATE utf8mb4_unicode_ci AS expected_role
        FROM users u
        LEFT JOIN emp_profiles p ON CAST(p.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
        LEFT JOIN emp_support_staff s
          ON p.citizen_id IS NULL
         AND CAST(s.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
        WHERE u.role NOT IN ('ADMIN','PTS_OFFICER')
      ) d
      WHERE BINARY d.current_role <> BINARY d.expected_role
        AND NOT (${NON_AUTOMANAGED_DEMOTION_GUARD_SQL})
      GROUP BY d.current_role, d.expected_role
      ORDER BY cnt DESC
      LIMIT 20
    `,
  );

  return {
    summary: summaryRows[0] ?? {},
    coverage: coverageRows[0] ?? {},
    quality: qualityRows[0] ?? {},
    differences: diffRows,
  };
}
