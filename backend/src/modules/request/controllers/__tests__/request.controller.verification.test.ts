import { requestController } from '@/modules/request/controllers/request.controller.js';
import { requestCommandService } from '@/modules/request/services/command.service.js';

jest.mock('@/modules/request/services/command.service.js', () => ({
  requestCommandService: {
    updateVerificationChecks: jest.fn(),
  },
}));

describe('RequestController.updateVerificationChecks', () => {
  it('calls command service and returns updated request payload', async () => {
    const req: any = {
      params: { id: '42' },
      body: {
        qualification_check: { passed: true },
        evidence_check: { passed: true },
      },
      user: { userId: 10, role: 'PTS_OFFICER' },
    };

    const res: any = {
      json: jest.fn(),
    };

    (requestCommandService.updateVerificationChecks as jest.Mock).mockResolvedValue({
      request_id: 42,
      status: 'PENDING',
    });

    const next = jest.fn();

    await (requestController.updateVerificationChecks as any)(req, res, next);

    expect(requestCommandService.updateVerificationChecks).toHaveBeenCalledWith(
      42,
      10,
      'PTS_OFFICER',
      req.body,
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { request_id: 42, status: 'PENDING' },
    });
  });
});
