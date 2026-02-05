import { z } from "zod";
import { ActionType } from '@/modules/request/request.types.js';

export const actionSchema = z.object({
  body: z.object({
    action: z.enum([ActionType.APPROVE, ActionType.REJECT, ActionType.RETURN]),
    comment: z.string().max(1000).optional(),
    signature_base64: z.string().optional(),
  }),
});

const verificationCheckSchema = z.object({
  status: z.enum(["PASS", "FAIL"]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  reason: z.string().max(1000).optional(),
});

export const verificationSchema = z.object({
  body: z.object({
    qualification_check: verificationCheckSchema.optional(),
    evidence_check: verificationCheckSchema.optional(),
  }),
});

export type ActionSchema = z.infer<typeof actionSchema>["body"];
export type VerificationSchema = z.infer<typeof verificationSchema>["body"];
