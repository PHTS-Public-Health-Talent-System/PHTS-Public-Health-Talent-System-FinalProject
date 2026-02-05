import { Request, Response } from "express";
import { query } from '@config/database.js';
import * as systemService from '@/modules/system/services/system.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import type {
  SearchUsersQuery,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  ToggleMaintenanceModeBody,
} from '@/modules/system/system.schema.js';

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query as SearchUsersQuery;
    const search = `%${q}%`;
    const sql = `
      SELECT u.id, u.citizen_id, u.role, u.is_active, u.last_login_at,
             COALESCE(e.first_name, s.first_name) as first_name,
             COALESCE(e.last_name, s.last_name) as last_name
      FROM users u
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.citizen_id LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?
      LIMIT 20
    `;
    const rows = await query(sql, [search, search, search]);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as unknown as UpdateUserRoleParams;
    const { role, is_active } = req.body as UpdateUserRoleBody;
    const actorId = (req as any).user.userId;

    await query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);

    if (is_active !== undefined) {
      await query("UPDATE users SET is_active = ? WHERE id = ?", [
        is_active,
        userId,
      ]);
    }

    await emitAuditEvent(
      {
        eventType: AuditEventType.USER_ROLE_CHANGE,
        entityType: "USER",
        entityId: Number(userId),
        actorId,
        actionDetail: { role, isActive: is_active },
      },
      undefined,
    );

    res.json({ success: true, message: "User role updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const triggerSync = async (_req: Request, res: Response) => {
  try {
    const result = await systemService.SyncService.performFullSync();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleMaintenanceMode = async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body as ToggleMaintenanceModeBody;
    systemService.setMaintenanceMode(Boolean(enabled));
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
      data: { enabled: Boolean(enabled) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const triggerBackup = async (_req: Request, res: Response) => {
  try {
    const result = await systemService.runBackupJob();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
