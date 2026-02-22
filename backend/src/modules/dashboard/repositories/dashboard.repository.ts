import db from "@config/database.js";
import type { RowDataPacket } from "mysql2";

export class DashboardRepository {
  static async countApprovedRequestsByMonth(params: {
    month: number;
    year: number;
  }): Promise<number> {
    const { month, year } = params;
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) as count
        FROM req_submissions
        WHERE status = 'APPROVED'
          AND MONTH(COALESCE(updated_at, created_at)) = ?
          AND YEAR(COALESCE(updated_at, created_at)) = ?
      `,
      [month, year],
    );
    return Number((rows as { count?: number }[])[0]?.count ?? 0);
  }
}
