import { z } from "zod";
import { SnapshotType } from '@/modules/snapshot/services/snapshot.service.js';

// GET /snapshots/periods/:id
export const getPeriodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

export type GetPeriodParams = z.infer<typeof getPeriodSchema>["params"];

// GET /snapshots/periods/:id/snapshot/:type
export const getSnapshotSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
    type: z
      .string()
      .refine(
        (t) =>
          Object.values(SnapshotType).includes(t.toUpperCase() as SnapshotType),
        { message: "type ไม่ถูกต้อง" },
      ),
  }),
});

// POST /snapshots/periods/:id/freeze
export const freezePeriodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

export type FreezePeriodParams = z.infer<typeof freezePeriodSchema>["params"];

// POST /snapshots/periods/:id/unfreeze
export const unfreezePeriodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    reason: z.string().min(1, "เหตุผลจำเป็นต้องระบุ"),
  }),
});

export type UnfreezePeriodParams = z.infer<
  typeof unfreezePeriodSchema
>["params"];
export type UnfreezePeriodBody = z.infer<typeof unfreezePeriodSchema>["body"];
