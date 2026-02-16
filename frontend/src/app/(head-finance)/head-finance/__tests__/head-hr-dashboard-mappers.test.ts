import { describe, expect, it } from 'vitest';
import { buildHeadFinanceStatItems } from '../head-finance-dashboard-mappers';

const icons = {
  FileCheck: () => null,
  Calculator: () => null,
  CheckCircle2: () => null,
  AlertTriangle: () => null,
};

describe('buildHeadFinanceStatItems', () => {
  it('maps stats to cards', () => {
    const items = buildHeadFinanceStatItems(
      {
        pending_requests: 8,
        pending_payrolls: 2,
        approved_month: 45,
        sla_overdue: 3,
      },
      icons,
    );

    expect(items[0].value).toBe('8');
    expect(items[1].value).toBe('2');
    expect(items[2].value).toBe('45');
    expect(items[3].value).toBe('3');
  });
});
