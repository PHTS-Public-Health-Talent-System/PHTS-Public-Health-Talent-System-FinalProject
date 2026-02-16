import { z } from "zod";
import { PersonnelType, RequestType } from '@/modules/request/request.types.js';

// Helper to parse JSON string
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
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

export const createRequestSchema = z.object({
  body: z.object({
    personnel_type: z.nativeEnum(PersonnelType, {
      message: "Invalid personnel_type",
    }),
    request_type: z.nativeEnum(RequestType, {
      message: "Invalid request_type",
    }),
    position_number: z.string().optional(),
    department_group: z.string().optional(),
    main_duty: z.string().optional(),
    requested_amount: z.preprocess(
      numberPreprocess,
      z.number().min(0).optional(),
    ),
    effective_date: z.string().optional(),
    work_attributes: z.preprocess(
      jsonPreprocess,
      z.object({
          operation: z.boolean(),
          planning: z.boolean(),
          coordination: z.boolean(),
          service: z.boolean(),
        }).optional(),
    ),
    submission_data: z.preprocess(jsonPreprocess, z.any().optional()),
  }),
});

export type CreateRequestSchema = z.infer<typeof createRequestSchema>["body"];

/**
 * DTO interface for creating a new request (used by services)
 */
export interface CreateRequestDTO {
  personnel_type: PersonnelType;
  position_number?: string;
  department_group?: string;
  main_duty?: string;
  work_attributes?: {
    operation: boolean;
    planning: boolean;
    coordination: boolean;
    service: boolean;
  };
  request_type: RequestType;
  requested_amount?: number;
  effective_date?: string;
  submission_data?: any;
}
