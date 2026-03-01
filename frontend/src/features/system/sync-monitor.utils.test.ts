import { describe, expect, it } from 'vitest';
import type { DataIssueRecord } from '@/features/system/shared';
import { buildLeaveIssueSummary, formatIssueDetailText } from '@/features/system/sync-monitor';

const buildIssue = (
  overrides: Partial<DataIssueRecord> & Pick<DataIssueRecord, 'issue_code'>,
): DataIssueRecord => ({
  issue_id: 1,
  batch_id: 131,
  target_table: 'leave_records',
  source_key: '95132',
  issue_detail: null,
  severity: 'LOW',
  created_at: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

describe('formatIssueDetailText', () => {
  it('formats wife_help reclassification issues in Thai', () => {
    const text = formatIssueDetailText(
      'LEAVE_TYPE_RECLASSIFIED',
      JSON.stringify({
        citizen_id: '1234567890123',
        original_type: 'personal',
        normalized_type: 'wife_help',
        reason_code: 'WIFE_HELP_PATTERN',
        remark: 'ลาช่วยภริยาเลี้ยงดูบุตร',
      }),
    );

    expect(text).toContain('บัตรประชาชน: 1234567890123');
    expect(text).toContain('ปรับประเภท: ลากิจ -> ลาช่วยภริยาเลี้ยงดูบุตร');
    expect(text).toContain('เหตุผล: ตรวจพบบริบทช่วยภริยาคลอด/เลี้ยงดูบุตร');
    expect(text).toContain('ข้อความการลาจากต้นทาง: ลาช่วยภริยาเลี้ยงดูบุตร');
  });

  it('formats sick family-care review issues without pretending the type changed', () => {
    const text = formatIssueDetailText(
      'SICK_LEAVE_FAMILY_CARE_REVIEW',
      JSON.stringify({
        citizen_id: '1234567890123',
        leave_type: 'sick',
        reason_text:
          'ข้อความการลามีบริบทเป็นการดูแลบุคคลอื่น แม้ประเภทการลาจาก HRMS จะเป็นลาป่วย',
        remark: 'ลูกป่วย',
      }),
    );

    expect(text).toContain('ประเภทการลาจาก HRMS: ลาป่วย');
    expect(text).toContain(
      'ข้อสังเกต: ข้อความการลามีบริบทเป็นการดูแลบุคคลอื่น แม้ประเภทการลาจาก HRMS จะเป็นลาป่วย',
    );
    expect(text).toContain('ข้อความการลาจากต้นทาง: ลูกป่วย');
    expect(text).not.toContain('ปรับประเภท:');
  });

  it('formats date normalization issues in Thai', () => {
    const text = formatIssueDetailText(
      'LEAVE_DATE_NORMALIZED',
      JSON.stringify({
        citizen_id: '1234567890123',
        reason_text: 'ระบบปรับรูปแบบหรือแก้ไขวันที่ลาให้เป็นค่าที่ใช้งานได้',
        original_start_date: '32/13/2568',
        normalized_start_date: '2025-12-32',
      }),
    );

    expect(text).toContain('บัตรประชาชน: 1234567890123');
    expect(text).toContain('ข้อสังเกต: ระบบปรับรูปแบบหรือแก้ไขวันที่ลาให้เป็นค่าที่ใช้งานได้');
    expect(text).toContain('วันที่ลาเดิม: 32/13/2568');
    expect(text).toContain('วันที่ลาหลังปรับ: 2025-12-32');
  });
});

describe('buildLeaveIssueSummary', () => {
  it('summarizes reclassification, review, and date issues separately', () => {
    const summary = buildLeaveIssueSummary([
      buildIssue({
        issue_code: 'LEAVE_TYPE_RECLASSIFIED',
        issue_detail: JSON.stringify({ reason_code: 'WIFE_HELP_PATTERN' }),
      }),
      buildIssue({
        issue_id: 2,
        issue_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
        issue_detail: JSON.stringify({ reason_code: 'SICK_FAMILY_CARE_REVIEW' }),
      }),
      buildIssue({
        issue_id: 3,
        issue_code: 'LEAVE_DATE_NORMALIZED',
        issue_detail: JSON.stringify({ reason_code: 'LEAVE_DATE_NORMALIZED' }),
      }),
      buildIssue({
        issue_id: 4,
        issue_code: 'LEAVE_DATE_INVALID',
        issue_detail: JSON.stringify({ reason_code: 'LEAVE_DATE_INVALID' }),
      }),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.reclassified).toBe(1);
    expect(summary.review).toBe(1);
    expect(summary.dateAdjusted).toBe(1);
    expect(summary.dateInvalid).toBe(1);
    expect(summary.topReasons).toEqual([
      {
        reasonCode: 'WIFE_HELP_PATTERN',
        count: 1,
      },
      {
        reasonCode: 'SICK_FAMILY_CARE_REVIEW',
        count: 1,
      },
      {
        reasonCode: 'LEAVE_DATE_NORMALIZED',
        count: 1,
      },
      {
        reasonCode: 'LEAVE_DATE_INVALID',
        count: 1,
      },
    ]);
  });
});
