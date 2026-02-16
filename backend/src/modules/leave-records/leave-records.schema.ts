import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const listLeaveRecordsSchema = z.object({
  query: z.object({
    citizen_id: z.string().optional(),
    leave_type: z.string().optional(),
    profession_code: z.string().optional(),
    fiscal_year: z.coerce.number().int().optional(),
    pending_report: z
      .preprocess((value) => {
        if (typeof value === "string") {
          if (value.toLowerCase() === "true") return true;
          if (value.toLowerCase() === "false") return false;
        }
        return value;
      }, z.boolean())
      .optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    sort_by: z.enum(["start_date", "name"]).optional(),
    sort_dir: z.enum(["asc", "desc"]).optional(),
  }),
});

export const listLeavePersonnelSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    limit: z.coerce.number().int().positive().max(5000).optional(),
  }),
});

export const createLeaveRecordSchema = z.object({
  body: z.object({
    citizen_id: z.string().min(1),
    leave_type: z.string().min(1),
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    duration_days: z.number().optional(),
    remark: z.string().optional(),
  }).refine((data) => new Date(data.start_date) <= new Date(data.end_date), {
    message: "end_date must be after or equal to start_date",
    path: ["end_date"],
  }),
});

export const leaveRecordIdParamSchema = z.object({
  params: z.object({
    leaveRecordId: z.string().transform((val) => Number(val)),
  }),
});

export const leaveDocumentIdParamSchema = z.object({
  params: z.object({
    documentId: z.string().transform((val) => Number(val)),
  }),
});

export const upsertLeaveRecordExtensionSchema = z.object({
  body: z.object({
    leave_record_id: z.number().int(),
    document_start_date: dateStringSchema.optional(),
    document_end_date: dateStringSchema.optional(),
    document_duration_days: z.number().optional(),
    require_return_report: z.boolean().optional(),
    return_report_status: z.enum(["PENDING", "DONE", "NOT_REQUIRED"]).optional(),
    return_date: dateStringSchema.optional(),
    return_remark: z.string().optional(),
    pay_exception: z.boolean().optional(),
    is_no_pay: z.boolean().optional(),
    pay_exception_reason: z.string().optional(),
    study_institution: z.string().optional(),
    study_program: z.string().optional(),
    study_major: z.string().optional(),
    study_start_date: dateStringSchema.optional(),
    study_note: z.string().optional(),
    note: z.string().optional(),
  }).strict().superRefine((data, ctx) => {
    const hasDocStart = Boolean(data.document_start_date)
    const hasDocEnd = Boolean(data.document_end_date)
    if (hasDocStart !== hasDocEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "document_start_date and document_end_date must be provided together",
        path: [hasDocStart ? "document_end_date" : "document_start_date"],
      })
      return
    }
    if (hasDocStart && hasDocEnd) {
      const start = new Date(data.document_start_date as string)
      const end = new Date(data.document_end_date as string)
      if (start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "document_end_date must be after or equal to document_start_date",
          path: ["document_end_date"],
        })
      }
    }
  }),
});

export type LeaveRecordListQuery = z.infer<typeof listLeaveRecordsSchema>["query"];
export type LeavePersonnelListQuery = z.infer<typeof listLeavePersonnelSchema>["query"];
export type CreateLeaveRecordBody = z.infer<typeof createLeaveRecordSchema>["body"];
export type LeaveRecordExtensionBody = z.infer<typeof upsertLeaveRecordExtensionSchema>["body"];
