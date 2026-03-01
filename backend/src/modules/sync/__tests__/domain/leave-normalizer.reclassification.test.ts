import type { RowDataPacket } from 'mysql2/promise';
import {
  isValidCitizenId,
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
      name: 'trusted maternity leave stays maternity despite surgery wording',
      input: {
        hrms_leave_type: 'ลาคลอด',
        remark: 'ผ่าตัดรังไข่และพักฟื้น',
        sex: 'หญิง',
        duration_days: 5,
      },
      expectedType: 'maternity',
      expectedReason: null,
      expectedOriginalType: null,
    },
    {
      name: 'trusted personal leave stays personal despite sickness wording',
      input: {
        hrms_leave_type: 'ลากิจฉุกเฉิน',
        remark: 'อุบัติเหตุรถชน ต้องนอนโรงพยาบาล',
        sex: 'หญิง',
        duration_days: 2,
      },
      expectedType: 'personal',
      expectedReason: null,
      expectedOriginalType: null,
    },
    {
      name: 'trusted vacation leave stays vacation despite sickness wording',
      input: {
        hrms_leave_type: 'ลาพักผ่อน',
        remark: 'ไม่สบาย มีไข้สูง',
        sex: 'หญิง',
        duration_days: 1,
      },
      expectedType: 'vacation',
      expectedReason: null,
      expectedOriginalType: null,
    },
    {
      name: 'trusted sick leave stays sick despite family-care wording',
      input: {
        hrms_leave_type: 'ลาป่วย',
        remark: 'พาแม่ไปหาหมอ เนื่องจากแม่ป่วย',
        sex: 'หญิง',
        duration_days: 1,
      },
      expectedType: 'sick',
      expectedReason: null,
      expectedOriginalType: null,
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
    if (!expectedReason) {
      expect(result.meta).toBeNull();
      return;
    }
    expect(result.meta).toMatchObject({
      original_type: expectedOriginalType,
      normalized_type: expectedType,
      reason_code: expectedReason,
    });
  });

  test('trusted maternity leave stays maternity for family hospital care remark', () => {
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
    expect(result.row.leave_type).toBe('maternity');
    expect(result.meta).toBeNull();
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
    expect(result.normalizationIssues).toEqual([]);
    expect(result.reviewMeta).toBeNull();
  });

  test('wife-help override uses explicit childbirth remark only', () => {
    const row = {
      ref_id: 'LM2025060013',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจ',
      start_date: '2025-06-01',
      end_date: '2025-06-03',
      duration_days: 3,
      remark: 'ลาช่วยภริยาเลี้ยงดูบุตร',
      sex: 'ชาย',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('wife_help');
    expect(result.meta).toMatchObject({
      original_type: 'personal',
      normalized_type: 'wife_help',
      reason_code: 'WIFE_HELP_PATTERN',
    });
  });

  test('sick leave with family-care remark is flagged for review without changing type', () => {
    const row = {
      ref_id: 'LM2025060107',
      citizen_id: '1539900059640',
      hrms_leave_type: 'ลาป่วย',
      start_date: '2025-06-02',
      end_date: '2025-06-02',
      duration_days: 1,
      remark: 'พาพ่อไปหาหมอ',
      sex: 'หญิง',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.leave_type).toBe('sick');
    expect(result.meta).toBeNull();
    expect(result.normalizationIssues).toEqual([]);
    expect(result.reviewMeta).toMatchObject({
      source_type: 'sick',
      suspected_type: 'personal',
      reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
    });
  });

  test('emits normalization issue when suspicious future year is corrected', () => {
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
    expect(result.normalizationIssues).toContainEqual(
      expect.objectContaining({
        issue_code: 'LEAVE_DATE_NORMALIZED',
      }),
    );
  });

  test('does not emit normalization issue for already-valid Date objects from mysql', () => {
    const row = {
      ref_id: 'LM2023070002',
      citizen_id: '1539900084717',
      hrms_leave_type: 'ลากิจ',
      start_date: new Date('2024-07-08T00:00:00+07:00'),
      end_date: new Date('2024-07-08T00:00:00+07:00'),
      duration_days: 1,
      remark: 'พาแม่หาหมอ',
      source_type: 'LEAVE',
      status: 'approved',
    } as unknown as RowDataPacket;

    const result = normalizeLeaveRowWithMeta(row);
    expect(result.row.start_date).toBe('2024-07-08');
    expect(result.row.end_date).toBe('2024-07-08');
    expect(result.normalizationIssues).toEqual([]);
  });

  test('emits normalization issue when leave dates are invalid', () => {
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
    expect(result.normalizationIssues).toContainEqual(
      expect.objectContaining({
        issue_code: 'LEAVE_DATE_INVALID',
      }),
    );
  });

  test('citizen helper handles empty and invalid length', () => {
    expect(isValidCitizenId('')).toBe(false);
    expect(isValidCitizenId('123')).toBe(false);
  });
});
