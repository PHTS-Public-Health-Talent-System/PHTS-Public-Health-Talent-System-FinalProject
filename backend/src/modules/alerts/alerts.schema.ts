import { z } from "zod";

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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

export type RetirementInput = z.infer<typeof retirementCreateSchema>["body"];
