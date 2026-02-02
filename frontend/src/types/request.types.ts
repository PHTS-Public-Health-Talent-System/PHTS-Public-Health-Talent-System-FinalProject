// ===== Enums / Unions =====

export type PersonnelType = 'CIVIL_SERVANT' | 'GOV_EMPLOYEE' | 'PH_EMPLOYEE' | 'TEMP_EMPLOYEE';

export type RequestType = 'NEW_ENTRY' | 'EDIT_INFO_SAME_RATE' | 'EDIT_INFO_NEW_RATE';

export type RequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_HEAD_WARD'
  | 'PENDING_HEAD_DEPT'
  | 'PENDING_PTS_OFFICER'
  | 'PENDING_HR'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'RETURNED';

export type EmploymentRegion = 'CENTRAL' | 'REGIONAL';

// ===== Interfaces =====

export interface WorkAttributes {
  operation: boolean;
  planning: boolean;
  coordination: boolean;
  service: boolean;
}

export interface Attachment {
  attachment_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  ocr_status?: string | null;
  ocr_confidence?: number | null;
  ocr_provider?: string | null;
  ocr_processed_at?: string | null;
}

export interface ApprovalAction {
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL';
  actor: {
    first_name: string;
    last_name: string;
  } | null;
  comment: string | null;
  action_date: string;
  step_no: number | null;
}

export interface PTSRequest {
  request_id: number;
  request_no: string | null;
  user_id: number;
  citizen_id: string;
  personnel_type: PersonnelType;
  current_position_number: string | null;
  current_department: string | null;
  work_attributes: WorkAttributes;
  main_duty: string | null;
  request_type: RequestType;
  target_rate_id: number | null;
  requested_amount: number;
  effective_date: string;
  status: RequestStatus;
  current_step: number;
  created_at: string;
  updated_at: string;
  step_started_at: string | null;
  has_verification_snapshot?: boolean;
  submission_data?: Record<string, unknown> | string | null;
}

export interface RequestWithDetails extends PTSRequest {
  attachments: Attachment[];
  actions: ApprovalAction[];
  requester?: {
    citizen_id: string;
    role: string;
    first_name?: string;
    last_name?: string;
    position?: string;
  };
}

// ===== Form Data (wizard) =====

export interface RequestFormData {
  // Section 1: Request Type
  requestType: 'NEW' | 'EDIT' | 'CHANGE_RATE';

  // Section 0: User Info (Prefill + Editable)
  title: string;
  firstName: string;
  lastName: string;
  citizenId: string;
  employeeType: PersonnelType;
  positionName: string;
  positionNumber: string;
  department: string;
  subDepartment: string;
  employmentRegion: EmploymentRegion;
  effectiveDate: string;

  // Section 4: Work Attributes
  missionGroup: string;
  workAttributes: {
    operation: boolean;
    planning: boolean;
    coordination: boolean;
    service: boolean;
  };

  // Files
  files: {
    LICENSE: File | null;
    ORDER: File | null;
    OTHER: File | null;
  };
  attachments?: Attachment[];

  // Section 6: Classification
  ocrResult: {
    licenseNo: string;
    expiryDate: string;
    confidence: number;
    attachmentId?: number;
  } | null;

  recommendedClassification: {
    groupId: string;
    itemId: string;
    amount: number;
    hintText?: string;
  } | null;

  classification: {
    groupId: string;
    itemId: string;
    amount: number;
  };

  // Section 7: Signature
  signature?: string;
  signatureMode?: 'SAVED' | 'NEW';
  saveSignature?: boolean;

  // Meta
  id?: string;
}

// ===== Label Maps =====

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  NEW_ENTRY: 'ขอรับ พ.ต.ส. ครั้งแรก',
  EDIT_INFO_SAME_RATE: 'แก้ไขข้อมูล (อัตราเดิม)',
  EDIT_INFO_NEW_RATE: 'แก้ไขข้อมูล (อัตราใหม่)',
};

export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  CIVIL_SERVANT: 'ข้าราชการ',
  GOV_EMPLOYEE: 'พนักงานราชการ',
  PH_EMPLOYEE: 'พนักงานกระทรวงสาธารณสุข',
  TEMP_EMPLOYEE: 'ลูกจ้างชั่วคราว',
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  PENDING: 'รอดำเนินการ',
  PENDING_HEAD_WARD: 'รอหัวหน้าตึก/หัวหน้างาน',
  PENDING_HEAD_DEPT: 'รอหัวหน้ากลุ่มงาน',
  PENDING_PTS_OFFICER: 'รอเจ้าหน้าที่ พ.ต.ส.',
  PENDING_HR: 'รอหัวหน้า HR',
  PENDING_FINANCE: 'รอหัวหน้าการเงิน',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
  CANCELLED: 'ยกเลิก',
  RETURNED: 'ส่งกลับแก้ไข',
};

export const STEP_LABELS: Record<number, string> = {
  0: 'ยื่นคำขอ',
  1: 'หัวหน้าตึก/หัวหน้างาน',
  2: 'หัวหน้ากลุ่มงาน',
  3: 'เจ้าหน้าที่ พ.ต.ส.',
  4: 'หัวหน้า HR',
  5: 'หัวหน้าการเงิน',
  6: 'ผู้อำนวยการ',
};

export const WORK_ATTRIBUTE_LABELS: Record<keyof WorkAttributes, string> = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'บริการ',
};
