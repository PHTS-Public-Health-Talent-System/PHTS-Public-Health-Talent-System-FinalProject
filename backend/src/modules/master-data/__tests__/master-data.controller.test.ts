import { describe, expect, jest, test } from "@jest/globals";
import { AuthorizationError } from "@/shared/utils/errors.js";

jest.mock("@/modules/master-data/services/rate.service.js", () => ({
  getRatesByProfession: jest.fn(),
}));

jest.mock("@/modules/request/data/repositories/request.repository.js", () => ({
  requestRepository: {
    findEmployeeProfile: jest.fn(),
  },
}));

jest.mock("@/shared/utils/profession.js", () => ({
  resolveProfessionCode: jest.fn(),
}));

import * as rateService from "@/modules/master-data/services/rate.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { resolveProfessionCode } from "@/shared/utils/profession.js";
import { getRatesByProfession } from "@/modules/master-data/master-data.controller.js";

describe("master-data controller", () => {
  test("getRatesByProfession returns AuthorizationError for mismatched profession", async () => {
    const req: any = {
      params: { professionCode: "DOCTOR" },
      user: { role: "NURSE", citizenId: "1234567890123" },
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (requestRepository.findEmployeeProfile as jest.Mock).mockResolvedValue({
      position_name: "Nurse",
    });
    (resolveProfessionCode as jest.Mock).mockReturnValue("NURSE");

    await getRatesByProfession(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rateService.getRatesByProfession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});
