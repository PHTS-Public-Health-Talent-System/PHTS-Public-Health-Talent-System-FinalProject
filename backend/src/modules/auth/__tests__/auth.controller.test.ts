import { describe, expect, jest, test } from "@jest/globals";
import {
  AuthenticationError as HttpAuthenticationError,
  NotFoundError,
} from "@/shared/utils/errors.js";

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  extractRequestInfo: jest.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "jest" }),
}));

jest.mock("@shared/services/tokenBlacklist.js", () => ({
  tokenBlacklist: {
    blacklistToken: jest.fn(),
  },
}));

jest.mock("@/modules/auth/services/auth.service.js", () => ({
  AuthService: {
    login: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
    logout: jest.fn(),
  },
  AuthenticationError: class AuthenticationError extends Error {},
  AccountDisabledError: class AccountDisabledError extends Error {},
  InvalidCitizenIdError: class InvalidCitizenIdError extends Error {},
}));

import { AuthService } from "@/modules/auth/services/auth.service.js";
import { getCurrentUser, updateCurrentUser } from "@/modules/auth/auth.controller.js";

describe("auth controller", () => {
  test("getCurrentUser forwards AuthenticationError when not authenticated", async () => {
    const req: any = { user: undefined };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await getCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(HttpAuthenticationError));
  });

  test("getCurrentUser forwards NotFoundError when user profile missing", async () => {
    const req: any = { user: { userId: 10 } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    (AuthService.getUserProfile as jest.Mock).mockRejectedValue(new Error("User not found"));

    await getCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("updateCurrentUser forwards NotFoundError when employee profile missing", async () => {
    const req: any = { user: { userId: 10 }, body: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    (AuthService.updateUserProfile as jest.Mock).mockRejectedValue(
      new Error("Employee profile not found"),
    );

    await updateCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
