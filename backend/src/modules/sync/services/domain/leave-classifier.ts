import {
  ANATOMY_FALSE_RELATION_TERMS,
  CARE_ACTION_REGEX,
  CARE_FAMILY_REGEX,
  CHILDCARE_REGEX,
  DIRECT_SELF_SYMPTOM_TERMS,
  DIRECT_SICK_REGEX,
  FAMILY_CARE_PHRASE_REGEX,
  FAMILY_RELATION_REGEX,
  FAMILY_SICK_REGEX,
  LEGAL_ADMIN_CONTEXT_REGEX,
  LEAVE_TYPE_ALIASES,
  MALE_CHILDCARE_REGEX,
  MALE_SET,
  MEDICAL_VISIT_REGEX,
  OTHER_PERSON_MEDICAL_REGEX,
  OTHER_PERSON_RELATION_REGEX,
  PERSONAL_TASK_REGEX,
  SELF_INDICATOR_REGEX,
  SPOUSE_CHILDCARE_REGEX,
  SPOUSE_CHILDBIRTH_PATTERN_REGEX,
  SPOUSE_CHILDBIRTH_REGEX,
  WORK_MEDICAL_CONTEXT_REGEX,
  WORK_OVERRIDE_SICK_REGEX,
} from '@/modules/sync/services/domain/leave-classification-rules.js';

export type LeaveReclassificationMeta = {
  original_type: string;
  normalized_type: string;
  reason_code:
    | 'MATERNITY_WIFE_HELP_PATTERN'
    | 'WIFE_HELP_PATTERN';
  reason_text: string;
};

export type LeaveReviewMeta = {
  source_type: string;
  suspected_type: 'personal';
  reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW';
  reason_text: string;
};

type LeaveTypeContext = {
  hrmsLeaveType: string;
  remark: string;
  sex?: string | null;
  durationDays: number;
};

const sanitizeRelationContext = (remarkLower: string): string => {
  let sanitized = remarkLower;
  for (const term of ANATOMY_FALSE_RELATION_TERMS) {
    sanitized = sanitized.replaceAll(term, ' ');
  }
  return sanitized;
};

const countMatches = (remarkLower: string, terms: string[]): number =>
  terms.reduce((count, term) => count + (remarkLower.includes(term) ? 1 : 0), 0);

export const hasWifeHelpSignal = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  if (SPOUSE_CHILDBIRTH_REGEX.test(remarkLower)) return true;
  if (SPOUSE_CHILDBIRTH_PATTERN_REGEX.test(remarkLower)) return true;
  if (SPOUSE_CHILDCARE_REGEX.test(remarkLower)) return true;
  if (MALE_CHILDCARE_REGEX.test(remarkLower)) return true;
  return CHILDCARE_REGEX.test(remarkLower) && ['หลังคลอด', 'แรกเกิด', 'พึ่งคลอด', 'คลอดบุตร', 'คลอดลูก'].some((term) => remarkLower.includes(term));
};

export const hasFamilyCareContext = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  const relationText = sanitizeRelationContext(remarkLower);
  if (FAMILY_CARE_PHRASE_REGEX.test(relationText)) return true;
  if (!FAMILY_RELATION_REGEX.test(relationText)) return false;
  return (
    CARE_ACTION_REGEX.test(relationText) ||
    FAMILY_SICK_REGEX.test(relationText) ||
    CARE_FAMILY_REGEX.test(relationText)
  );
};

const hasEscortMedicalContext = (remarkLower: string): boolean =>
  CARE_ACTION_REGEX.test(remarkLower) && MEDICAL_VISIT_REGEX.test(remarkLower);

const hasOtherPersonMedicalContext = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  const relationText = sanitizeRelationContext(remarkLower);
  if (FAMILY_CARE_PHRASE_REGEX.test(relationText)) return true;
  if (OTHER_PERSON_MEDICAL_REGEX.test(relationText)) return true;
  if (!OTHER_PERSON_RELATION_REGEX.test(relationText)) return false;
  return (
    CARE_ACTION_REGEX.test(relationText) ||
    FAMILY_SICK_REGEX.test(relationText) ||
    MEDICAL_VISIT_REGEX.test(relationText) ||
    DIRECT_SICK_REGEX.test(relationText)
  );
};

export const shouldClassifyAsSick = (remarkLower: string): boolean => {
  if (LEGAL_ADMIN_CONTEXT_REGEX.test(remarkLower)) return false;
  if (!DIRECT_SICK_REGEX.test(remarkLower)) return false;
  if (WORK_MEDICAL_CONTEXT_REGEX.test(remarkLower) && !WORK_OVERRIDE_SICK_REGEX.test(remarkLower)) {
    return false;
  }
  const hasSelfIndicator = SELF_INDICATOR_REGEX.test(remarkLower);
  if (PERSONAL_TASK_REGEX.test(remarkLower) && !hasSelfIndicator) return false;
  if (hasEscortMedicalContext(remarkLower) && !hasSelfIndicator) return false;
  if (hasOtherPersonMedicalContext(remarkLower) && !hasSelfIndicator) return false;
  if (!hasFamilyCareContext(remarkLower)) return true;
  return hasSelfIndicator;
};

const resolveKnownLeaveType = (raw: string): string | null => {
  const normalizedRaw = raw.trim().toLowerCase();
  if (!normalizedRaw) return null;
  for (const def of LEAVE_TYPE_ALIASES) {
    if (def.aliases.some((alias) => alias.toLowerCase() === normalizedRaw)) {
      return def.normalized;
    }
  }
  return null;
};

const canonicalLeaveType = (raw: string): string => {
  const known = resolveKnownLeaveType(raw);
  if (known) return known;
  const fallback = raw.trim().toLowerCase();
  return fallback || 'personal';
};

type WifeHelpSignalInput = {
  remark: string;
  sex?: string | null;
};

const hasStrongWifeHelpSignal = (input: WifeHelpSignalInput): boolean => {
  if (!MALE_SET.has(String(input.sex ?? '').trim())) return false;
  return hasWifeHelpSignal(input.remark.toLowerCase());
};

export const buildReclassificationMeta = (input: {
  originalType: string;
  normalizedType: string;
  remark: string;
  sex?: string | null;
  durationDays: number;
}): LeaveReclassificationMeta | null => {
  const original = canonicalLeaveType(input.originalType);
  const normalized = canonicalLeaveType(input.normalizedType);
  if (!original || original === normalized) return null;
  if (normalized !== 'wife_help') return null;
  if (!hasStrongWifeHelpSignal(input)) return null;

  return {
    original_type: original,
    normalized_type: normalized,
    reason_code: original === 'maternity' ? 'MATERNITY_WIFE_HELP_PATTERN' : 'WIFE_HELP_PATTERN',
    reason_text: 'พบข้อความชัดเจนว่าเป็นการลาช่วยภริยาคลอดหรือเลี้ยงดูบุตร',
  };
};

export const buildLeaveReviewMeta = (input: {
  originalType: string;
  normalizedType: string;
  remark: string;
  sex?: string | null;
}): LeaveReviewMeta | null => {
  const original = canonicalLeaveType(input.originalType);
  const normalized = canonicalLeaveType(input.normalizedType);
  const remarkLower = input.remark.toLowerCase();

  if (original !== 'sick' || normalized !== 'sick') return null;
  if (!remarkLower.trim()) return null;
  if (!hasFamilyCareContext(remarkLower)) return null;
  if (SELF_INDICATOR_REGEX.test(remarkLower)) return null;
  if (shouldClassifyAsSick(remarkLower)) return null;
  if (countMatches(remarkLower, DIRECT_SELF_SYMPTOM_TERMS) >= 1) return null;

  return {
    source_type: 'sick',
    suspected_type: 'personal',
    reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
    reason_text: 'ข้อความการลามีบริบทเป็นการดูแลบุคคลอื่น แม้ประเภทการลาจาก HRMS จะเป็นลาป่วย',
  };
};

export const classifyLeaveType = (input: LeaveTypeContext): string => {
  if (hasStrongWifeHelpSignal(input)) return 'wife_help';

  const known = resolveKnownLeaveType(input.hrmsLeaveType.trim());
  if (known) return known;

  if (shouldClassifyAsSick(input.remark.toLowerCase())) return 'sick';
  return 'personal';
};
