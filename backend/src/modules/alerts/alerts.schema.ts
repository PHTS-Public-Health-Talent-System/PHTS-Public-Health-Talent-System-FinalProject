import { z } from "zod";

export const retirementSchema = z.object({
  body: z.object({
    citizen_id: z.string().min(1),
    retire_date: z.string().min(1),
    note: z.string().optional(),
  }),
});

export type RetirementInput = z.infer<typeof retirementSchema>["body"];
