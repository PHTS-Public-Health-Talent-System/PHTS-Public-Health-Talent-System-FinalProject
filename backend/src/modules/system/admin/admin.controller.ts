/**
 * system module - request orchestration
 *
 */
import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { AdminRepository } from "@/modules/system/repositories/admin.repository.js";
import {
  isMaintenanceModeEnabled,
  disableMaintenanceMode,
  enableMaintenanceMode,
} from "@/modules/system/services/maintenance.service.js";
import { getJobStatus as getSystemJobStatus } from "@/modules/system/services/jobs.service.js";
import {
  emitAuditEvent,
  AuditEventType,
} from "@/modules/audit/services/audit.service.js";
import type {
  SearchUsersQuery,
  GetUserByIdParams,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  ToggleMaintenanceModeBody,
} from "@/modules/system/admin/admin.schema.js";

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit, role, is_active } = req.query as SearchUsersQuery;
  const result = await AdminRepository.searchUsers({
    q: q || "",
    page: Number(page || 1),
    limit: Number(limit || 20),
    role,
    isActive: is_active === undefined ? undefined : Number(is_active),
  });
  res.json({ success: true, data: result });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as unknown as GetUserByIdParams;
  const row = await AdminRepository.findUserById(Number(userId));
  if (!row) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({ success: true, data: row });
});

export const updateUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as unknown as UpdateUserRoleParams;
    const { role, is_active } = req.body as UpdateUserRoleBody;
    const actorId = req.user?.userId ?? null;

    await AdminRepository.updateUserRole(Number(userId), role, is_active);

    await emitAuditEvent({
      eventType: AuditEventType.USER_ROLE_CHANGE,
      entityType: "USER",
      entityId: Number(userId),
      actorId,
      actionDetail: { role, isActive: is_active },
    });

    res.json({ success: true, message: "User role updated successfully" });
  },
);

export const toggleMaintenanceMode = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = req.body as ToggleMaintenanceModeBody;
    if (Boolean(enabled)) {
      await enableMaintenanceMode();
    } else {
      await disableMaintenanceMode();
    }
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
      data: { enabled: Boolean(enabled) },
    });
  },
);

export const getMaintenanceMode = asyncHandler(
  async (_req: Request, res: Response) => {
    const enabled = await isMaintenanceModeEnabled();
    res.json({
      success: true,
      data: { enabled },
    });
  },
);

export const getJobStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getSystemJobStatus();
    res.json({ success: true, data });
  },
);

export const getVersionInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    const version = process.env.APP_VERSION ?? "unknown";
    const commit = process.env.APP_COMMIT ?? "unknown";
    const env = process.env.NODE_ENV ?? "development";
    res.json({
      success: true,
      data: {
        version,
        commit,
        env,
      },
    });
  },
);
