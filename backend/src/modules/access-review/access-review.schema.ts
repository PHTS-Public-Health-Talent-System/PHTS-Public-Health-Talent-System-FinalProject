import { z } from "zod";
import { ReviewResult } from '@/modules/access-review/services/access-review.service.js';
import { AccessReviewQueueStatus } from '@/modules/access-review/entities/access-review.entity.js';
import { UserRole } from '@/types/auth.js';

// GET /access-review/cycles?year=
export const getCyclesSchema = z.object({
  query: z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, "year ต้องเป็น 4 หลัก")
      .optional(),
  }),
});

// GET /access-review/cycles/:id
export const getCycleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

// GET /access-review/cycles/:id/items?result=
export const getItemsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  query: z.object({
    result: z.nativeEnum(ReviewResult).optional(),
  }),
});

// PUT /access-review/items/:id
export const updateItemSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    result: z.nativeEnum(ReviewResult, {
      error: "result ต้องเป็นค่าที่ถูกต้อง",
    }),
    note: z.string().optional(),
  }),
});

export type UpdateItemParams = z.infer<typeof updateItemSchema>["params"];
export type UpdateItemBody = z.infer<typeof updateItemSchema>["body"];

// POST /access-review/cycles/:id/complete
export const completeCycleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    autoKeepPending: z.boolean().optional(),
    note: z.string().max(500).optional(),
  }).optional(),
});

export type CompleteCycleParams = z.infer<typeof completeCycleSchema>["params"];
export type CompleteCycleBody = z.infer<typeof completeCycleSchema>["body"];

// POST /access-review/cycles/:id/auto-review
export const autoReviewCycleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: z
    .object({
      disableInactive: z.boolean().optional(),
    })
    .optional(),
});

export type AutoReviewCycleParams = z.infer<typeof autoReviewCycleSchema>["params"];
export type AutoReviewCycleBody = z.infer<typeof autoReviewCycleSchema>["body"];

// GET /access-review/queue
export const getQueueSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    status: z.nativeEnum(AccessReviewQueueStatus).optional(),
    reason_code: z.string().min(1).max(64).optional(),
    current_role: z.nativeEnum(UserRole).optional(),
    is_active: z.enum(["0", "1"]).optional(),
    detected_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    detected_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    batch_id: z.string().regex(/^\d+$/).optional(),
    search: z.string().max(120).optional(),
  }),
});

// GET /access-review/queue/:id/events
export const getQueueEventsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// POST /access-review/queue/:id/resolve
export const resolveQueueItemSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    action: z.enum(["RESOLVE", "DISMISS"]),
    note: z.string().max(500).optional(),
  }),
});

export type GetQueueQuery = z.infer<typeof getQueueSchema>["query"];
export type GetQueueEventsParams = z.infer<typeof getQueueEventsSchema>["params"];
export type GetQueueEventsQuery = z.infer<typeof getQueueEventsSchema>["query"];
export type ResolveQueueItemParams = z.infer<typeof resolveQueueItemSchema>["params"];
export type ResolveQueueItemBody = z.infer<typeof resolveQueueItemSchema>["body"];
