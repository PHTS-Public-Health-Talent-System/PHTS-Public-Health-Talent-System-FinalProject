import { z } from "zod";

const jsonPreprocess = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const createSupportTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(3).max(200),
    description: z.string().min(10).max(4000),
    page_url: z.string().max(500).optional().nullable(),
    user_agent: z.string().max(500).optional().nullable(),
    metadata: z.preprocess(
      jsonPreprocess,
      z.record(z.string(), z.unknown()).optional().nullable(),
    ),
  }),
});

export const supportTicketIdParamSchema = z.object({
  params: z.object({
    ticketId: z.string().regex(/^\d+$/, "ticketId ต้องเป็นตัวเลข"),
  }),
});

export const updateSupportStatusSchema = z.object({
  params: supportTicketIdParamSchema.shape.params,
  body: z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"]),
  }),
});

export const supportTicketMessageSchema = z.object({
  params: supportTicketIdParamSchema.shape.params,
  body: z.object({
    message: z.string().trim().min(1).max(2000),
  }),
});

export const listSupportTicketsSchema = z.object({
  query: z.object({
    status: z
      .enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateSupportTicketBody = z.infer<
  typeof createSupportTicketSchema
>["body"];
export type UpdateSupportStatusBody = z.infer<
  typeof updateSupportStatusSchema
>["body"];
export type SupportTicketMessageBody = z.infer<
  typeof supportTicketMessageSchema
>["body"];
export type SupportTicketIdParams = z.infer<
  typeof supportTicketIdParamSchema
>["params"];
export type ListSupportTicketsQuery = z.infer<
  typeof listSupportTicketsSchema
>["query"];
