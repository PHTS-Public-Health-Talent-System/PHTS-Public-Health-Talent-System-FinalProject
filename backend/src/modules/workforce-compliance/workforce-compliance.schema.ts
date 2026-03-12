import { z } from "zod";

const isValidDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const retirementBodySchema = z.object({
  citizen_id: z.string().min(1),
  retire_date: z
    .string()
    .min(1)
    .refine(isValidDate, { message: "Invalid retire_date format" }),
  note: z.string().optional(),
});

export const retirementCreateSchema = z.object({
  body: retirementBodySchema,
});

export const retirementUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: retirementBodySchema,
});

export const retirementIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

export const licenseNotifySchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          citizen_id: z.string().min(1),
          bucket: z.enum(["expired", "30", "60", "90"]),
        }),
      )
      .min(1),
  }),
});

const movementBodySchema = z.object({
  citizen_id: z.string().min(1),
  movement_type: z.enum(["RESIGN", "TRANSFER_OUT"]),
  effective_date: z
    .string()
    .min(1)
    .refine(isValidDate, { message: "Invalid effective_date format" }),
  remark: z.string().optional(),
});

export const movementCreateSchema = z.object({
  body: movementBodySchema,
});

export const movementUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
  body: movementBodySchema,
});

export const movementIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

export type RetirementInput = z.infer<typeof retirementCreateSchema>["body"];
