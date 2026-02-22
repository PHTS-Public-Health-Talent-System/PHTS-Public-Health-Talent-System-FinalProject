import request from "supertest";
import type { Application } from "express";

describe("API Integration Tests", () => {
  let app: Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
    ({ default: app } = await import("@/index.js"));
  });

  test("GET /health should return running status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.message).toBe("PHTS API is running");
    expect(response.body?.data?.environment).toBe("test");
  });

  test("GET /robots.txt should return plain text rules", async () => {
    const response = await request(app).get("/robots.txt");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("User-agent:");
  });

  test("GET /sitemap.xml should return xml", async () => {
    const response = await request(app).get("/sitemap.xml");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/xml");
    expect(response.text).toContain("<urlset");
    expect(response.text).toContain("/health");
  });

  test("GET /api/not-found should return standard 404 shape", async () => {
    const response = await request(app).get("/api/not-found");

    expect(response.status).toBe(404);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error?.code).toBe("NOT_FOUND");
  });
});
