import { z } from "zod";
import { AuditEventType } from "@/modules/audit/services/audit.service.js";

const dateString = z
  .string()
  .trim()
  .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid date" });

export const auditSummaryQuerySchema = z.object({
  query: z.object({
    startDate: dateString.optional(),
    endDate: dateString.optional(),
  }),
});

export const auditSearchQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    eventType: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      // Allow comma-separated values; validate each token against enum if possible.
      .refine(
        (value) => {
          if (!value) return true;
          const tokens = value.split(",").map((t) => t.trim()).filter(Boolean);
          if (tokens.length === 0) return false;
          const allowed = new Set(Object.values(AuditEventType));
          return tokens.every((t) => allowed.has(t as any));
        },
        { message: "Invalid eventType" },
      ),
    entityType: z.string().trim().min(1).max(100).optional(),
    entityId: z.coerce.number().int().positive().optional(),
    actorId: z.coerce.number().int().positive().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  }),
});

export const auditEntityParamsSchema = z.object({
  params: z.object({
    entityType: z.string().trim().min(1).max(100),
    entityId: z.coerce.number().int().positive(),
  }),
});

