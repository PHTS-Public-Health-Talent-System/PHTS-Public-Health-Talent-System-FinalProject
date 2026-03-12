import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
  },
}));

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
  },
}));

jest.mock("@config/jwt.js", () => ({
  getJwtSecret: jest.fn(() => "test-secret"),
}));

jest.mock("@shared/utils/validationUtils.js", () => ({
  isValidCitizenId: jest.fn(() => true),
}));

jest.mock("@/modules/auth/repositories/auth.repository.js", () => ({
  AuthRepository: {
    findByCitizenId: jest.fn(),
    updateLastLogin: jest.fn(),
    findById: jest.fn(),
    findEmployeeProfileByCitizenId: jest.fn(),
    findLatestLicenseByCitizenId: jest.fn(),
    findHeadScopeRolesByUser: jest.fn(),
  },
}));

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  emitAuditEvent: jest.fn(),
  AuditEventType: {
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
  },
}));

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepository } from "@/modules/auth/repositories/auth.repository.js";
import { AuthService } from "@/modules/auth/services/auth.service.js";

describe("AuthService.login token expiry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_EXPIRES_IN = "7d";

    (AuthRepository.findByCitizenId as jest.Mock).mockResolvedValue({
      user_id: 101,
      citizen_id: "1234567890123",
      role: "HR",
      is_active: true,
      password_hash: "hash",
      last_login_at: null,
    });
    (AuthRepository.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
    (AuthRepository.findById as jest.Mock).mockResolvedValue({
      user_id: 101,
      citizen_id: "1234567890123",
      role: "HR",
      is_active: true,
      last_login_at: null,
    });
    (AuthRepository.findEmployeeProfileByCitizenId as jest.Mock).mockResolvedValue(null);
    (AuthRepository.findLatestLicenseByCitizenId as jest.Mock).mockResolvedValue(null);
    (AuthRepository.findHeadScopeRolesByUser as jest.Mock).mockResolvedValue([]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("signed-token");
  });

  it("always signs JWT with expiresIn option", async () => {
    await AuthService.login("1234567890123", "password");

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 101,
        citizenId: "1234567890123",
        role: "HR",
      }),
      "test-secret",
      { expiresIn: "7d" },
    );

    const twoArgCall = (jwt.sign as jest.Mock).mock.calls.find((call) => call.length === 2);
    expect(twoArgCall).toBeUndefined();
  });
});
