export const PROFESSION_CODE_ALIASES: Record<string, string> = {
  DOCTOR: "PHYSICIAN",
  RAD_TECH: "RADIOLOGIST",
  PHYSIO: "PHYSICAL_THERAPY",
  OCC_THERAPY: "OCCUPATIONAL_THERAPY",
  CLIN_PSY: "CLINICAL_PSYCHOLOGIST",
  CARDIO_TECH: "CARDIO_THORACIC_TECH",
};

export const PROFESSION_LABELS: Record<string, string> = {
  PHYSICIAN: "แพทย์",
  DENTIST: "ทันตแพทย์",
  PHARMACIST: "เภสัชกร",
  NURSE: "พยาบาลวิชาชีพ",
  MED_TECH: "นักเทคนิคการแพทย์",
  RADIOLOGIST: "นักรังสีการแพทย์",
  PHYSICAL_THERAPY: "นักกายภาพบำบัด",
  OCCUPATIONAL_THERAPY: "นักกิจกรรมบำบัด",
  CLINICAL_PSYCHOLOGIST: "นักจิตวิทยาคลินิก",
  CARDIO_THORACIC_TECH: "นักเทคโนโลยีหัวใจและทรวงอก",
  SPEECH_THERAPIST: "นักแก้ไขการพูด",
  ALLIED: "สหวิชาชีพ",
  SPECIAL_EDU: "การศึกษาพิเศษ",
};

export function normalizeProfessionCode(value?: string | null): string {
  if (!value) return "UNKNOWN";
  const upper = value.toUpperCase();
  return PROFESSION_CODE_ALIASES[upper] ?? upper;
}

export function resolveProfessionLabel(value?: string | null, fallback = "-"): string {
  if (!value) return fallback;
  const normalized = normalizeProfessionCode(value);
  return PROFESSION_LABELS[normalized] ?? normalized;
}
