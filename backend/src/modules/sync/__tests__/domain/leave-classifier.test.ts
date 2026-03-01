import {
  buildLeaveReviewMeta,
  buildReclassificationMeta,
  classifyLeaveType,
  hasFamilyCareContext,
  hasWifeHelpSignal,
  shouldClassifyAsSick,
} from '@/modules/sync/services/domain/leave-classifier.js';

describe('leave classifier', () => {
  test('detects wife-help signal from spouse childbirth remark', () => {
    expect(hasWifeHelpSignal('ภรรยาคลอด ต้องช่วยเลี้ยงดูบุตร')).toBe(true);
  });

  test('detects family care context from escorting a parent to hospital', () => {
    expect(hasFamilyCareContext('พาแม่ไปหาหมอ เนื่องจากแม่ป่วย')).toBe(true);
  });

  test('does not override trusted personal leave type from sickness wording alone', () => {
    expect(shouldClassifyAsSick('ผมไม่สบาย มีไข้สูงและต้องพักรักษาตัว')).toBe(true);
    expect(
      classifyLeaveType({
        hrmsLeaveType: 'ลากิจ',
        remark: 'ผมไม่สบาย มีไข้สูงและต้องพักรักษาตัว',
        sex: 'ชาย',
        durationDays: 1,
      }),
    ).toBe('personal');
  });

  test('does not override trusted sick leave type back to personal from family-care wording', () => {
    expect(
      classifyLeaveType({
        hrmsLeaveType: 'ลาป่วย',
        remark: 'พาแม่ไปหาหมอ เนื่องจากแม่ป่วย',
        sex: 'หญิง',
        durationDays: 1,
      }),
    ).toBe('sick');
  });

  test('wife-help override still applies when childbirth signal is explicit', () => {
    expect(
      classifyLeaveType({
        hrmsLeaveType: 'ลากิจ',
        remark: 'ลาช่วยภริยาเลี้ยงดูบุตร',
        sex: 'ชาย',
        durationDays: 3,
      }),
    ).toBe('wife_help');
  });

  test('builds explicit reclassification metadata for wife_help', () => {
    expect(
      buildReclassificationMeta({
        originalType: 'ลาคลอด',
        normalizedType: 'wife_help',
        remark: 'ภรรยาคลอด ต้องดูแลคู่สมรส',
        sex: 'ชาย',
        durationDays: 3,
      }),
    ).toMatchObject({
      original_type: 'maternity',
      normalized_type: 'wife_help',
      reason_code: 'MATERNITY_WIFE_HELP_PATTERN',
    });
  });

  test('does not classify spouse pregnancy complication as wife_help without childbirth signal', () => {
    expect(
      classifyLeaveType({
        hrmsLeaveType: 'ลากิจฉุกเฉิน',
        remark: 'เนื่องจากภรรยา Admit ตั้งครรภ์ มีเลือดออกช่องคลอด',
        sex: 'ชาย',
        durationDays: 1,
      }),
    ).toBe('personal');
  });

  test('builds review metadata for sick leave that clearly describes family care', () => {
    expect(
      buildLeaveReviewMeta({
        originalType: 'ลาป่วย',
        normalizedType: 'sick',
        remark: 'พาพ่อไปหาหมอ',
        sex: 'หญิง',
      }),
    ).toMatchObject({
      source_type: 'sick',
      suspected_type: 'personal',
      reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
    });
  });

  test('does not build sick review metadata when own symptoms are explicit', () => {
    expect(
      buildLeaveReviewMeta({
        originalType: 'ลาป่วย',
        normalizedType: 'sick',
        remark: 'มึนศรีษะเนื่องจาก อดนอน จากการเฝ้าบิดาที่ป่วยติดเตียง',
        sex: 'หญิง',
      }),
    ).toBeNull();

    expect(
      buildLeaveReviewMeta({
        originalType: 'ลาป่วย',
        normalizedType: 'sick',
        remark: 'ปวดกล้าเนื้อ,ปวดหัว + ดูแลลูกไข้หวัดใหญ่/พามาหาหมอ',
        sex: 'หญิง',
      }),
    ).toBeNull();
  });
});
