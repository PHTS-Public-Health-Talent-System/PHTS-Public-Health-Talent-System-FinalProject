export const HALF_DAY_LABELS = new Set(['ครึ่งวัน', 'ครึ่งวัน - เช้า', 'ครึ่งวัน - บ่าย']);
export const MALE_SET = new Set(['ชาย', 'm', 'M']);
const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

export const LEAVE_TYPE_ALIASES: Array<{ aliases: string[]; normalized: string }> = [
  { aliases: ['ลาป่วย', 'sick'], normalized: 'sick' },
  { aliases: ['ลาพักผ่อน', 'vacation'], normalized: 'vacation' },
  { aliases: ['ลากิจ', 'ลากิจฉุกเฉิน', 'personal', 'business'], normalized: 'personal' },
  { aliases: ['ลาบวช', 'ลาอุปสมบท', 'ordain'], normalized: 'ordain' },
  { aliases: ['ลาคลอด', 'maternity'], normalized: 'maternity' },
  { aliases: ['education'], normalized: 'education' },
];

const WIFE_TERMS = ['ภริยา', 'ภรรยา', 'เมีย', 'คู่สมรส'];
const CHILDBIRTH_TERMS = ['หลังคลอด', 'แรกเกิด', 'พึ่งคลอด', 'คลอดบุตร', 'คลอดลูก'];
const SPOUSE_CHILDBIRTH_PATTERNS = ['ภรรยาคลอด', 'ภริยาคลอด', 'เมียคลอด', 'คู่สมรสคลอด'];
const CHILDCARE_TERMS = ['เลี้ยงดูบุตร', 'ดูแลบุตร', 'เลี้ยงบุตร', 'ดูแลลูก', 'เลี้ยงลูก', 'ช่วยเลี้ยงดูบุตร'];
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
  'ไปเที่ยว', 'ดูงาน', 'สอบ', 'ย้ายสำมะโนครัว', 'พยาน', 'คดี', 'สภอ', 'ตำรวจ', 'ศาล',
];
const LEGAL_ADMIN_CONTEXT_TERMS = ['พยาน', 'คดี', 'สภอ', 'ตำรวจ', 'ศาล'];

const FAMILY_CONTEXT_TERMS = [
  'ลูก', 'ลูกชาย', 'ลูกสาว', 'บุตร', 'บิดา', 'มารดา', 'พ่อ', 'แม่', 'สามี', 'ภรรยา', 'ภริยา',
  'คู่สมรส', 'หลาน', 'พ่อตา', 'แม่ยาย', 'แฟน',
];
const OTHER_PERSON_CONTEXT_TERMS = [
  ...FAMILY_CONTEXT_TERMS,
  'ญาติ', 'ญาติผู้ใหญ่', 'พี่', 'พี่ชาย', 'พี่สาว', 'น้อง', 'น้องชาย', 'น้องสาว',
  'เพื่อน', 'ครอบครัว', 'คนในครอบครัว', 'ผู้ป่วย', 'คนป่วย', 'คนไข้',
];
const FAMILY_CARE_PHRASE_PATTERNS = ['พาญาติ', 'เฝ้าญาติ', 'ดูแลญาติ', 'ญาติป่วย', 'ญาตินอนโรงพยาบาล'];
const OTHER_PERSON_MEDICAL_PATTERNS = [
  'ไปดูแล.*ป่วย',
  'ไปเยี่ยม.*ป่วย',
  'ไปเฝ้า.*ป่วย',
  'พาผู้ป่วย.*พบแพทย์',
  'พาคนไข้.*พบแพทย์',
  'พาคนป่วย.*พบแพทย์',
];
export const ANATOMY_FALSE_RELATION_TERMS = ['มดลูก', 'ปากมดลูก', 'ลูกตา', 'ลูกอัณฑะ', 'ลูกหมาก'];

const FAMILY_SICK_TERMS = [
  'ป่วย', 'ผ่าตัด', 'admit', 'แอดมิด', 'ไม่สบาย', 'อุบัติเหตุ', 'ไข้', 'ตัวร้อน', 'รักษา',
  'covid', 'โควิด', 'ติดโควิด', 'ติดเชื้อ', 'นอนโรงพยาบาล', 'icu',
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
export const DIRECT_SELF_SYMPTOM_TERMS = [
  'ปวดหัว', 'ไอ', 'น้ำมูก', 'เจ็บคอ', 'เวียนศีรษะ', 'มึนศรีษะ', 'มึนศีรษะ', 'ปวดท้อง',
  'ท้องเสีย', 'คลื่นไส้', 'อาเจียน', 'ปวดแผล', 'ปวดกล้ามเนื้อ', 'ปวดกล้าเนื้อ',
];
const OWN_SICK_OVERRIDE_TERMS = ['พักฟื้น', 'พักรักษาตัว', 'ใบรับรองแพทย์', 'แพทย์สั่งพัก', 'ตรวจโควิด', 'ผลตรวจโควิด'];
const OWN_SICK_OVERRIDE_PATTERNS = ['ได้รับการผ่าตัด', 'หลังการผ่าตัด', 'หลังผ่าตัด', 'ลาป่วยหลัง', 'มารับการผ่าตัด'];
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

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternationFromTerms = (terms: string[]): string => terms.map(escapeRegex).join('|');
const alternationFromPatterns = (patterns: string[]): string => patterns.join('|');
const buildTermsRegex = (terms: string[]): RegExp => new RegExp(alternationFromTerms(terms));
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

export const SPOUSE_CHILDBIRTH_REGEX = buildPairRegex(WIFE_TERMS, CHILDBIRTH_TERMS);
export const SPOUSE_CHILDBIRTH_PATTERN_REGEX = buildPatternOrTermsRegex([], SPOUSE_CHILDBIRTH_PATTERNS);
export const SPOUSE_CHILDCARE_REGEX = buildPairRegex(WIFE_TERMS, CHILDCARE_TERMS);
export const CHILDCARE_REGEX = buildTermsRegex(CHILDCARE_TERMS);
export const MALE_CHILDCARE_REGEX = buildPatternOrTermsRegex([], MALE_CHILDCARE_PATTERNS);
export const PERSONAL_TASK_REGEX = buildTermsRegex(PERSONAL_TASK_TERMS);
export const FAMILY_SICK_REGEX = buildPairRegex(FAMILY_CONTEXT_TERMS, FAMILY_SICK_TERMS);
export const CARE_FAMILY_REGEX = buildPatternTermsPairRegex([], CARE_ACTION_PATTERNS, FAMILY_CONTEXT_TERMS);
export const FAMILY_RELATION_REGEX = buildTermsRegex(FAMILY_CONTEXT_TERMS);
export const FAMILY_CARE_PHRASE_REGEX = buildPatternOrTermsRegex([], FAMILY_CARE_PHRASE_PATTERNS);
export const OTHER_PERSON_RELATION_REGEX = buildTermsRegex(OTHER_PERSON_CONTEXT_TERMS);
export const OTHER_PERSON_MEDICAL_REGEX = buildPatternOrTermsRegex([], OTHER_PERSON_MEDICAL_PATTERNS);
export const CARE_ACTION_REGEX = buildPatternOrTermsRegex(CARE_ACTION_TERMS, CARE_ACTION_PATTERNS);
export const HARD_SICK_REGEX = buildTermsRegex(HARD_SICK_TERMS);
export const SURGERY_REGEX = buildPatternOrTermsRegex(SURGERY_TERMS, SURGERY_PATTERNS);
export const SURGERY_TARGET_REGEX = buildTermsRegex(SURGERY_TARGET_TERMS);
export const BIRTH_SURGERY_REGEX = buildTermsRegex(BIRTH_SURGERY_TERMS);
export const SICK_GENERAL_REGEX = buildTermsRegex(SICK_GENERAL_TERMS);
export const DIRECT_SICK_REGEX = buildPatternOrTermsRegex(DIRECT_SICK_TERMS, DIRECT_SICK_PATTERNS);
export const LEGAL_ADMIN_CONTEXT_REGEX = buildTermsRegex(LEGAL_ADMIN_CONTEXT_TERMS);
export const OWN_SICK_OVERRIDE_REGEX = buildPatternOrTermsRegex(OWN_SICK_OVERRIDE_TERMS, OWN_SICK_OVERRIDE_PATTERNS);
export const WORK_MEDICAL_CONTEXT_REGEX = buildTermsRegex(WORK_MEDICAL_CONTEXT_TERMS);
export const WORK_OVERRIDE_SICK_REGEX = buildTermsRegex(WORK_OVERRIDE_SICK_TERMS);
export const MEDICAL_VISIT_REGEX = buildTermsRegex(MEDICAL_VISIT_TERMS);
export const SELF_INDICATOR_REGEX = buildTermsRegex(SELF_INDICATOR_TERMS);
export const PREGNANCY_REGEX = buildTermsRegex(PREGNANCY_TERMS);

export const normalizeDigitsText = (value: string): string => {
  let normalized = value;
  THAI_DIGITS.forEach((thaiDigit, index) => {
    normalized = normalized.replaceAll(thaiDigit, String(index));
  });
  return normalized;
};
