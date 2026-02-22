import request from "supertest";
import type { Application } from "express";

describe("Critical Workflows E2E", () => {
  let app: Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-secret";
    ({ default: app } = await import("@/index.js"));
  });

  test("should expose request id for health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  test("should preserve client request id when provided", async () => {
    const response = await request(app)
      .get("/health")
      .set("x-request-id", "e2e-fixed-request-id");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("e2e-fixed-request-id");
  });

  test("should apply cors header for allowed origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });

  test("should return maintenance-safe 404 response for unknown api path", async () => {
    const response = await request(app).get("/api/unknown-endpoint");

    expect(response.status).toBe(404);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error?.code).toBe("NOT_FOUND");
  });
});
