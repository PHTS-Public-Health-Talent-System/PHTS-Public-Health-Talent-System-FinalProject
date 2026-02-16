import { z } from "zod";
import { PaymentStatus } from '@/modules/finance/services/finance.service.js';

// GET /finance/summary?year=&month=
export const getSummarySchema = z.object({
  query: z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, "year ต้องเป็น 4 หลัก")
      .optional(),
    month: z
      .string()
      .regex(/^([1-9]|1[0-2])$/, "month ต้องเป็น 1-12")
      .optional(),
  }),
});

export type GetSummaryQuery = z.infer<typeof getSummarySchema>["query"];

// GET /finance/yearly?year=
export const getYearlySummarySchema = z.object({
  query: z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, "year ต้องเป็น 4 หลัก")
      .optional(),
  }),
});

export type GetYearlySummaryQuery = z.infer<
  typeof getYearlySummarySchema
>["query"];

// GET /finance/periods/:periodId/payouts?status=&search=
export const getPayoutsByPeriodSchema = z.object({
  params: z.object({
    periodId: z.string().regex(/^\d+$/, "periodId ต้องเป็นตัวเลข"),
  }),
  query: z.object({
    status: z.nativeEnum(PaymentStatus).optional(),
    search: z.string().optional(),
  }),
});

export type GetPayoutsByPeriodParams = z.infer<
  typeof getPayoutsByPeriodSchema
>["params"];
export type GetPayoutsByPeriodQuery = z.infer<
  typeof getPayoutsByPeriodSchema
>["query"];

// POST /finance/payouts/:payoutId/mark-paid
export const markAsPaidSchema = z.object({
  params: z.object({
    payoutId: z.string().regex(/^\d+$/, "payoutId ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    comment: z.string().optional(),
  }),
});

export type MarkAsPaidParams = z.infer<typeof markAsPaidSchema>["params"];
export type MarkAsPaidBody = z.infer<typeof markAsPaidSchema>["body"];

// POST /finance/payouts/batch-mark-paid
export const batchMarkAsPaidSchema = z.object({
  body: z.object({
    payoutIds: z
      .array(z.number().int().positive(), {
        error: "payoutIds ต้องเป็น array ของตัวเลข",
      })
      .min(1, "payoutIds ต้องมีอย่างน้อย 1 รายการ"),
  }),
});

export type BatchMarkAsPaidBody = z.infer<typeof batchMarkAsPaidSchema>["body"];

// POST /finance/payouts/:payoutId/cancel
export const cancelPayoutSchema = z.object({
  params: z.object({
    payoutId: z.string().regex(/^\d+$/, "payoutId ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    reason: z.string().min(1, "เหตุผลจำเป็นต้องระบุ"),
  }),
});

export type CancelPayoutParams = z.infer<typeof cancelPayoutSchema>["params"];
export type CancelPayoutBody = z.infer<typeof cancelPayoutSchema>["body"];
