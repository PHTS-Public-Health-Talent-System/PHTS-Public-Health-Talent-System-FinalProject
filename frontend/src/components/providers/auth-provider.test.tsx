import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider } from "@/components/providers/auth-provider";

const mocked = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  apiGet: vi.fn(),
  pathname: "/login",
  responseUser: {
    id: 999,
    citizen_id: "1000000000999",
    role: "USER",
    first_name: "Default",
    last_name: "User",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocked.replace,
    push: mocked.push,
  }),
  usePathname: () => mocked.pathname,
}));

vi.mock("@/shared/api/axios", () => ({
  default: {
    get: mocked.apiGet,
    post: vi.fn(),
  },
}));

describe("AuthProvider role access guard", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("phts_token", "test-token");
    mocked.responseUser = {
      id: 999,
      citizen_id: "1000000000999",
      role: "USER",
      first_name: "Default",
      last_name: "User",
    };
    mocked.apiGet.mockImplementation(async () => ({
      data: {
        success: true,
        data: mocked.responseUser,
      },
    }));
  });

  it("redirects from /login to role home after restoring HEAD_HR session", async () => {
    mocked.pathname = "/login";
    mocked.responseUser = {
      id: 1,
      citizen_id: "1234567890123",
      role: "HEAD_HR",
      first_name: "Head",
      last_name: "HR",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledWith("/auth/me");
    });
    await waitFor(() => {
      expect(mocked.replace).toHaveBeenCalledWith("/head-hr");
    });
  });

  it("redirects when current path does not match user role root", async () => {
    mocked.pathname = "/user/profile";
    mocked.responseUser = {
      id: 2,
      citizen_id: "1234567890124",
      role: "HEAD_FINANCE",
      first_name: "Head",
      last_name: "Finance",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.replace).toHaveBeenCalledWith("/head-finance");
    });
  });

  it("does not redirect when user already stays inside role path", async () => {
    mocked.pathname = "/head-finance/reports";
    mocked.responseUser = {
      id: 3,
      citizen_id: "1234567890125",
      role: "HEAD_FINANCE",
      first_name: "Head",
      last_name: "Finance",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledWith("/auth/me");
    });
    expect(mocked.replace).not.toHaveBeenCalled();
  });
});
