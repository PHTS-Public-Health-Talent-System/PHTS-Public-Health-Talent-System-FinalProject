import { z } from "zod";
import { PersonnelType, RequestType, WorkAttributes } from '@/modules/request/request.types.js';

/**
 * DTO for updating an existing request
 * Only allowed when status is DRAFT or RETURNED
 */
export interface UpdateRequestDTO {
  personnel_type?: PersonnelType;
  position_number?: string;
  department_group?: string;
  main_duty?: string;
  work_attributes?: WorkAttributes;
  request_type?: RequestType;
  requested_amount?: number;
  effective_date?: string;
  submission_data?: any;
  reason?: string;
}

const jsonPreprocess = (val: unknown) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

const numberPreprocess = (val: unknown) => {
  if (typeof val === "string" && val !== "") {
    const parsed = Number(val);
    return Number.isNaN(parsed) ? val : parsed;
  }
  return val;
};

// Used for update request endpoint (multipart/form-data supported via preprocess).
export const updateRequestSchema = z.object({
  body: z
    .object({
      personnel_type: z.nativeEnum(PersonnelType).optional(),
      request_type: z.nativeEnum(RequestType).optional(),
      position_number: z.string().optional(),
      department_group: z.string().optional(),
      main_duty: z.string().optional(),
      requested_amount: z.preprocess(numberPreprocess, z.number().min(0).optional()),
      effective_date: z.string().optional(),
      work_attributes: z.preprocess(
        jsonPreprocess,
        z
          .object({
            operation: z.boolean(),
            planning: z.boolean(),
            coordination: z.boolean(),
            service: z.boolean(),
          })
          .optional(),
      ),
      submission_data: z.preprocess(jsonPreprocess, z.any().optional()),
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .partial(),
});

export type UpdateRequestSchema = z.infer<typeof updateRequestSchema>["body"];
