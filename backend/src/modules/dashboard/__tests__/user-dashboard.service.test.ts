import { buildUserDashboard } from '@/modules/dashboard/services/user-dashboard.service.js';
import { RequestStatus } from '@/modules/request/contracts/request.types.js';

describe('buildUserDashboard', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-09T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts pending across all pending statuses and collects step list', () => {
    const result = buildUserDashboard({
      requests: [
        {
          request_id: 1,
          status: RequestStatus.PENDING,
          current_step: 1,
          requested_amount: 1500,
          created_at: '2024-08-20T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
        {
          request_id: 2,
          status: RequestStatus.PENDING,
          current_step: 2,
          requested_amount: 1500,
          created_at: '2024-08-21T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
        {
          request_id: 3,
          status: RequestStatus.APPROVED,
          current_step: 6,
          requested_amount: 1500,
          created_at: '2024-08-22T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
      ],
      unreadCount: 4,
      unreadToday: 2,
      announcements: [],
    });

    expect(result.stats.pending).toBe(2);
    expect(result.stats.pending_steps).toEqual([1, 2]);
    expect(result.stats.approved).toBe(1);
    expect(result.stats.unread).toBe(4);
    expect(result.stats.total_trend).toBe('0 เดือนนี้');
    expect(result.stats.pending_trend).toBe('Step 1, Step 2');
    expect(result.stats.approved_trend).toBe('อนุมัติแล้ว 1 รายการ');
    expect(result.stats.unread_trend).toBe('วันนี้ 2 รายการ');
  });

  it('builds recent requests sorted by created_at desc with formatted labels', () => {
    const result = buildUserDashboard({
      requests: [
        {
          request_id: 1,
          status: RequestStatus.PENDING,
          current_step: 1,
          requested_amount: 8500,
          created_at: '2024-08-10T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
        {
          request_id: 2,
          status: RequestStatus.APPROVED,
          current_step: 6,
          requested_amount: 8500,
          created_at: '2024-08-20T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
        {
          request_id: 3,
          status: RequestStatus.RETURNED,
          current_step: 2,
          requested_amount: 8200,
          created_at: '2024-08-15T00:00:00.000Z',
          effective_date: '2024-08-01',
        } as any,
      ],
      unreadCount: 0,
      unreadToday: 0,
      announcements: [],
    });

    expect(result.recent_requests[0].request_id).toBe(2);
    expect(result.recent_requests[0].status_label).toBe('อนุมัติแล้ว');
    expect(result.recent_requests[1].status_label).toBe('ส่งกลับแก้ไข');
    expect(result.recent_requests[2].status_label).toBe('รอหัวหน้าตึก/หัวหน้างาน');
  });

  it('limits announcements to latest 3 and formats date', () => {
    const result = buildUserDashboard({
      requests: [
        {
          request_id: 4,
          status: RequestStatus.PENDING,
          current_step: 1,
          requested_amount: 1500,
          created_at: '2026-02-01T00:00:00.000Z',
          effective_date: '2026-02-01',
        } as any,
        {
          request_id: 5,
          status: RequestStatus.PENDING,
          current_step: 2,
          requested_amount: 1500,
          created_at: '2026-02-05T00:00:00.000Z',
          effective_date: '2026-02-01',
        } as any,
      ],
      unreadCount: 0,
      unreadToday: 0,
      announcements: [
        { id: 1, title: 'A', priority: 'LOW', created_at: '2024-08-01' } as any,
        { id: 2, title: 'B', priority: 'HIGH', created_at: '2024-08-03' } as any,
        { id: 3, title: 'C', priority: 'NORMAL', created_at: '2024-08-02' } as any,
        { id: 4, title: 'D', priority: 'LOW', created_at: '2024-08-04' } as any,
      ],
    });

    expect(result.announcements).toHaveLength(3);
    expect(result.announcements[0].title).toBe('D');
    expect(result.stats.total_trend).toBe('+2 เดือนนี้');
    expect(result.stats.pending_trend).toBe('Step 1, Step 2');
  });
});
