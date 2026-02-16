import { describe, expect, it } from 'vitest';
import type { RequestWithDetails } from '@/types/request.types';
import type { Announcement } from '@/features/announcement/api';
import {
  buildAnnouncements,
  buildGreeting,
  buildRecentRequests,
  buildStats,
} from './userDashboard.utils';

describe('userDashboard.utils', () => {
  it('buildGreeting uses full name when available', () => {
    const greeting = buildGreeting({ first_name: 'สมชาย', last_name: 'ใจดี' });
    expect(greeting).toContain('สมชาย ใจดี');
  });

  it('buildStats counts pending across all pending statuses', () => {
    const requests = [
      { request_id: 1, status: 'PENDING', current_step: 1 } as RequestWithDetails,
      { request_id: 2, status: 'PENDING_HEAD_DEPT', current_step: 2 } as RequestWithDetails,
      { request_id: 3, status: 'APPROVED', current_step: 6 } as RequestWithDetails,
    ];
    const stats = buildStats(requests, 4);
    expect(stats.pending.value).toBe('2');
    expect(stats.approved.value).toBe('1');
    expect(stats.unread.value).toBe('4');
  });

  it('buildRecentRequests sorts by created_at and maps status label', () => {
    const requests = [
      {
        request_id: 1,
        status: 'PENDING',
        current_step: 1,
        requested_amount: 1500,
        created_at: '2024-08-10T10:00:00.000Z',
        effective_date: '2024-08-01',
      } as RequestWithDetails,
      {
        request_id: 2,
        status: 'APPROVED',
        current_step: 6,
        requested_amount: 8500,
        created_at: '2024-08-20T10:00:00.000Z',
        effective_date: '2024-08-01',
      } as RequestWithDetails,
      {
        request_id: 3,
        status: 'RETURNED',
        current_step: 2,
        requested_amount: 8500,
        created_at: '2024-08-15T10:00:00.000Z',
        effective_date: '2024-08-01',
      } as RequestWithDetails,
    ];

    const recent = buildRecentRequests(requests);
    expect(recent[0].id).toContain('REQ');
    expect(recent[0].requestId).toBe(2);
    expect(recent[0].statusLabel).toBe('อนุมัติแล้ว');
    expect(recent[1].statusLabel).toBe('ส่งกลับแก้ไข');
    expect(recent[2].statusLabel).toBe('รอหัวหน้าตึก/หัวหน้างาน');
  });

  it('buildAnnouncements keeps newest three', () => {
    const announcements: Announcement[] = [
      { id: 1, title: 'A', body: '', priority: 'LOW', is_active: true, created_at: '2024-08-01' },
      { id: 2, title: 'B', body: '', priority: 'HIGH', is_active: true, created_at: '2024-08-03' },
      { id: 3, title: 'C', body: '', priority: 'NORMAL', is_active: true, created_at: '2024-08-02' },
      { id: 4, title: 'D', body: '', priority: 'LOW', is_active: true, created_at: '2024-08-04' },
    ];
    const result = buildAnnouncements(announcements);
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('D');
  });
});
