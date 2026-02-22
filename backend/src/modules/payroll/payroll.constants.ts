export type LeaveUnit = "business_days" | "calendar_days";
export type LeaveRuleType = "cumulative" | "per_event";

export const LIFETIME_LICENSE_KEYWORDS: string[] = [
  "นายแพทย์",
  "ผู้อำนวยการเฉพาะด้าน (แพทย์)",
  "ทันตแพทย์",
  "ผู้อำนวยการเฉพาะด้าน (ทันตแพทย์)",
  "เภสัชกร",
  "ผู้อำนวยการเฉพาะด้าน (เภสัชกรรม)",
  "นักเทคนิคการแพทย์",
  "นักรังสีการแพทย์",
  "นักกายภาพบำบัด",
  "นักกิจกรรมบำบัด",
  "นักอาชีวบำบัด",
  "นักจิตวิทยาคลินิก",
  "นักเทคโนโลยีหัวใจ",
  "นักแก้ไขความผิดปกติ",
  "นักวิชาการศึกษาพิเศษ",
  "พยาบาลวิชาชีพ",
];

export const LEAVE_RULES: Record<
  string,
  { limit: number | null; unit: LeaveUnit; rule_type: LeaveRuleType }
> = {
  sick: { limit: 60, unit: "business_days", rule_type: "cumulative" },
  personal: { limit: 45, unit: "business_days", rule_type: "cumulative" },
  vacation: { limit: null, unit: "business_days", rule_type: "cumulative" },
  wife_help: { limit: 15, unit: "business_days", rule_type: "per_event" },
  maternity: { limit: 90, unit: "calendar_days", rule_type: "per_event" },
  ordain: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  military: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  education: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  rehab: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
};
