import { HealthRepository } from "@/modules/health/repositories/health.repository.js";

export const getRootPayload = () => ({
  success: true,
  message: "PHTS API root",
  data: {
    timestamp: new Date().toISOString(),
  },
});

export const getHealthPayload = () => ({
  success: true,
  message: "PHTS API is running",
  data: {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || null,
  },
});

export const getSitemapXml = () => {
  const baseUrl =
    process.env.BACKEND_URL || `http://localhost:${process.env.PORT || "3001"}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/health</loc>
  </url>
  <url>
    <loc>${baseUrl}/ready</loc>
  </url>
</urlset>`;
};

export const ensureReady = async () => {
  await HealthRepository.pingDatabase();
  await HealthRepository.pingRedis();
  return {
    success: true,
    message: "PHTS API is ready",
    data: {
      timestamp: new Date().toISOString(),
    },
  };
};
