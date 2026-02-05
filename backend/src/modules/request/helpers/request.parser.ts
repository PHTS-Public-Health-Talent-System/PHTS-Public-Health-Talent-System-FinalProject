import { Request } from "express";
import {
  PersonnelType,
  RequestType,
  WorkAttributes,
} from '@/modules/request/request.types.js';
import { CreateRequestDTO } from '@/modules/request/dto/index.js';

/**
 * Parsed request payload with file categorization
 */
export interface ParsedRequestPayload {
  dto: CreateRequestDTO;
  documents: Express.Multer.File[];
}

/**
 * Parse JSON field safely
 */
const parseJson = <T>(value: unknown, fieldName: string): T | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (_error) {
      throw new Error(`Invalid ${fieldName} format. Must be valid JSON.`);
    }
  }
  return value as T;
};

/**
 * Validate required fields for CreateRequestDTO
 */
const validateCreateRequest = (
  body: Record<string, unknown>,
): string | null => {
  const personnelType = body.personnel_type;
  const requestType = body.request_type;

  if (!personnelType || !requestType) {
    return "Missing required fields: personnel_type and request_type";
  }

  if (!Object.values(PersonnelType).includes(personnelType as PersonnelType)) {
    return `Invalid personnel_type. Must be one of: ${Object.values(PersonnelType).join(", ")}`;
  }

  if (!Object.values(RequestType).includes(requestType as RequestType)) {
    return `Invalid request_type. Must be one of: ${Object.values(RequestType).join(", ")}`;
  }

  return null;
};

/**
 * Helper to parse multipart/form-data request for creation
 * Extracts DTO, separates files, and validates JSON fields
 */
export const parseCreateRequestPayload = (
  req: Request,
): ParsedRequestPayload => {
  const body = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  // 1. Basic Validation
  const validationError = validateCreateRequest(body);
  if (validationError) {
    throw new Error(validationError);
  }

  // 2. Parse JSON fields
  let workAttributes: WorkAttributes | undefined;
  let submissionData: any | undefined;

  try {
    workAttributes = parseJson<WorkAttributes>(
      body.work_attributes,
      "work_attributes",
    );
    submissionData = parseJson<any>(body.submission_data, "submission_data");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Invalid JSON format in request body");
  }

  // 3. Construct DTO
  const dto: CreateRequestDTO = {
    personnel_type: body.personnel_type as PersonnelType,
    request_type: body.request_type as RequestType,
    position_number: body.position_number as string | undefined,
    department_group: body.department_group as string | undefined,
    main_duty: body.main_duty as string | undefined,
    requested_amount: body.requested_amount
      ? Number(body.requested_amount)
      : undefined,
    effective_date: body.effective_date as string | undefined,
    work_attributes: workAttributes,
    submission_data: submissionData,
  };

  // 4. File Categorization
  let documents: Express.Multer.File[] = [];
  if (files) {
    if (files["files"]) {
      documents = [...documents, ...files["files"]];
    }
    if (files["license_file"]) {
      documents = [...documents, ...files["license_file"]];
    }
  }

  return { dto, documents };
};
