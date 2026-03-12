import { SLARepository } from "@/modules/sla/repositories/sla.repository.js";
import * as slaService from "@/modules/sla/services/sla.service.js";

describe("SLA service date handling", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("calculateBusinessDays should respect date-only value in local timezone for holiday matching", async () => {
    jest
      .spyOn(SLARepository, "findHolidaysInRange")
      .mockResolvedValue(new Set(["2025-01-01"]));

    const start = new Date("2024-12-31T17:00:00.000Z");
    const end = new Date("2024-12-31T17:00:00.000Z");

    const result = await slaService.calculateBusinessDays(start, end);

    expect(result).toBe(0);
  });
});
