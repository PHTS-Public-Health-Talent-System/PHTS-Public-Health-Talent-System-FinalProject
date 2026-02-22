import type { RowDataPacket } from 'mysql2/promise';

const HALF_DAY_LABELS = new Set(['ครึ่งวัน', 'ครึ่งวัน - เช้า', 'ครึ่งวัน - บ่าย']);
const MALE_SET = new Set(['ชาย', 'm', 'M']);

const toDateOnly = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const text = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!m) return null;
  let year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year > 2400) year -= 543;
  return new Date(Date.UTC(year, month - 1, day));
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
  const patterns = [
    /ธุรกรรม|ธุรกิจ|ภารกิจ|ธุระ|ติดต่อ|สัมภาษณ์|งานแต่ง|งานศพ|ญาติเสีย|กลับบ้าน|ต่างจังหวัด|ที่ดิน|ธนาคาร|สหกรณ์|แก้บน|ไปเที่ยว|ดูงาน|สอบ|ย้ายสำมะโนครัว/,
    /(ลูก|บุตร|บิดา|มารดา|พ่อ|แม่|สามี|ภรรยา|แฟน|ญาติ|พี่|น้อง|ยาย|ตา|ปู่|ย่า).*(ป่วย|ผ่าตัด|admit|ไม่สบาย|อุบัติเหตุ|ไข้|ตัวร้อน|รักษา)/,
    /(เฝ้า|ดูแล|ติดตาม|พา.*ไป|ส่ง.*ไป|เยี่ยม).*(บิดา|มารดา|พ่อ|แม่|ลูก|บุตร|สามี|ภรรยา|แฟน|ญาติ)/,
  ];
  return patterns.some((pattern) => pattern.test(remarkLower));
};

const isSickMaternity = (remarkLower: string): boolean => {
  const hardSick = /แท้ง|ยุติการตั้งครรภ์|เสียชีวิตในครรภ์|ขูดมดลูก|ไม่มีตัวอ่อน|ตั้งครรภ์นอกมดลูก|ectopic/;
  if (hardSick.test(remarkLower)) return true;

  const surgery = /(ผ่าตัด|surgery|operation|ส่องกล้อง|เลเซอร์|ตัด.*ออก|biopsy)/;
  const surgeryTarget =
    /(มดลูก|รังไข่|เต้านม|breast|ปากมดลูก|เนื้องอก|ซีส|cyst|ไทรอยด์|เข่า|ไหล่|หลัง|กระดูก|นิ้ว|ไส้ติ่ง|ไส้เลื่อน|ถุงน้ำดี|ต้อ|ริดสีดวง|ทอนซิล|สมอง|เส้นเอ็น|ข้อเท้า|ข้อมือ|กระเพาะ|ลำไส้|หู|ฝี|หนอง|นิ่ว|ฟันคุด|ก้อนเนื้อ|ตา|จมูก|คอ|ระบายน้ำ|ใส่สาย|ท่อน้ำตา)/;
  const birthSurgery = /(ผ่าตัดคลอด|ผ่าคลอด|คลอดบุตร|ทำคลอด)/;
  if (surgery.test(remarkLower) && surgeryTarget.test(remarkLower) && !birthSurgery.test(remarkLower)) {
    return true;
  }

  const sickGeneral =
    /(มะเร็ง|cancer|ca\.|myoma|เยื่อบุโพรงมดลูก|อุบัติเหตุ|รถชน|กระดูกหัก|ไข้เลือดออก|โควิด|covid|flu|บ้านหมุน|เวียนศีรษะ|ปวดหัว|ท้องเสีย|อาหารเป็นพิษ|นิ้วล็อค|เลือดออกในสมอง|หัวใจเต้น|ความดันโลหิตสูง|ต่อมบาร์โธลิน|อักเสบ|ติดเชื้อ)/;
  const pregnancyWords = /(ครรภ์|ท้อง|คลอด|แพ้ท้อง|ครรภ์เป็นพิษ|เตรียมคลอด)/;
  return sickGeneral.test(remarkLower) && !pregnancyWords.test(remarkLower);
};

const classifyLeaveType = (input: {
  hrmsLeaveType: string;
  remark: string;
  sex?: string | null;
  durationDays: number;
}): string => {
  const t = input.hrmsLeaveType.trim();
  const remarkLower = input.remark.toLowerCase();
  const isMale = MALE_SET.has(String(input.sex ?? '').trim());

  if (['ลาป่วย', 'sick'].includes(t)) return 'sick';
  if (['ลาพักผ่อน', 'vacation'].includes(t)) return 'vacation';
  if (['ลากิจ', 'ลากิจฉุกเฉิน', 'personal', 'business'].includes(t)) return 'personal';
  if (['ลาบวช', 'ลาอุปสมบท', 'ordain'].includes(t)) return 'ordain';
  if (t === 'education') return 'education';

  if (['ลาคลอด', 'maternity'].includes(t)) {
    const wifeHelpRegex = /(ภริยา|ภรรยา|เมีย|คู่สมรส).*(คลอด|เลี้ยงดู|ดูแล|เฝ้าไข้)/;
    if (isMale && wifeHelpRegex.test(remarkLower)) return 'wife_help';
    if (input.durationDays >= 60) return 'maternity';
    if (isPersonalMaternity(remarkLower)) return 'personal';
    if (isSickMaternity(remarkLower)) return 'sick';
    return 'maternity';
  }

  return 'personal';
};

export const normalizeLeaveRow = (row: RowDataPacket): RowDataPacket => {
  const start = toDateOnly(row.start_date);
  const end = toDateOnly(row.end_date);
  const normalizedStart = start && end ? new Date(Math.min(start.getTime(), end.getTime())) : start ?? end;
  const normalizedEnd = start && end ? new Date(Math.max(start.getTime(), end.getTime())) : end ?? start;

  const sourceType = String(row.source_type ?? 'LEAVE');
  const halfDay = Number(row.half_day ?? 0) === 1;
  const endDateDetail = String(row.end_date_detail ?? '');
  const singleDay = normalizedStart && normalizedEnd && normalizedStart.getTime() === normalizedEnd.getTime();
  const rawDuration = diffDaysInclusive(normalizedStart, normalizedEnd);
  const durationDays =
    sourceType === 'LEAVE' && (halfDay || (singleDay && HALF_DAY_LABELS.has(endDateDetail)))
      ? 0.5
      : Number((row.duration_days ?? rawDuration) || 0);

  const remark = String(row.remark ?? '');
  const leaveType = classifyLeaveType({
    hrmsLeaveType: String(row.hrms_leave_type ?? row.leave_type ?? ''),
    remark,
    sex: row.sex as string | null,
    durationDays,
  });

  return {
    ref_id: String(row.ref_id ?? ''),
    citizen_id: String(row.citizen_id ?? ''),
    leave_type: leaveType,
    start_date: toDateString(normalizedStart),
    end_date: toDateString(normalizedEnd),
    duration_days: durationDays,
    fiscal_year: fiscalYearFromDate(normalizedStart),
    remark,
    status: String(row.status ?? 'approved'),
  } as RowDataPacket;
};
