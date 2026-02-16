export const resolveProfessionCode = (positionName: string): string | null => {
  const name = positionName.trim();

  if (name.includes("ทันตแพทย์")) return "DENTIST";
  if (name.startsWith("นักเทคนิคการแพทย์")) return "MED_TECH";
  if (name.startsWith("นักรังสีการแพทย์")) return "RAD_TECH";
  if (name.startsWith("นักกายภาพบำบัด") || name.startsWith("นักกายภาพบําบัด"))
    return "PHYSIO";
  if (name.startsWith("นักกิจกรรมบำบัด") || name.startsWith("นักกิจกรรมบําบัด"))
    return "OCC_THERAPY";
  if (name.startsWith("นักอาชีวบำบัด") || name.startsWith("นักอาชีวบําบัด"))
    return "OCC_THERAPY";
  if (name.startsWith("นักจิตวิทยา")) return "CLIN_PSY";
  if (name.startsWith("นักแก้ไขความผิดปกติ")) return "SPEECH_THERAPIST";
  if (name.startsWith("นักวิชาการศึกษาพิเศษ")) return "SPECIAL_EDU";
  if (name.startsWith("นักเทคโนโลยีหัวใจและทรวงอก")) return "CARDIO_TECH";
  if (name.includes("เภสัชกร")) return "PHARMACIST";
  if (name.includes("พยาบาล")) {
    const excluded = [
      "ผู้ช่วยพยาบาล",
      "พนักงานช่วยการพยาบาล",
      "พนักงานช่วยเหลือคนไข้",
    ];
    if (excluded.some((v) => name.startsWith(v))) return null;
    return "NURSE";
  }
  if (name.includes("นายแพทย์")) return "DOCTOR";
  if (name.includes("แพทย์") && !name.includes("การแพทย์")) return "DOCTOR";
  return null;
};
