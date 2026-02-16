import { z } from "zod";

const idParam = z.object({
  id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
});

const eligibilityIdParam = z.object({
  eligibilityId: z.string().regex(/^\d+$/, "eligibilityId ต้องเป็นตัวเลข"),
});

const idOrNoParam = z.object({
  id: z
    .string()
    .regex(
      /^(\d+|PTS-\d+|REQ-\d{4}-\d+)$/i,
      "id ต้องเป็นตัวเลขหรือรูปแบบ REQ-YYYY-xxxxx",
    ),
});

export const requestIdParamSchema = z.object({
  params: idParam,
});

export const requestIdOrNoParamSchema = z.object({
  params: idOrNoParam,
});

export const requestEligibilityIdParamSchema = z.object({
  params: eligibilityIdParam,
});

export const requestEligibilityQuerySchema = z.object({
  query: z.object({
    active_only: z.enum(["0", "1"]).optional(),
    // Optional paging + filters (used by allowance-list screens)
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    profession_code: z.string().trim().min(1).optional(), // "ALL" or code
    search: z.string().trim().max(200).optional(),
    rate_group: z.string().trim().min(1).optional(), // "all" or group_no
    department: z.string().trim().max(255).optional(),
    sub_department: z.string().trim().max(255).optional(),
    license_status: z.enum(["all", "active", "expiring", "expired"]).optional(),
  }),
});

export const requestHistoryQuerySchema = z.object({
  query: z.object({
    view: z.enum(["mine", "team"]).optional(),
    actions: z.enum(["important", "all"]).optional(),
  }),
});

export const requestRateMappingSchema = z.object({
  params: idParam,
  body: z.object({
    group_no: z.coerce.number().int().positive(),
    item_no: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().min(1).optional().nullable(),
    ),
    sub_item_no: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().min(1).optional().nullable(),
    ),
  }),
});

export const requestReassignSchema = z.object({
  params: idParam,
  body: z.object({
    target_officer_id: z.coerce.number().int().positive(),
    remark: z.string().min(1).max(1000),
  }),
});

export const requestAdjustLeaveSchema = z.object({
  params: idParam,
  body: z
    .object({
      manual_start_date: z.string().min(1),
      manual_end_date: z.string().min(1),
      manual_duration_days: z.coerce.number().int().min(0),
      remark: z.string().max(1000).optional(),
    })
    .refine(
      (data) =>
        new Date(data.manual_start_date) <= new Date(data.manual_end_date),
      {
        message: "manual_start_date must be before or equal to manual_end_date",
        path: ["manual_end_date"],
      },
    ),
});

export const requestApproveBatchSchema = z.object({
  body: z.object({
    requestIds: z.array(z.coerce.number().int()).min(1),
    comment: z.string().max(1000).optional(),
  }),
});
