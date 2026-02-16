import { Request, Response } from "express";
import { asyncHandler } from '@middlewares/errorHandler.js';
import { SystemRepository } from '@/modules/system/repositories/system.repository.js';
import * as systemService from '@/modules/system/services/system.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import type {
  SearchUsersQuery,
  GetUserByIdParams,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  ToggleMaintenanceModeBody,
  SyncUserParams,
  BackupHistoryQuery,
} from '@/modules/system/system.schema.js';

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit, role, is_active } = req.query as SearchUsersQuery;
  const result = await SystemRepository.searchUsers({
    q: q || '',
    page: Number(page || 1),
    limit: Number(limit || 20),
    role,
    isActive: is_active === undefined ? undefined : Number(is_active),
  });
  res.json({ success: true, data: result });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as unknown as GetUserByIdParams;
  const row = await SystemRepository.findUserById(Number(userId));
  if (!row) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: row });
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as unknown as UpdateUserRoleParams;
  const { role, is_active } = req.body as UpdateUserRoleBody;
  const actorId = (req as any).user.userId;

  await SystemRepository.updateUserRole(Number(userId), role, is_active);

  await emitAuditEvent(
    {
      eventType: AuditEventType.USER_ROLE_CHANGE,
      entityType: 'USER',
      entityId: Number(userId),
      actorId,
      actionDetail: { role, isActive: is_active },
    },
    undefined,
  );

  res.json({ success: true, message: 'User role updated successfully' });
});

export const triggerSync = asyncHandler(async (_req: Request, res: Response) => {
  const result = await systemService.SyncService.performFullSync();
  res.json({ success: true, data: result });
});

export const triggerUserSync = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as unknown as SyncUserParams;
  const result = await systemService.SyncService.performUserSync(Number(userId));
  res.json({ success: true, data: result });
});

export const toggleMaintenanceMode = asyncHandler(async (req: Request, res: Response) => {
  const { enabled } = req.body as ToggleMaintenanceModeBody;
  await systemService.setMaintenanceMode(Boolean(enabled));
  res.json({
    success: true,
    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
    data: { enabled: Boolean(enabled) },
  });
});

export const getMaintenanceMode = asyncHandler(async (_req: Request, res: Response) => {
  const enabled = await systemService.isMaintenanceModeEnabled();
  res.json({
    success: true,
    data: { enabled },
  });
});

export const triggerBackup = asyncHandler(async (_req: Request, res: Response) => {
  const actorId = (_req as any).user?.userId ?? (_req as any).user?.id ?? null;
  const result = await systemService.runBackupJob({
    triggerSource: 'MANUAL',
    triggeredBy: actorId,
  });
  res.json({ success: true, data: result });
});

export const getBackupHistory = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = req.query as unknown as BackupHistoryQuery;
  const rows = await SystemRepository.getBackupHistory(Number(limit || 20));
  res.json({ success: true, data: rows });
});

export const getJobStatus = asyncHandler(async (_req: Request, res: Response) => {
  const data = await systemService.getJobStatus();
  res.json({ success: true, data });
});

export const getVersionInfo = asyncHandler(async (_req: Request, res: Response) => {
  const version = process.env.APP_VERSION ?? 'unknown';
  const commit = process.env.APP_COMMIT ?? 'unknown';
  const env = process.env.NODE_ENV ?? 'development';
  res.json({
    success: true,
    data: {
      version,
      commit,
      env,
    },
  });
});
