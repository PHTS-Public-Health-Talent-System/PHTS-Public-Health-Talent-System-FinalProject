import { z } from "zod";
import { ALLOWED_LEAVE_TYPES } from "./leave-types.js";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const listLeaveManagementSchema = z.object({
  query: z.object({
    citizen_id: z.string().optional(),
    leave_type: z.enum(ALLOWED_LEAVE_TYPES).optional(),
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

export const createLeaveManagementSchema = z.object({
  body: z.object({
    citizen_id: z.string().min(1),
    leave_type: z.enum(ALLOWED_LEAVE_TYPES),
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    duration_days: z.number().optional(),
    remark: z.string().optional(),
  }).refine((data) => new Date(data.start_date) <= new Date(data.end_date), {
    message: "end_date must be after or equal to start_date",
    path: ["end_date"],
  }),
});

export const leaveManagementIdParamSchema = z.object({
  params: z.object({
    leaveManagementId: z.string().transform((val) => Number(val)),
  }),
});

export const leaveDocumentIdParamSchema = z.object({
  params: z.object({
    documentId: z.string().transform((val) => Number(val)),
  }),
});

const returnReportEventSchema = z.object({
  report_date: dateStringSchema,
  resume_date: dateStringSchema.optional(),
  resume_study_program: z.string().trim().min(1).max(255).optional(),
}).strict();

const upsertLeaveManagementExtensionBodySchema = z.object({
  leave_management_id: z.number().int().optional(),
  leave_record_id: z.number().int().optional(),
  document_start_date: dateStringSchema.optional(),
  document_end_date: dateStringSchema.optional(),
  document_duration_days: z.number().optional(),
  require_return_report: z.boolean().optional(),
  return_report_status: z.enum(["PENDING", "DONE", "NOT_REQUIRED"]).optional(),
  return_date: dateStringSchema.optional(),
  return_report_events: z.array(returnReportEventSchema).optional(),
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
    if (!data.leave_management_id && !data.leave_record_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "leave_management_id or leave_record_id is required",
        path: ["leave_management_id"],
      });
      return;
    }
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

    if (data.return_report_events && data.return_report_events.length > 0) {
      let previousReportDate: Date | null = null;
      data.return_report_events.forEach((event, index) => {
        const reportDate = new Date(event.report_date);
        const resumeDate = event.resume_date ? new Date(event.resume_date) : null;
        if (resumeDate && resumeDate <= reportDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "resume_date must be after report_date",
            path: ["return_report_events", index, "resume_date"],
          });
        }
        if (previousReportDate && reportDate < previousReportDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "return_report_events must be sorted by report_date ascending",
            path: ["return_report_events", index, "report_date"],
          });
        }
        previousReportDate = reportDate;
      });
    }
  });

export const upsertLeaveManagementExtensionSchema = z.object({
  body: upsertLeaveManagementExtensionBodySchema,
});

const replaceLeaveReturnEventsBodySchema = z.object({
  events: z.array(returnReportEventSchema),
}).strict().superRefine((data, ctx) => {
  let previousReportDate: Date | null = null;
  data.events.forEach((event, index) => {
    const reportDate = new Date(event.report_date);
    const resumeDate = event.resume_date ? new Date(event.resume_date) : null;
    if (resumeDate && resumeDate <= reportDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resume_date must be after report_date",
        path: ["events", index, "resume_date"],
      });
    }
    if (previousReportDate && reportDate < previousReportDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "events must be sorted by report_date ascending",
        path: ["events", index, "report_date"],
      });
    }
    previousReportDate = reportDate;
  });
});

export const replaceLeaveReturnEventsSchema = z.object({
  params: leaveManagementIdParamSchema.shape.params,
  body: replaceLeaveReturnEventsBodySchema,
});

export const listLeaveReturnEventsSchema = z.object({
  params: leaveManagementIdParamSchema.shape.params,
});

export type LeaveManagementListQuery = z.infer<typeof listLeaveManagementSchema>["query"];
export type LeavePersonnelListQuery = z.infer<typeof listLeavePersonnelSchema>["query"];
export type CreateLeaveManagementBody = z.infer<typeof createLeaveManagementSchema>["body"];
export type LeaveManagementExtensionBody = z.infer<typeof upsertLeaveManagementExtensionSchema>["body"];
export type ReplaceLeaveReturnEventsBody = z.infer<typeof replaceLeaveReturnEventsSchema>["body"];
