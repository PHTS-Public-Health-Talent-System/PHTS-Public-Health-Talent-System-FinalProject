export const positionProfessionCaseSql = `
  CASE
    -- Order matters: some professions contain the word "แพทย์" (e.g. ทันตแพทย์, เทคนิคการแพทย์)
    WHEN p.position_name LIKE '%ทันต%' THEN 'DENTIST'
    WHEN p.position_name LIKE '%เภสัช%' THEN 'PHARMACIST'
    WHEN p.position_name LIKE '%พยาบาล%' THEN 'NURSE'
    WHEN p.position_name LIKE '%เทคนิคการแพทย์%' THEN 'MED_TECH'
    WHEN p.position_name LIKE '%รังสีการแพทย์%' THEN 'RAD_TECH'
    WHEN p.position_name LIKE '%รังสี%' THEN 'RAD_TECH'
    WHEN p.position_name LIKE '%กายภาพบำบัด%' THEN 'PHYSIO'
    WHEN p.position_name LIKE '%กิจกรรมบำบัด%' THEN 'OCC_THERAPY'
    WHEN p.position_name LIKE '%จิตวิทยาคลินิก%' THEN 'CLIN_PSY'
    WHEN p.position_name LIKE '%หัวใจและทรวงอก%' THEN 'CARDIO_TECH'
    WHEN p.position_name LIKE '%แก้ไขการพูด%' THEN 'SPEECH_THERAPIST'
    -- Doctor: match common titles, avoid generic "%แพทย์%" which misclassifies other professions.
    WHEN p.position_name LIKE 'นายแพทย์%' THEN 'DOCTOR'
    WHEN p.position_name LIKE 'แพทย์หญิง%' THEN 'DOCTOR'
    WHEN p.position_name LIKE '%(แพทย์)%' THEN 'DOCTOR'
    WHEN p.position_name = 'แพทย์' THEN 'DOCTOR'
    ELSE NULL
  END
`;
