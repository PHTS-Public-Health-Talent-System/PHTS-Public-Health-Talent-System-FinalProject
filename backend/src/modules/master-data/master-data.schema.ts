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
    type: z.enum(["national", "special", "substitution"]).optional(),
  }),
});

export const updateHolidaySchema = z.object({
  params: z.object({
    date: dateStringSchema,
  }),
  body: z.object({
    date: dateStringSchema,
    name: z.string().min(1, "Holiday name is required"),
    type: z.enum(["national", "special", "substitution"]).optional(),
  }),
});

export const deleteHolidaySchema = z.object({
  params: z.object({
    date: dateStringSchema,
  }),
});

// --- RATES ---

const professionCodeSchema = z.enum([
  "DOCTOR",
  "DENTIST",
  "PHARMACIST",
  "NURSE",
  "MED_TECH",
  "RAD_TECH",
  "PHYSIO",
  "SPEECH_THERAPIST",
  "SPECIAL_EDU",
  "OCC_THERAPY",
  "CLIN_PSY",
  "CARDIO_TECH",
  "ALLIED",
]);

const nullableTrimmedString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();

export const createRateSchema = z.object({
  body: z.object({
    profession_code: professionCodeSchema,
    group_no: z.union([z.string(), z.number()]).transform((val) => Number(val)).refine((v) => Number.isFinite(v) && v >= 1, {
      message: "group_no must be a number >= 1",
    }),
    item_no: nullableTrimmedString,
    sub_item_no: nullableTrimmedString,
    amount: z.union([z.string(), z.number()]).transform((val) => Number(val)).refine((v) => Number.isFinite(v) && v >= 0, {
      message: "amount must be a number >= 0",
    }),
    condition_desc: z.string().optional().default(""),
    detailed_desc: z.string().optional().default(""),
    is_active: z.boolean().optional().default(true),
  }),
});

export const updateRateSchema = z.object({
  params: z.object({
    rateId: z.string().transform((val) => Number(val)),
  }),
  body: z.object({
    // Allow partial update for backward compatibility, but support full columns for cfg_payment_rates.
    profession_code: professionCodeSchema.optional(),
    group_no: z
      .union([z.string(), z.number()])
      .transform((val) => Number(val))
      .refine((v) => Number.isFinite(v) && v >= 1, { message: "group_no must be a number >= 1" })
      .optional(),
    item_no: nullableTrimmedString,
    sub_item_no: nullableTrimmedString,
    amount: z
      .union([z.string(), z.number()])
      .transform((val) => Number(val))
      .refine((v) => Number.isFinite(v) && v >= 0, { message: "amount must be a number >= 0" })
      .optional(),
    condition_desc: z.string().optional(),
    detailed_desc: z.string().optional(),
    is_active: z.boolean().optional(),
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
export type UpdateHolidayDTO = z.infer<typeof updateHolidaySchema>["body"];
export type UpdateRateBody = z.infer<typeof updateRateSchema>["body"];
export type CreateRateDTO = z.infer<typeof createRateSchema>["body"];
