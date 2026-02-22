export const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจส่วนตัว",
  vacation: "ลาพักผ่อนประจำปี",
  wife_help: "ลาไปช่วยเหลือภริยาที่คลอดบุตร",
  maternity: "ลาคลอดบุตร",
  ordain: "ลาอุปสมบทในพระพุทธศาสนา หรือลาไปประกอบพิธีฮัจย์",
  military: "ลาไปเข้ารับการตรวจเลือก หรือเข้ารับการเตรียมพล",
  education: "ลาไปศึกษา ฝึกอบรม ดูงาน หรือปฏิบัติการวิจัย",
  rehab: "ลาไปฟื้นฟูสมรรถภาพด้านอาชีพ",
};

export const leaveTypes = [
  { value: "sick", label: LEAVE_TYPE_LABELS.sick, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "personal", label: LEAVE_TYPE_LABELS.personal, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "vacation", label: LEAVE_TYPE_LABELS.vacation, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "wife_help", label: LEAVE_TYPE_LABELS.wife_help, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { value: "maternity", label: LEAVE_TYPE_LABELS.maternity, color: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30" },
  { value: "ordain", label: LEAVE_TYPE_LABELS.ordain, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "military", label: LEAVE_TYPE_LABELS.military, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { value: "education", label: LEAVE_TYPE_LABELS.education, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "rehab", label: LEAVE_TYPE_LABELS.rehab, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
];

export const getLeaveTypeLabel = (leaveType: string) => {
  const normalized = String(leaveType ?? "").trim();
  return LEAVE_TYPE_LABELS[normalized] ?? (normalized ? `ลา (${normalized})` : "ลา");
};
