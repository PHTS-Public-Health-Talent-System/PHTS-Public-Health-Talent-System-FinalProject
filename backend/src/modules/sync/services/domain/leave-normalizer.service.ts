import type { RowDataPacket } from 'mysql2/promise';

const HALF_DAY_LABELS = new Set(['ครึ่งวัน', 'ครึ่งวัน - เช้า', 'ครึ่งวัน - บ่าย']);
const MALE_SET = new Set(['ชาย', 'm', 'M']);
const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

const LEAVE_TYPE_ALIASES: Array<{ aliases: string[]; normalized: string }> = [
  { aliases: ['ลาป่วย', 'sick'], normalized: 'sick' },
  { aliases: ['ลาพักผ่อน', 'vacation'], normalized: 'vacation' },
  { aliases: ['ลากิจ', 'ลากิจฉุกเฉิน', 'personal', 'business'], normalized: 'personal' },
  { aliases: ['ลาบวช', 'ลาอุปสมบท', 'ordain'], normalized: 'ordain' },
  { aliases: ['ลาคลอด', 'maternity'], normalized: 'maternity' },
  { aliases: ['education'], normalized: 'education' },
];

const WIFE_TERMS = ['ภริยา', 'ภรรยา', 'เมีย', 'คู่สมรส'];
const CHILDBIRTH_TERMS = ['หลังคลอด', 'แรกเกิด', 'พึ่งคลอด', 'คลอดบุตร', 'คลอดลูก'];
const SPOUSE_CHILDBIRTH_PATTERNS = [
  'ภรรยาคลอด',
  'ภริยาคลอด',
  'เมียคลอด',
  'คู่สมรสคลอด',
];
const CHILDCARE_TERMS = [
  'เลี้ยงดูบุตร',
  'ดูแลบุตร',
  'เลี้ยงบุตร',
  'ดูแลลูก',
  'เลี้ยงลูก',
  'ช่วยเลี้ยงดูบุตร',
];
const MALE_CHILDCARE_PATTERNS = [
  'ลาคลอดช่วยเลี้ยงดูบุตร',
  'ลาเพื่อเลี้ยงดูบุตร',
  'เลี้ยงดูบุตร.*คลอด',
  'บุตร.*พึ่งคลอด',
  'ดูแลบุตร.*แรกเกิด',
  'ช้วยภรรยา.*บุตร.*คลอด',
  'ช่วยภรรยา.*บุตร.*คลอด',
  'ลาช่วยภริยาเลี้ยงดูบุตร',
  'ลาไปช่วยเหลือภริยาที่คลอดบุตร',
];

const PERSONAL_TASK_TERMS = [
  'ธุรกรรม', 'ธุรกิจ', 'ภารกิจ', 'ธุระ', 'ติดต่อ', 'สัมภาษณ์', 'งานแต่ง', 'งานศพ',
  'ญาติเสีย', 'กลับบ้าน', 'ต่างจังหวัด', 'ที่ดิน', 'ธนาคาร', 'สหกรณ์', 'แก้บน',
  'ไปเที่ยว', 'ดูงาน', 'สอบ', 'ย้ายสำมะโนครัว',
];

const FAMILY_CONTEXT_TERMS = [
  'ลูก', 'ลูกชาย', 'ลูกสาว', 'บุตร', 'บิดา', 'มารดา', 'พ่อ', 'แม่', 'สามี', 'ภรรยา', 'ภริยา',
  'คู่สมรส', 'หลาน', 'พ่อตา', 'แม่ยาย', 'แฟน',
];
const FAMILY_CARE_PHRASE_PATTERNS = ['พาญาติ', 'เฝ้าญาติ', 'ดูแลญาติ', 'ญาติป่วย', 'ญาตินอนโรงพยาบาล'];

const FAMILY_SICK_TERMS = [
  'ป่วย', 'ผ่าตัด', 'admit', 'แอดมิด', 'ไม่สบาย', 'อุบัติเหตุ', 'ไข้', 'ตัวร้อน', 'รักษา',
  'covid', 'โควิด', 'ติดโควิด', 'ติดเชื้อ', 'นอนโรงพยาบาล',
];
const CARE_ACTION_PATTERNS = ['เฝ้า', 'ดูแล', 'ติดตาม', 'พา.*ไป', 'ส่ง.*ไป', 'เยี่ยม'];
const CARE_ACTION_TERMS = ['พา', 'ดูแล', 'เฝ้า', 'ติดตาม', 'เยี่ยม', 'ส่ง'];

const HARD_SICK_TERMS = [
  'แท้ง', 'ยุติการตั้งครรภ์', 'เสียชีวิตในครรภ์', 'ขูดมดลูก', 'ไม่มีตัวอ่อน', 'ตั้งครรภ์นอกมดลูก', 'ectopic',
];

const SURGERY_TERMS = ['ผ่าตัด', 'surgery', 'operation', 'ส่องกล้อง', 'เลเซอร์', 'biopsy'];
const SURGERY_PATTERNS = ['ตัด.*ออก'];
const SURGERY_TARGET_TERMS = [
  'มดลูก', 'รังไข่', 'เต้านม', 'breast', 'ปากมดลูก', 'เนื้องอก', 'ซีส', 'cyst', 'ไทรอยด์',
  'เข่า', 'ไหล่', 'หลัง', 'กระดูก', 'นิ้ว', 'ไส้ติ่ง', 'ไส้เลื่อน', 'ถุงน้ำดี', 'ต้อ',
  'ริดสีดวง', 'ทอนซิล', 'สมอง', 'เส้นเอ็น', 'ข้อเท้า', 'ข้อมือ', 'กระเพาะ', 'ลำไส้', 'หู',
  'ฝี', 'หนอง', 'นิ่ว', 'ฟันคุด', 'ก้อนเนื้อ', 'ตา', 'จมูก', 'คอ', 'ระบายน้ำ', 'ใส่สาย', 'ท่อน้ำตา',
];
const BIRTH_SURGERY_TERMS = ['ผ่าตัดคลอด', 'ผ่าคลอด', 'คลอดบุตร', 'ทำคลอด'];
const SICK_GENERAL_TERMS = [
  'มะเร็ง', 'cancer', 'ca.', 'myoma', 'เยื่อบุโพรงมดลูก', 'อุบัติเหตุ', 'รถชน', 'กระดูกหัก',
  'ไข้เลือดออก', 'โควิด', 'covid', 'flu', 'บ้านหมุน', 'เวียนศีรษะ', 'ปวดหัว', 'ท้องเสีย',
  'อาหารเป็นพิษ', 'นิ้วล็อค', 'เลือดออกในสมอง', 'หัวใจเต้น', 'ความดันโลหิตสูง', 'ต่อมบาร์โธลิน',
  'อักเสบ', 'ติดเชื้อ',
];
const DIRECT_SICK_TERMS = [
  'ป่วย', 'ไม่สบาย', 'ไข้', 'ตัวร้อน', 'อุบัติเหตุ', 'รถชน', 'admit', 'covid', 'โควิด',
  'ผ่าตัด', 'นอนโรงพยาบาล', 'พักรักษาตัว', 'พักฟื้น', 'ใบรับรองแพทย์', 'แพทย์สั่งพัก',
];
const DIRECT_SICK_PATTERNS = ['เข้า.*โรงพยาบาล', 'นอน.*โรงพยาบาล', 'รักษาตัว.*โรงพยาบาล'];
const DIRECT_SICK_STRONG_TERMS = [
  'ป่วย', 'ไม่สบาย', 'ไข้', 'ตัวร้อน', 'อุบัติเหตุ', 'รถชน', 'admit', 'covid', 'โควิด',
  'นอนโรงพยาบาล', 'พักรักษาตัว', 'พักฟื้น', 'ใบรับรองแพทย์', 'แพทย์สั่งพัก',
];
const DIRECT_SICK_STRONG_PATTERNS = ['เข้า.*โรงพยาบาล', 'นอน.*โรงพยาบาล', 'รักษาตัว.*โรงพยาบาล'];
const WORK_MEDICAL_CONTEXT_TERMS = [
  'ช่วยผ่าตัด', 'เข้าช่วยผ่าตัด', 'ประชุมงานผ่าตัด', 'งานผ่าตัด', 'ผู้ป่วยร่วม', 'ปฏิบัติงาน',
  'ประชุม', 'อบรม', 'ศึกษาดูงาน',
];
const WORK_OVERRIDE_SICK_TERMS = [
  'ไม่สบาย', 'ไข้', 'ตัวร้อน', 'admit', 'covid', 'โควิด', 'อุบัติเหตุ', 'รถชน',
  'นอนโรงพยาบาล', 'พักรักษาตัว', 'พักฟื้น', 'ใบรับรองแพทย์', 'แพทย์สั่งพัก',
];
const MEDICAL_VISIT_TERMS = ['หาหมอ', 'พบแพทย์', 'โรงพยาบาล', 'ฉีดวัคซีน', 'ตรวจตามนัด', 'หมอนัด'];
const SELF_INDICATOR_TERMS = ['ผม', 'ดิฉัน', 'ฉัน', 'ข้าพเจ้า', 'ตัวเอง', 'ตนเอง'];
const PREGNANCY_TERMS = ['ครรภ์', 'ท้อง', 'คลอด', 'แพ้ท้อง', 'ครรภ์เป็นพิษ', 'เตรียมคลอด'];
const MIN_REASONABLE_YEAR = 1990;
const FUTURE_YEAR_TOLERANCE = 2;

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alternationFromTerms = (terms: string[]): string =>
  terms.map(escapeRegex).join('|');

const alternationFromPatterns = (patterns: string[]): string =>
  patterns.join('|');

const buildTermsRegex = (terms: string[]): RegExp =>
  new RegExp(alternationFromTerms(terms));

const buildPairRegex = (leftTerms: string[], rightTerms: string[]): RegExp =>
  new RegExp(`(${alternationFromTerms(leftTerms)}).*(${alternationFromTerms(rightTerms)})`);

const buildPatternOrTermsRegex = (terms: string[], patterns: string[]): RegExp => {
  const parts: string[] = [];
  if (terms.length) parts.push(alternationFromTerms(terms));
  if (patterns.length) parts.push(alternationFromPatterns(patterns));
  return new RegExp(parts.join('|'));
};

const buildPatternTermsPairRegex = (
  leftTerms: string[],
  leftPatterns: string[],
  rightTerms: string[],
): RegExp => {
  const leftParts: string[] = [];
  if (leftTerms.length) leftParts.push(alternationFromTerms(leftTerms));
  if (leftPatterns.length) leftParts.push(alternationFromPatterns(leftPatterns));
  return new RegExp(`(${leftParts.join('|')}).*(${alternationFromTerms(rightTerms)})`);
};

const SPOUSE_CHILDBIRTH_REGEX = buildPairRegex(WIFE_TERMS, CHILDBIRTH_TERMS);
const SPOUSE_CHILDBIRTH_PATTERN_REGEX = buildPatternOrTermsRegex([], SPOUSE_CHILDBIRTH_PATTERNS);
const SPOUSE_CHILDCARE_REGEX = buildPairRegex(WIFE_TERMS, CHILDCARE_TERMS);
const CHILDCARE_REGEX = buildTermsRegex(CHILDCARE_TERMS);
const MALE_CHILDCARE_REGEX = buildPatternOrTermsRegex([], MALE_CHILDCARE_PATTERNS);
const PERSONAL_TASK_REGEX = buildTermsRegex(PERSONAL_TASK_TERMS);
const FAMILY_SICK_REGEX = buildPairRegex(FAMILY_CONTEXT_TERMS, FAMILY_SICK_TERMS);
const CARE_FAMILY_REGEX = buildPatternTermsPairRegex([], CARE_ACTION_PATTERNS, FAMILY_CONTEXT_TERMS);
const FAMILY_RELATION_REGEX = buildTermsRegex(FAMILY_CONTEXT_TERMS);
const FAMILY_CARE_PHRASE_REGEX = buildPatternOrTermsRegex([], FAMILY_CARE_PHRASE_PATTERNS);
const CARE_ACTION_REGEX = buildPatternOrTermsRegex(CARE_ACTION_TERMS, CARE_ACTION_PATTERNS);
const HARD_SICK_REGEX = buildTermsRegex(HARD_SICK_TERMS);
const SURGERY_REGEX = buildPatternOrTermsRegex(SURGERY_TERMS, SURGERY_PATTERNS);
const SURGERY_TARGET_REGEX = buildTermsRegex(SURGERY_TARGET_TERMS);
const BIRTH_SURGERY_REGEX = buildTermsRegex(BIRTH_SURGERY_TERMS);
const SICK_GENERAL_REGEX = buildTermsRegex(SICK_GENERAL_TERMS);
const DIRECT_SICK_REGEX = buildPatternOrTermsRegex(DIRECT_SICK_TERMS, DIRECT_SICK_PATTERNS);
const DIRECT_SICK_STRONG_REGEX = buildPatternOrTermsRegex(DIRECT_SICK_STRONG_TERMS, DIRECT_SICK_STRONG_PATTERNS);
const WORK_MEDICAL_CONTEXT_REGEX = buildTermsRegex(WORK_MEDICAL_CONTEXT_TERMS);
const WORK_OVERRIDE_SICK_REGEX = buildTermsRegex(WORK_OVERRIDE_SICK_TERMS);
const MEDICAL_VISIT_REGEX = buildTermsRegex(MEDICAL_VISIT_TERMS);
const SELF_INDICATOR_REGEX = buildTermsRegex(SELF_INDICATOR_TERMS);
const PREGNANCY_REGEX = buildTermsRegex(PREGNANCY_TERMS);

const currentYear = (): number => new Date().getUTCFullYear();

const normalizeSuspiciousFutureYear = (year: number): number => {
  const maxExpectedYear = currentYear() + FUTURE_YEAR_TOLERANCE;
  if (year <= maxExpectedYear) return year;

  // Some upstream rows are shifted from BE 25xx to AD 20xx by subtracting only 500 (e.g. 2566 -> 2066).
  const candidateFromShiftBug = year - 43;
  if (
    candidateFromShiftBug >= MIN_REASONABLE_YEAR &&
    candidateFromShiftBug <= maxExpectedYear
  ) {
    return candidateFromShiftBug;
  }

  return year;
};

const normalizeDigitsText = (value: string): string => {
  let normalized = value;
  THAI_DIGITS.forEach((thaiDigit, index) => {
    normalized = normalized.replaceAll(thaiDigit, String(index));
  });
  return normalized;
};

const buildUtcDate = (year: number, month: number, day: number): Date | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const toDateOnly = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const text = normalizeDigitsText(String(value)).trim();

  let m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(text);
  if (m) {
    let year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year > 2400) year -= 543;
    year = normalizeSuspiciousFutureYear(year);
    return buildUtcDate(year, month, day);
  }

  m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(text);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year > 2400) year -= 543;
    year = normalizeSuspiciousFutureYear(year);
    return buildUtcDate(year, month, day);
  }

  return null;
};

const toDateString = (value: Date | null): string | null => {
  if (!value) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const diffDaysInclusive = (start: Date | null, end: Date | null): number => {
  if (!start || !end) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return diff + 1;
};

const fiscalYearFromDate = (date: Date | null): number | null => {
  if (!date) return null;
  const y = date.getUTCFullYear() + 543;
  const m = date.getUTCMonth() + 1;
  return y + (m >= 10 ? 1 : 0);
};

const isPersonalMaternity = (remarkLower: string): boolean => {
  return (
    PERSONAL_TASK_REGEX.test(remarkLower) ||
    FAMILY_SICK_REGEX.test(remarkLower) ||
    CARE_FAMILY_REGEX.test(remarkLower)
  );
};

const isSickMaternity = (remarkLower: string): boolean => {
  if (HARD_SICK_REGEX.test(remarkLower)) return true;

  if (
    SURGERY_REGEX.test(remarkLower) &&
    SURGERY_TARGET_REGEX.test(remarkLower) &&
    !BIRTH_SURGERY_REGEX.test(remarkLower)
  ) {
    return true;
  }

  return SICK_GENERAL_REGEX.test(remarkLower) && !PREGNANCY_REGEX.test(remarkLower);
};

const hasWifeHelpSignal = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  if (SPOUSE_CHILDBIRTH_REGEX.test(remarkLower)) return true;
  if (SPOUSE_CHILDBIRTH_PATTERN_REGEX.test(remarkLower)) return true;
  if (SPOUSE_CHILDCARE_REGEX.test(remarkLower)) return true;
  if (MALE_CHILDCARE_REGEX.test(remarkLower)) return true;
  // Childcare-only phrases are accepted when they still indicate postpartum/newborn context.
  return CHILDCARE_REGEX.test(remarkLower) && CHILDBIRTH_TERMS.some((term) => remarkLower.includes(term));
};

const hasFamilyCareContext = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  if (FAMILY_CARE_PHRASE_REGEX.test(remarkLower)) return true;
  if (!FAMILY_RELATION_REGEX.test(remarkLower)) return false;
  return CARE_ACTION_REGEX.test(remarkLower) || FAMILY_SICK_REGEX.test(remarkLower) || CARE_FAMILY_REGEX.test(remarkLower);
};

const hasEscortMedicalContext = (remarkLower: string): boolean =>
  CARE_ACTION_REGEX.test(remarkLower) && MEDICAL_VISIT_REGEX.test(remarkLower);

const hasDirectSickSignal = (remarkLower: string): boolean => {
  if (!remarkLower.trim()) return false;
  if (isSickMaternity(remarkLower)) return true;
  return DIRECT_SICK_REGEX.test(remarkLower);
};

const shouldClassifyAsSick = (remarkLower: string): boolean => {
  if (!hasDirectSickSignal(remarkLower)) return false;
  if (WORK_MEDICAL_CONTEXT_REGEX.test(remarkLower) && !WORK_OVERRIDE_SICK_REGEX.test(remarkLower)) {
    return false;
  }
  if (hasEscortMedicalContext(remarkLower) && !SELF_INDICATOR_REGEX.test(remarkLower) && !DIRECT_SICK_STRONG_REGEX.test(remarkLower)) {
    return false;
  }
  if (!hasFamilyCareContext(remarkLower)) return true;
  return SELF_INDICATOR_REGEX.test(remarkLower);
};

export type LeaveReclassificationMeta = {
  original_type: string;
  normalized_type: string;
  reason_code:
    | 'MATERNITY_PERSONAL_PATTERN'
    | 'MATERNITY_SICK_PATTERN'
    | 'MATERNITY_WIFE_HELP_PATTERN'
    | 'SICK_PATTERN'
    | 'SICK_FAMILY_CARE_PATTERN'
    | 'WIFE_HELP_PATTERN'
    | 'GENERIC_RULE_RECLASSIFIED';
  reason_text: string;
};

export const normalizeCitizenId = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits;
};

export const isValidCitizenId = (value: unknown): boolean =>
  /^[0-9]{13}$/.test(normalizeCitizenId(value));

type LeaveTypeContext = {
  hrmsLeaveType: string;
  remark: string;
  sex?: string | null;
  durationDays: number;
};

type DateRange = {
  start: Date | null;
  end: Date | null;
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

const buildReclassificationMeta = (input: {
  originalType: string;
  normalizedType: string;
  remark: string;
  sex?: string | null;
  durationDays: number;
}): LeaveReclassificationMeta | null => {
  const original = canonicalLeaveType(input.originalType);
  const normalized = canonicalLeaveType(input.normalizedType);
  if (!original || original === normalized) return null;

  if (original === 'maternity') {
    const remarkLower = input.remark.toLowerCase();
    const isMale = MALE_SET.has(String(input.sex ?? '').trim());

    if (normalized === 'wife_help' && isMale && hasWifeHelpSignal(remarkLower)) {
      return {
        original_type: original,
        normalized_type: normalized,
        reason_code: 'MATERNITY_WIFE_HELP_PATTERN',
        reason_text: 'male + spouse childbirth/care pattern matched',
      };
    }
    if (normalized === 'personal' && input.durationDays < 60 && isPersonalMaternity(remarkLower)) {
      return {
        original_type: original,
        normalized_type: normalized,
        reason_code: 'MATERNITY_PERSONAL_PATTERN',
        reason_text: 'maternity remark matched personal/family-care pattern',
      };
    }
    if (normalized === 'sick' && input.durationDays < 60 && isSickMaternity(remarkLower)) {
      return {
        original_type: original,
        normalized_type: normalized,
        reason_code: 'MATERNITY_SICK_PATTERN',
        reason_text: 'maternity remark matched sickness/surgery pattern',
      };
    }
  }

  if (normalized === 'sick' && original !== 'maternity' && shouldClassifyAsSick(input.remark.toLowerCase())) {
    return {
      original_type: original,
      normalized_type: normalized,
      reason_code: 'SICK_PATTERN',
      reason_text: 'remark matched direct sickness context and not family-care context',
    };
  }

  if (original === 'sick' && normalized === 'personal' && hasFamilyCareContext(input.remark.toLowerCase())) {
    return {
      original_type: original,
      normalized_type: normalized,
      reason_code: 'SICK_FAMILY_CARE_PATTERN',
      reason_text: 'sick source type looked like family-care context',
    };
  }

  if (normalized === 'wife_help') {
    const isMale = MALE_SET.has(String(input.sex ?? '').trim());
    if (isMale && hasWifeHelpSignal(input.remark.toLowerCase())) {
      return {
        original_type: original,
        normalized_type: normalized,
        reason_code: 'WIFE_HELP_PATTERN',
        reason_text: 'male + spouse childbirth/newborn childcare pattern matched',
      };
    }
  }

  return {
    original_type: original,
    normalized_type: normalized,
    reason_code: 'GENERIC_RULE_RECLASSIFIED',
    reason_text: 'leave type was normalized by sync classification rules',
  };
};

const classifyLeaveType = (input: LeaveTypeContext): string => {
  const t = input.hrmsLeaveType.trim();
  const remarkLower = input.remark.toLowerCase();
  const isMale = MALE_SET.has(String(input.sex ?? '').trim());
  if (isMale && hasWifeHelpSignal(remarkLower)) return 'wife_help';

  const known = resolveKnownLeaveType(t);
  if (known === 'sick') {
    if (hasFamilyCareContext(remarkLower) && !SELF_INDICATOR_REGEX.test(remarkLower)) {
      return 'personal';
    }
    return 'sick';
  }
  if (known && known !== 'maternity') {
    if ((known === 'personal' || known === 'vacation') && shouldClassifyAsSick(remarkLower)) {
      return 'sick';
    }
    return known;
  }

  if (known === 'maternity') {
    if (isMale && hasWifeHelpSignal(remarkLower)) {
      return 'wife_help';
    }
    if (input.durationDays >= 60) return 'maternity';
    if (isPersonalMaternity(remarkLower)) return 'personal';
    if (isSickMaternity(remarkLower)) return 'sick';
    return 'maternity';
  }

  if (shouldClassifyAsSick(remarkLower)) return 'sick';
  return 'personal';
};

const normalizeDateRange = (row: RowDataPacket): DateRange => {
  const start = toDateOnly(row.start_date);
  const end = toDateOnly(row.end_date);
  if (!start || !end) {
    return { start: start ?? end, end: end ?? start };
  }
  return {
    start: new Date(Math.min(start.getTime(), end.getTime())),
    end: new Date(Math.max(start.getTime(), end.getTime())),
  };
};

const resolveDurationDays = (row: RowDataPacket, range: DateRange): number => {
  const sourceType = String(row.source_type ?? 'LEAVE');
  const halfDay = Number(row.half_day ?? 0) === 1;
  const endDateDetail = String(row.end_date_detail ?? '');
  const sameDay =
    range.start && range.end && range.start.getTime() === range.end.getTime();
  const rawDuration = diffDaysInclusive(range.start, range.end);
  if (sourceType === 'LEAVE' && (halfDay || (sameDay && HALF_DAY_LABELS.has(endDateDetail)))) {
    return 0.5;
  }
  const parsed = Number(row.duration_days ?? rawDuration);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return rawDuration > 0 ? rawDuration : 0;
};

export const normalizeLeaveRowWithMeta = (row: RowDataPacket): {
  row: RowDataPacket;
  meta: LeaveReclassificationMeta | null;
} => {
  const range = normalizeDateRange(row);
  const durationDays = resolveDurationDays(row, range);

  const remark = String(row.remark ?? '');
  const classifiedSourceLeaveType = String(row.hrms_leave_type ?? row.leave_type ?? '');
  const originalLeaveType = String(row.raw_hrms_leave_type ?? classifiedSourceLeaveType);
  const leaveType = classifyLeaveType({
    hrmsLeaveType: classifiedSourceLeaveType,
    remark,
    sex: row.sex as string | null,
    durationDays,
  });

  const normalizedRow = {
    ref_id: String(row.ref_id ?? '').trim(),
    citizen_id: normalizeCitizenId(row.citizen_id),
    leave_type: leaveType,
    start_date: toDateString(range.start),
    end_date: toDateString(range.end),
    duration_days: durationDays,
    fiscal_year: fiscalYearFromDate(range.start),
    remark,
    status: String(row.status ?? 'approved'),
  } as RowDataPacket;

  return {
    row: normalizedRow,
    meta: buildReclassificationMeta({
      originalType: originalLeaveType,
      normalizedType: leaveType,
      remark,
      sex: row.sex as string | null,
      durationDays,
    }),
  };
};

export const normalizeLeaveRow = (row: RowDataPacket): RowDataPacket =>
  normalizeLeaveRowWithMeta(row).row;
