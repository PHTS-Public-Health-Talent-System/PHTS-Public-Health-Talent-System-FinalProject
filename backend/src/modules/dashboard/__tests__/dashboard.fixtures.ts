import { RequestStatus } from '@/modules/request/contracts/request.types.js';

export const makePendingRequestRow = (overrides: Record<string, unknown> = {}) =>
  ({
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
    ...overrides,
  }) as any;

export const makeUserRequestRow = (overrides: Record<string, unknown> = {}) =>
  ({
    request_id: 1,
    status: RequestStatus.PENDING,
    current_step: 1,
    requested_amount: 1500,
    created_at: '2024-08-20T00:00:00.000Z',
    effective_date: '2024-08-01',
    ...overrides,
  }) as any;

export const makeAnnouncement = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    title: 'A',
    priority: 'LOW',
    created_at: '2024-08-01',
    ...overrides,
  }) as any;
