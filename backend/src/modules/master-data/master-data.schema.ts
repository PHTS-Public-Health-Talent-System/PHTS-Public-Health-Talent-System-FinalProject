import { z } from "zod";

// Helper for 'YYYY-MM-DD' validation
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

// --- HOLIDAYS ---

export const getHolidaysSchema = z.object({
  query: z.object({
    year: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val ? Number(val) : undefined)),
  }),
});

export const createHolidaySchema = z.object({
  body: z.object({
    date: dateStringSchema,
    name: z.string().min(1, "Holiday name is required"),
  }),
});

export const deleteHolidaySchema = z.object({
  params: z.object({
    date: dateStringSchema,
  }),
});

// --- RATES ---

export const updateRateSchema = z.object({
  params: z.object({
    rateId: z.string().transform((val) => Number(val)),
  }),
  body: z.object({
    amount: z.number().min(0, "Amount must be non-negative"),
    condition_desc: z.string().min(1, "Condition description is required"),
    is_active: z.boolean(),
  }),
});

export const deleteRateSchema = z.object({
  params: z.object({
    rateId: z.string().transform((val) => Number(val)),
  }),
});

// Export inferred types for Controller use
export type GetHolidaysQuery = z.infer<typeof getHolidaysSchema>["query"];
export type CreateHolidayDTO = z.infer<typeof createHolidaySchema>["body"];
export type UpdateRateBody = z.infer<typeof updateRateSchema>["body"];
