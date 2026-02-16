import {
  RequestStatus,
  RequestType,
  PersonnelType,
  PTSRequest,
  RequestWithDetails,
} from '@/modules/request/request.types.js';

export const REQUESTER_FIELDS = `
  u.citizen_id as requester_citizen_id,
  u.role as requester_role,
  e.first_name as requester_first_name,
  e.last_name as requester_last_name,
  e.position_name as requester_position
`;

export const REQUESTER_JOINS = `
  JOIN user_accounts u ON r.user_id = u.user_id
  LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
`;

export const mapRequestRow = (row: any): PTSRequest | RequestWithDetails => {
  const baseRequest = {
    request_id: row.request_id,
    user_id: row.user_id,
    citizen_id: row.citizen_id, // Ensure row has this
    request_no: row.request_no,
    personnel_type: row.personnel_type as PersonnelType,
    // Keep both key styles for backward compatibility across clients.
    position_number: row.current_position_number,
    current_position_number: row.current_position_number,
    department_group: row.current_department,
    current_department: row.current_department,
    main_duty: row.main_duty,
    work_attributes:
      typeof row.work_attributes === "string"
        ? JSON.parse(row.work_attributes)
        : row.work_attributes,
    applicant_signature_id: row.applicant_signature_id,
    request_type: row.request_type as RequestType,
    requested_amount: row.requested_amount,
    effective_date: row.effective_date,
    status: row.status as RequestStatus,
    current_step: row.current_step,
    submission_data:
      typeof row.submission_data === "string"
        ? JSON.parse(row.submission_data)
        : row.submission_data,
    has_verification_snapshot: Boolean(row.has_verification_snapshot),
    created_at: row.created_at,
    updated_at: row.updated_at,
    step_started_at: row.step_started_at ?? null,
  };
  return baseRequest as RequestWithDetails; // Trusting the query returns necessary fields
};

export const hydrateRequests = async (
  rows: any[],
): Promise<RequestWithDetails[]> => {
  return rows.map((row) => mapRequestRow(row));
};

export const getRequestLinkForRole = (
  _role: string,
  requestId: number,
): string => {
  return `/dashboard/approver/requests/${requestId}`;
};

export const generateRequestNoFromId = (
  requestId: number,
  createdAt: Date | string = new Date(),
): string => {
  const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const adYear = Number.isNaN(createdDate.getTime())
    ? new Date().getFullYear()
    : createdDate.getFullYear();
  const beYear = adYear + 543;
  return `REQ-${beYear}-${Math.abs(Math.trunc(requestId))}`;
};

export const normalizeDateToYMD = (date: string | Date): string => {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};

export const parseJsonField = <T>(
  value: any,
  _fieldName?: string,
): T | null => {
  if (!value) return null;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};
