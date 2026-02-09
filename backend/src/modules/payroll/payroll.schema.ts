import { z } from "zod";

export const createPeriodSchema = z.object({
  body: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  }),
});

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>["body"];

export const calculateOnDemandSchema = z.object({
  body: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    citizen_id: z.string().optional(),
  }),
});

export const addPeriodItemsSchema = z.object({
  body: z.object({
    request_ids: z.array(z.number().int()).min(1),
  }),
});

export const rejectPeriodSchema = z.object({
  body: z.object({
    reason: z.string().min(1),
  }),
});

const periodIdParam = z.object({
  periodId: z.string().regex(/^\d+$/, "periodId ต้องเป็นตัวเลข"),
});

const itemIdParam = z.object({
  itemId: z.string().regex(/^\d+$/, "itemId ต้องเป็นตัวเลข"),
});

export const periodIdParamSchema = z.object({
  params: periodIdParam,
});

export const periodItemParamSchema = z.object({
  params: periodIdParam.merge(itemIdParam),
});

export type CalculateOnDemandInput = z.infer<
  typeof calculateOnDemandSchema
>["body"];

export const CalculatePayrollSchema = z.object({
  body: z.object({
    year: z
      .number()
      .int("year must be an integer")
      .min(1900, "year must be valid")
      .max(3000, "year must be valid"),
    month: z
      .number()
      .int("month must be an integer")
      .min(1, "month must be between 1-12")
      .max(12, "month must be between 1-12"),
    citizen_id: z.string().optional().nullable(),
  }),
});

export type CalculatePayrollInput = z.infer<
  typeof CalculatePayrollSchema
>["body"];
