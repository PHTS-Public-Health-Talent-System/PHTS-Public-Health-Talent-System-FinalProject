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
