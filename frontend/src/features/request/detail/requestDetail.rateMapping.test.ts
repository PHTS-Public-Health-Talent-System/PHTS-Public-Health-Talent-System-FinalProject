import { describe, expect, it } from 'vitest';
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from './requestDetail.rateMapping';

const hierarchy = [
  {
    id: 'PHARMACIST',
    name: 'กลุ่มเภสัชกร',
    groups: [
      {
        id: '1',
        name: 'กลุ่มที่ 1',
        rate: 1500,
        criteria: [
          {
            id: '',
            label: 'ปฏิบัติหน้าที่หลักตามมาตรฐานกำหนดตำแหน่ง',
            description: 'ปฏิบัติหน้าที่หลักของตำแหน่งที่ได้รับแต่งตั้ง ตามที่ ก.พ. กำหนดไว้ในมาตรฐานกำหนดตำแหน่ง',
            subCriteria: [
              { id: 'item1-1', label: 'ข้อย่อย 1' },
            ],
          },
        ],
      },
    ],
  },
];

describe('request detail rate mapping helpers', () => {
  it('normalizes rate_mapping from submission_data', () => {
    const mapping = normalizeRateMapping({
      rate_mapping: {
        groupId: '1',
        itemId: '__NONE__',
        subItemId: '',
        amount: '1500.00',
        professionCode: 'PHARMACIST',
      },
    });

    expect(mapping?.groupId).toBe('1');
    expect(mapping?.itemId).toBe('__NONE__');
    expect(mapping?.amount).toBe(1500);
    expect(mapping?.professionCode).toBe('PHARMACIST');
  });

  it('falls back to camelCase rateMapping', () => {
    const mapping = normalizeRateMapping({
      rateMapping: {
        group_no: 2,
        item_no: 'item2',
        amount: 1200,
        profession_code: 'NURSE',
      },
    });

    expect(mapping?.groupId).toBe('2');
    expect(mapping?.itemId).toBe('item2');
    expect(mapping?.professionCode).toBe('NURSE');
  });

  it('resolves labels using hierarchy data', () => {
    const display = resolveRateMappingDisplay(
      {
        groupId: '1',
        itemId: '__NONE__',
        subItemId: 'item1-1',
        professionCode: 'PHARMACIST',
        amount: 1500,
      },
      hierarchy,
    );

    expect(display.professionLabel).toBe('กลุ่มเภสัชกร');
    expect(display.groupLabel).toBe('กลุ่มที่ 1');
    expect(display.criteriaLabel).toBe(
      'ปฏิบัติหน้าที่หลักของตำแหน่งที่ได้รับแต่งตั้ง ตามที่ ก.พ. กำหนดไว้ในมาตรฐานกำหนดตำแหน่ง',
    );
    expect(display.subCriteriaLabel).toBe('ข้อย่อย 1');
  });

  it('falls back to raw ids when hierarchy missing', () => {
    const display = resolveRateMappingDisplay(
      {
        groupId: '1',
        itemId: 'item1',
        subItemId: 'item1-1',
        professionCode: 'PHARMACIST',
        amount: 1500,
      },
      undefined,
    );

    expect(display.professionLabel).toBe('PHARMACIST');
    expect(display.groupLabel).toBe('1');
    expect(display.criteriaLabel).toBe('item1');
    expect(display.subCriteriaLabel).toBe('item1-1');
  });

  it('detects empty rate mapping', () => {
    expect(isEmptyRateMapping({ amount: 0 })).toBe(true);
    expect(isEmptyRateMapping({ groupId: '1', amount: 0 })).toBe(false);
  });
});
