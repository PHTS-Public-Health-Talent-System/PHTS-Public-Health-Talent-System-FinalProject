import { requestController } from '@/modules/request/controllers/request.controller.js';
import { requestQueryService } from '@/modules/request/services/query.service.js';
import * as reassignService from '@/modules/request/reassign/reassign.service.js';

jest.mock('@/modules/request/services/query.service.js', () => ({
  requestQueryService: {
    getRequestById: jest.fn(),
  },
}));

jest.mock('@/modules/request/reassign/reassign.service.js', () => ({
  getReassignmentHistory: jest.fn(),
}));

describe('RequestController.getReassignHistory', () => {
  it('rejects ADMIN from request workflow history endpoint', async () => {
    const req: any = {
      params: { id: '123' },
      user: { userId: 1, role: 'ADMIN' },
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await (requestController.getReassignHistory as any)(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err?.message).toContain('ADMIN');
  });

  it('returns history for non-admin with access', async () => {
    const req: any = {
      params: { id: '123' },
      user: { userId: 10, role: 'PTS_OFFICER' },
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (requestQueryService.getRequestById as jest.Mock).mockResolvedValue({ request_id: 123 });
    (reassignService.getReassignmentHistory as jest.Mock).mockResolvedValue([{ actionId: 1 }]);

    await (requestController.getReassignHistory as any)(req, res, next);

    expect(requestQueryService.getRequestById).toHaveBeenCalledWith(123, 10, 'PTS_OFFICER');
    expect(reassignService.getReassignmentHistory).toHaveBeenCalledWith(123);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ actionId: 1 }] });
  });
});
