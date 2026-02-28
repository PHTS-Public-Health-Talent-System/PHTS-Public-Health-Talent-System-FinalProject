import type { RowDataPacket } from 'mysql2/promise';
import {
  isValidCitizenId,
  normalizeCitizenId,
  normalizeLeaveRowWithMeta,
} from '@/modules/sync/services/domain/leave-normalizer.service.js';

describe('leave normalizer reclassification metadata', () => {
  test.each([
    {
      name: 'male spouse childbirth becomes wife_help',
      input: {
        hrms_leave_type: 'ลาคลอด',
        remark: 'ภรรยาคลอด ต้องดูแลคู่สมรส',
        sex: 'ชาย',
        duration_days: 3,
      },
      expectedType: 'wife_help',
      expectedReason: 'MATERNITY_WIFE_HELP_PATTERN',
      expectedOriginalType: 'maternity',
    },
    {
      name: 'male childcare remark becomes wife_help without spouse keyword',
      input: {
        hrms_leave_type: 'ลาคลอด',
        remark: 'ลาเพื่อเลี้ยงดูบุตรที่พึ่งคลอดครับ',
        sex: 'm',
        duration_days: 4,
      },
      expectedType: 'wife_help',
      expectedReason: 'MATERNITY_WIFE_HELP_PATTERN',
      expectedOriginalType: 'maternity',
    },
    {
      name: 'male personal leave with spouse childbirth remark becomes wife_help',
      input: {
        hrms_leave_type: 'ลากิจ',
        remark: 'ลาช่วยภริยาเลี้ยงดูบุตร',
        sex: 'ชาย',
        duration_days: 5,
      },
      expectedType: 'wife_help',
      expectedReason: 'WIFE_HELP_PATTERN',
      expectedOriginalType: 'personal',
    },
    {
      name: 'surgery remark becomes sick',
      input: {
        hrms_leave_type: 'ลาคลอด',
        remark: 'ผ่าตัดรังไข่และพักฟื้น',
        sex: 'หญิง',
        duration_days: 5,
      },
      expectedType: 'sick',
      expectedReason: 'MATERNITY_SICK_PATTERN',
      expectedOriginalType: 'maternity',
    },
    {
      name: 'personal leave with direct sickness remark becomes sick',
      input: {
        hrms_leave_type: 'ลากิจฉุกเฉิน',
        remark: 'อุบัติเหตุรถชน ต้องนอนโรงพยาบาล',
        sex: 'หญิง',
        duration_days: 2,
      },
      expectedType: 'sick',
      expectedReason: 'SICK_PATTERN',
      expectedOriginalType: 'personal',
    },
    {
      name: 'vacation leave with direct sickness remark becomes sick',
      input: {
        hrms_leave_type: 'ลาพักผ่อน',
        remark: 'ไม่สบาย มีไข้สูง',
        sex: 'หญิง',
        duration_days: 1,
      },
      expectedType: 'sick',
      expectedReason: 'SICK_PATTERN',
      expectedOriginalType: 'vacation',
    },
    {
      name: 'sick leave with family-care remark becomes personal',
      input: {
        hrms_leave_type: 'ลาป่วย',
        remark: 'พาแม่ไปหาหมอ เนื่องจากแม่ป่วย',
        sex: 'หญิง',
        duration_days: 1,
      },
      expectedType: 'personal',
      expectedReason: 'SICK_FAMILY_CARE_PATTERN',
      expectedOriginalType: 'sick',
    },
  ])('$name', ({ input, expectedType, expectedReason, expectedOriginalType }) => {
    const row = {
      ref_id: 'LM2025050009',
      citizen_id: '3530800368452',
      start_date: '2025-05-01',
      end_date: '2025-05-05',
      source_type: 'LEAVE',
      status: 'approved',
      ...input,
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe(expectedType);
    expect(result.meta).toMatchObject({
      original_type: expectedOriginalType,
      normalized_type: expectedType,
      reason_code: expectedReason,
    });
  });

  test('reclassifies maternity to personal for family hospital care remark', () => {
    const row = {
      ref_id: 'LM2025040001',
      citizen_id: '3530800368452',
      hrms_leave_type: 'ลาคลอด',
      start_date: '2025-04-01',
      end_date: '2025-04-02',
      duration_days: 2,
      remark: 'พาพ่อมารักษาในโรงพยาบาลอุตรดิตถ์',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('personal');
    expect(result.meta).toMatchObject({
      original_type: 'maternity',
      normalized_type: 'personal',
      reason_code: 'MATERNITY_PERSONAL_PATTERN',
    });
  });

  test('keeps maternity when remark is empty', () => {
    const row = {
      ref_id: 'LM2025020011',
      citizen_id: '1539900631432',
      hrms_leave_type: 'ลาคลอด',
      start_date: '2025-02-26',
      end_date: '2025-02-27',
      duration_days: 2,
      remark: '',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('maternity');
    expect(result.meta).toBeNull();
  });

  test('normalizes citizen id to only digits', () => {
    const row = {
      ref_id: 'LM2025060001',
      citizen_id: '153-990-008-4717',
      hrms_leave_type: 'ลาป่วย',
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      duration_days: 1,
      remark: 'ไข้',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.citizen_id).toBe('1539900084717');
    expect(isValidCitizenId(result.row.citizen_id)).toBe(true);
  });

  test('converts suspicious shifted future year (2066 => 2023)', () => {
    const row = {
      ref_id: 'LM2023070001',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจ',
      start_date: '2066-05-16',
      end_date: '2066-05-16',
      duration_days: 1,
      remark: 'พาแม่หาหมอ',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.start_date).toBe('2023-05-16');
    expect(result.row.end_date).toBe('2023-05-16');
    expect(result.row.fiscal_year).toBe(2566);
  });

  test.each([
    ['2025/06/01', '2025-06-01'],
    ['01/06/2025', '2025-06-01'],
    ['๒๕๖๘-๐๖-๐๑', '2025-06-01'],
  ])('parses date format %s', (inputDate, expectedDate) => {
    const row = {
      ref_id: 'LM2025060099',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลาป่วย',
      start_date: inputDate,
      end_date: inputDate,
      duration_days: 1,
      remark: 'ไข้',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.start_date).toBe(expectedDate);
    expect(result.row.end_date).toBe(expectedDate);
  });

  test('invalid date returns null start/end for caller guard to skip', () => {
    const row = {
      ref_id: 'LM2025000000',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจ',
      start_date: '31/13/2025',
      end_date: '31/13/2025',
      duration_days: 1,
      remark: 'invalid date',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.start_date).toBeNull();
    expect(result.row.end_date).toBeNull();
  });

  test('male spouse sickness remark without childbirth remains personal', () => {
    const row = {
      ref_id: 'LM2025060011',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจฉุกเฉิน',
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      duration_days: 1,
      remark: 'เฝ้าไข้ภรรยา',
      sex: 'ชาย',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('personal');
  });

  test('spouse pregnancy complication remains personal (not wife_help)', () => {
    const row = {
      ref_id: 'LM2025060012',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจฉุกเฉิน',
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      duration_days: 1,
      remark: 'เนื่องจากภรรยา Admit ตั้งครรภ์ มีเลือดออกช่องคลอด',
      sex: 'ชาย',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('personal');
  });

  test('family care remark in vacation stays vacation', () => {
    const row = {
      ref_id: 'LM2025060022',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลาพักผ่อน',
      start_date: '2025-06-02',
      end_date: '2025-06-02',
      duration_days: 1,
      remark: 'พาแม่ไปหาหมอ เพราะแม่ป่วย',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('vacation');
    expect(result.meta).toBeNull();
  });

  test('work medical context in vacation stays vacation', () => {
    const row = {
      ref_id: 'LM2025060033',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลาพักผ่อน',
      start_date: '2025-06-03',
      end_date: '2025-06-03',
      duration_days: 1,
      remark: 'ลาไปประชุมงานผ่าตัด',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('vacation');
    expect(result.meta).toBeNull();
  });

  test('work medical context in personal stays personal', () => {
    const row = {
      ref_id: 'LM2025060034',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจ',
      start_date: '2025-06-03',
      end_date: '2025-06-03',
      duration_days: 1,
      remark: 'เข้าช่วยผ่าตัดผู้ป่วยร่วมกับทีม',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('personal');
    expect(result.meta).toBeNull();
  });

  test('citizen helper handles empty and invalid length', () => {
    expect(normalizeCitizenId('abc-123')).toBe('123');
    expect(isValidCitizenId('')).toBe(false);
    expect(isValidCitizenId('123')).toBe(false);
  });
});
