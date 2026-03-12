const queryMock = jest.fn();

jest.mock("@config/database.js", () => ({
  __esModule: true,
  default: {
    query: queryMock,
  },
}));

describe("SLARepository date handling", () => {
  beforeEach(() => {
    jest.resetModules();
    queryMock.mockReset();
  });

  test("findHolidaysInRange should query using local date value (no UTC day shift)", async () => {
    queryMock.mockResolvedValue([[]]);
    const { SLARepository } = await import("@/modules/sla/repositories/sla.repository.js");

    const start = new Date("2024-12-31T17:00:00.000Z");
    const end = new Date("2024-12-31T17:00:00.000Z");
    await SLARepository.findHolidaysInRange(start, end);

    expect(queryMock).toHaveBeenCalledWith(
      expect.any(String),
      ["2025-01-01", "2025-01-01"],
    );
  });
});
