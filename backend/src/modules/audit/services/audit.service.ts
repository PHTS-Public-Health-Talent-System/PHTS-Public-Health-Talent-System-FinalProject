/**
 * PHTS System - Audit Trail Service
 *
 * Handles audit event logging, search, and export.
 * FR-09-01: Log audit trail for approvals and important data changes
 * FR-09-02: Search and export audit reports
 */

import { PoolConnection } from "mysql2/promise";
import { AuditRepository } from '@/modules/audit/repositories/audit.repository.js';
import {
  AuditEvent,
  CreateAuditEventInput,
  AuditSearchFilter,
  AuditSearchResult,
  AuditSummaryItem,
} from '@/modules/audit/entities/audit.entity.js';

// Re-export types for backward compatibility
export { AuditEventType } from '@/modules/audit/entities/audit.entity.js';
export type { CreateAuditEventInput as CreateAuditEventDTO } from '@/modules/audit/entities/audit.entity.js';
export type { AuditEvent, AuditSearchFilter } from '@/modules/audit/entities/audit.entity.js';

/**
 * Log an audit event
 */
export async function logAuditEvent(
  dto: CreateAuditEventInput,
  connection?: PoolConnection,
): Promise<number> {
  return AuditRepository.create(dto, connection);
}

/**
 * Standardized audit logger (normalizes optional fields)
 */
export async function emitAuditEvent(
  dto: CreateAuditEventInput,
  connection?: PoolConnection,
): Promise<number> {
  return logAuditEvent(
    {
      ...dto,
      entityId: dto.entityId ?? null,
      actorId: dto.actorId ?? null,
      actorRole: dto.actorRole ?? null,
      actionDetail: dto.actionDetail ?? null,
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
    },
    connection,
  );
}

/**
 * Search audit events with filters
 */
export async function searchAuditEvents(
  filter: AuditSearchFilter,
): Promise<AuditSearchResult> {
  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 50, 500);

  const { events, total } = await AuditRepository.search(filter);

  return { events, total, page, limit };
}

/**
 * Get audit events for a specific entity
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: number,
): Promise<AuditEvent[]> {
  return AuditRepository.findByEntity(entityType, entityId);
}

/**
 * Get audit events for export (returns all matching records)
 */
export async function getAuditEventsForExport(
  filter: Omit<AuditSearchFilter, "page" | "limit">,
): Promise<AuditEvent[]> {
  const { events } = await AuditRepository.search({
    ...filter,
    page: 1,
    limit: 10000,
  });

  return events;
}

/**
 * Get audit summary by event type for a date range
 */
export async function getAuditSummary(
  startDate?: Date | string,
  endDate?: Date | string,
): Promise<AuditSummaryItem[]> {
  return AuditRepository.getSummary(startDate, endDate);
}

/**
 * Helper to create audit event from Express request
 */
export function extractRequestInfo(req: any): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    "unknown";

  const userAgent = req.headers["user-agent"] || "unknown";

  return { ipAddress, userAgent };
}

/**
 * Convenience function to log with request context
 */
export async function logAuditEventWithRequest(
  req: any,
  dto: Omit<
    CreateAuditEventInput,
    "ipAddress" | "userAgent" | "actorId" | "actorRole"
  >,
  connection?: PoolConnection,
): Promise<number> {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  const user = req.user;

  return logAuditEvent(
    {
      ...dto,
      actorId: user?.id ?? user?.userId ?? null,
      actorRole: user?.role || null,
      ipAddress,
      userAgent,
    },
    connection,
  );
}

/**
 * Standardized audit logger with request context
 */
export async function emitAuditEventWithRequest(
  req: any,
  dto: Omit<
    CreateAuditEventInput,
    "ipAddress" | "userAgent" | "actorId" | "actorRole"
  >,
  connection?: PoolConnection,
): Promise<number> {
  return logAuditEventWithRequest(req, dto, connection);
}
