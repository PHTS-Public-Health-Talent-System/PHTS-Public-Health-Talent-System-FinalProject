export function getOcrEngineLabel(value?: string | null): string {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "tesseract":
      return "Tesseract";
    case "paddle":
      return "Paddle OCR";
    case "typhoon":
      return "Typhoon OCR";
    case "auto":
      return "เลือกอัตโนมัติ";
    default:
      return value?.trim() || "ไม่ระบุ";
  }
}

export function getOcrDocumentKindLabel(value?: string | null): string {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "memo":
      return "หนังสือนำส่ง";
    case "assignment_order":
      return "คำสั่งมอบหมายงาน";
    case "license":
      return "ใบอนุญาต";
    case "general":
      return "เอกสารทั่วไป";
    default:
      return value?.trim() || "ไม่ระบุ";
  }
}

const OCR_FIELD_LABELS: Record<string, string> = {
  document_no: "เลขที่หนังสือ",
  document_date: "วันที่หนังสือ",
  subject: "เรื่อง",
  department: "หน่วยงาน",
  addressed_to: "เรียน",
  license_no: "เลขที่ใบอนุญาต",
  license_valid_until: "วันหมดอายุใบอนุญาต",
  person_name: "ชื่อบุคลากร",
  order_no: "เลขที่คำสั่ง",
  section_title: "หัวข้องาน",
};

export function getOcrFieldLabel(value?: string | null): string {
  const key = String(value ?? "").trim();
  return OCR_FIELD_LABELS[key] || key || "ไม่ระบุ";
}

export function getOcrQualitySummaryText(value?: {
  required_fields?: number;
  captured_fields?: number;
  passed?: boolean;
} | null): string {
  const required = Number(value?.required_fields ?? 0);
  const captured = Number(value?.captured_fields ?? 0);
  if (required <= 0) return "ไม่มีเกณฑ์ตรวจข้อมูลสำคัญ";
  return `พบข้อมูลสำคัญ ${captured} จาก ${required} รายการ`;
}

export function getOcrFallbackReasonLabel(value?: string | null): string {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "missing_required_fields":
      return "ข้อมูลสำคัญยังไม่ครบ";
    case "invalid_date_format":
      return "รูปแบบวันที่ไม่ชัดเจน";
    case "name_not_matched":
      return "จับคู่ชื่อบุคลากรไม่ได้";
    case "section_not_found":
      return "ไม่พบหัวข้องาน";
    case "document_kind_uncertain":
      return "ยังระบุชนิดเอกสารไม่ได้ชัดเจน";
    default:
      return value?.trim() || "ต้องใช้ OCR ขั้นสูง";
  }
}

export function getOcrFieldEntries(
  fields?: Record<string, unknown> | null,
): Array<[string, string]> {
  if (!fields || typeof fields !== "object") return [];

  return Object.entries(fields).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    const normalized = String(value).trim();
    if (!normalized) return [];
    return [[getOcrFieldLabel(key), normalized]];
  });
}
