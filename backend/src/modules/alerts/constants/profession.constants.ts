export const positionProfessionCaseSql = `
  CASE
    WHEN p.position_name LIKE '%แพทย์%' THEN 'DOCTOR'
    WHEN p.position_name LIKE '%ทันต%' THEN 'DENTIST'
    WHEN p.position_name LIKE '%เภสัช%' THEN 'PHARMACIST'
    WHEN p.position_name LIKE '%พยาบาล%' THEN 'NURSE'
    WHEN p.position_name LIKE '%เทคนิคการแพทย์%' THEN 'MED_TECH'
    WHEN p.position_name LIKE '%รังสี%' THEN 'RAD_TECH'
    WHEN p.position_name LIKE '%กายภาพบำบัด%' THEN 'PHYSIO'
    WHEN p.position_name LIKE '%กิจกรรมบำบัด%' THEN 'OCC_THERAPY'
    WHEN p.position_name LIKE '%จิตวิทยาคลินิก%' THEN 'CLIN_PSY'
    WHEN p.position_name LIKE '%หัวใจและทรวงอก%' THEN 'CARDIO_TECH'
    WHEN p.position_name LIKE '%แก้ไขการพูด%' THEN 'SPEECH_THERAPIST'
    ELSE NULL
  END
`;
