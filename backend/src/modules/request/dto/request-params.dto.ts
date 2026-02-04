import { z } from "zod";

const idParam = z.object({
  id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
});

export const requestIdParamSchema = z.object({
  params: idParam,
});

export const requestRateMappingSchema = z.object({
  params: idParam,
  body: z.object({
    group_no: z.coerce.number().int().positive(),
    item_no: z.string().optional().nullable(),
    sub_item_no: z.string().optional().nullable(),
  }),
});

export const requestReassignSchema = z.object({
  params: idParam,
  body: z.object({
    target_officer_id: z.coerce.number().int().positive(),
    remark: z.string().min(1).max(1000),
  }),
});

export const requestAdjustLeaveSchema = z.object({
  params: idParam,
  body: z
    .object({
      manual_start_date: z.string().min(1),
      manual_end_date: z.string().min(1),
      manual_duration_days: z.coerce.number().int().min(0),
      remark: z.string().max(1000).optional(),
    })
    .refine(
      (data) =>
        new Date(data.manual_start_date) <= new Date(data.manual_end_date),
      {
        message: "manual_start_date must be before or equal to manual_end_date",
        path: ["manual_end_date"],
      },
    ),
});

export const requestApproveBatchSchema = z.object({
  body: z.object({
    requestIds: z.array(z.coerce.number().int()).min(1),
    comment: z.string().max(1000).optional(),
  }),
});
