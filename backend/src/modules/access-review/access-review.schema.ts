import { z } from "zod";
import { ReviewResult } from '@/modules/access-review/services/access-review.service.js';

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
