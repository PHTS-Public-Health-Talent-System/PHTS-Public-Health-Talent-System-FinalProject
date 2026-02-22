import { buildApproverDashboard } from '@/modules/dashboard/services/approver-dashboard.service.js';

describe('buildApproverDashboard', () => {
  it('maps stats and pending items with SLA status', () => {
    const result = buildApproverDashboard({
      pendingRequests: [
        {
          request_id: 10,
          request_no: 'REQ-2569-010',
          requested_amount: 1500,
          created_at: '2026-02-01T00:00:00.000Z',
          submission_data: JSON.stringify({
            first_name: 'อารยา',
            last_name: 'ชมบ้านแพ้ว',
            position_name: 'เภสัชกร',
            department: 'กลุ่มงานเภสัชกรรม',
            sub_department: 'ห้องจ่ายยาผู้ป่วยใน',
          }),
        } as any,
      ],
      slaInfoByRequest: new Map([
        [10, { status: 'overdue' }],
      ]),
      pendingPayrolls: [
        {
          period_id: 5,
          period_month: 8,
          period_year: 2568,
          total_amount: 120000,
          total_headcount: 50,
          updated_at: '2026-02-02T00:00:00.000Z',
        } as any,
      ],
      approvedMonthCount: 12,
      slaOverdueCount: 3,
    });

    expect(result.stats.pending_requests).toBe(1);
    expect(result.stats.pending_payrolls).toBe(1);
    expect(result.stats.approved_month).toBe(12);
    expect(result.stats.sla_overdue).toBe(3);
    expect(result.pending_requests[0].sla_status).toBe('overdue');
    expect(result.pending_requests[0].name).toBe('อารยา ชมบ้านแพ้ว');
    expect(result.pending_payrolls[0].month).toBe('สิงหาคม 2568');
  });
});
