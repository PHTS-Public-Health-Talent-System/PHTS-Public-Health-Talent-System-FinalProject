import { describe, expect, it } from 'vitest';
import { buildStatItems } from './userDashboard.mappers';

const icons = {
  FileText: () => null,
  Clock: () => null,
  CheckCircle2: () => null,
  Bell: () => null,
};

describe('buildStatItems', () => {
  it('maps trend strings from payload', () => {
    const stats = buildStatItems(
      {
        total: 10,
        pending: 3,
        approved: 5,
        unread: 2,
        pending_steps: [2, 4],
        total_trend: '+2 เดือนนี้',
        total_trend_up: true,
        pending_trend: 'Step 2, Step 4',
        pending_trend_up: false,
        approved_trend: 'อนุมัติแล้ว 5 รายการ',
        approved_trend_up: true,
        unread_trend: 'วันนี้ 1 รายการ',
        unread_trend_up: false,
      },
      icons,
    );
    expect(stats[0].trend).toBe('+2 เดือนนี้');
    expect(stats[1].trend).toBe('Step 2, Step 4');
    expect(stats[2].trend).toBe('อนุมัติแล้ว 5 รายการ');
    expect(stats[3].trend).toBe('วันนี้ 1 รายการ');
  });

  it('uses fallback values when missing', () => {
    const stats = buildStatItems(
      {
        total: 0,
        pending: 0,
        approved: 0,
        unread: 0,
        pending_steps: [],
        total_trend: '0 เดือนนี้',
        total_trend_up: false,
        approved_trend: 'อนุมัติแล้ว 0 รายการ',
        approved_trend_up: false,
        unread_trend: 'วันนี้ 0 รายการ',
        unread_trend_up: false,
      },
      icons,
    );
    expect(stats[0].value).toBe('0');
    expect(stats[3].value).toBe('0');
  });
});
