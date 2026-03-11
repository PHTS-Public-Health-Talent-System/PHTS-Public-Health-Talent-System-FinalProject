import {
  deriveImportedRateSelectors,
  deriveImportedPayoutMetrics,
  resolveImportedRateId,
  type ImportedRateRow,
} from "@/modules/payroll/services/import/payroll-import-mapping.js";

describe("payroll import mapping", () => {
  describe("deriveImportedRateSelectors", () => {
    it("maps group 2 clause 2.1 with no sub item to item 2.1", () => {
      expect(
        deriveImportedRateSelectors({
          sourceGroupNo: "2",
          sourceClause: "2.1",
          sourceItemNo: null,
        }),
      ).toEqual({
        groupNo: 2,
        itemNo: "2.1",
        subItemNo: null,
      });
    });

    it("maps group 2 clause 2.2 with item 3 to sub item 2.2.3", () => {
      expect(
        deriveImportedRateSelectors({
          sourceGroupNo: "2",
          sourceClause: "2.2",
          sourceItemNo: "3",
        }),
      ).toEqual({
        groupNo: 2,
        itemNo: "2.2",
        subItemNo: "2.2.3",
      });
    });

    it("maps group 3 clause 3.1 with item 3 to sub item 3.1.3", () => {
      expect(
        deriveImportedRateSelectors({
          sourceGroupNo: "3",
          sourceClause: "3.1",
          sourceItemNo: "3",
        }),
      ).toEqual({
        groupNo: 3,
        itemNo: "3.1",
        subItemNo: "3.1.3",
      });
    });

    it("keeps direct sub item clause when source clause is already 3.1.3", () => {
      expect(
        deriveImportedRateSelectors({
          sourceGroupNo: "3",
          sourceClause: "3.1.3",
          sourceItemNo: null,
        }),
      ).toEqual({
        groupNo: 3,
        itemNo: "3.1",
        subItemNo: "3.1.3",
      });
    });
  });

  describe("resolveImportedRateId", () => {
    const rates: ImportedRateRow[] = [
      { rateId: 102, professionCode: "NURSE", groupNo: 1, itemNo: "1.1", subItemNo: null, amount: 1000 },
      { rateId: 103, professionCode: "NURSE", groupNo: 1, itemNo: "1.2", subItemNo: null, amount: 1000 },
      { rateId: 104, professionCode: "NURSE", groupNo: 2, itemNo: "2.1", subItemNo: null, amount: 1500 },
      { rateId: 107, professionCode: "NURSE", groupNo: 2, itemNo: "2.2", subItemNo: "2.2.3", amount: 1500 },
      { rateId: 111, professionCode: "NURSE", groupNo: 3, itemNo: "3.1", subItemNo: "3.1.3", amount: 2000 },
    ];

    it("resolves an exact item match", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "2",
            sourceClause: "2.1",
            sourceItemNo: null,
            announcedRate: 1500,
          },
          rates,
          "NURSE",
        ),
      ).toBe(104);
    });

    it("defaults ambiguous 2.2 nurse rows to rate 107", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "2",
            sourceClause: "2.2",
            sourceItemNo: null,
            announcedRate: 1500,
          },
          [
            { rateId: 105, professionCode: "NURSE", groupNo: 2, itemNo: "2.2", subItemNo: null, amount: 1500 },
            { rateId: 106, professionCode: "NURSE", groupNo: 2, itemNo: "2.2", subItemNo: null, amount: 1500 },
            { rateId: 107, professionCode: "NURSE", groupNo: 2, itemNo: "2.2", subItemNo: null, amount: 1500 },
          ],
          "NURSE",
        ),
      ).toBe(107);
    });

    it("falls back missing group clause 1.1 nurse rows to rate 102", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: null,
            sourceClause: "1.1",
            sourceItemNo: null,
            announcedRate: 1000,
          },
          rates,
          "NURSE",
        ),
      ).toBe(102);
    });

    it("treats nurse group 1 clause 1 rows as 1.1 when amount is 1000", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "1",
            sourceClause: "1",
            sourceItemNo: null,
            announcedRate: 1000,
          },
          rates,
          "NURSE",
        ),
      ).toBe(102);
    });

    it("resolves a normalized sub item match", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "3",
            sourceClause: "3.1",
            sourceItemNo: "3",
            announcedRate: 2000,
          },
          rates,
          "NURSE",
        ),
      ).toBe(111);
    });

    it("resolves when cfg sub_item_no uses short numeric value", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "3",
            sourceClause: "3.1",
            sourceItemNo: "3",
            announcedRate: 2000,
          },
          [
            { rateId: 210, professionCode: "NURSE", groupNo: 3, itemNo: "3.1", subItemNo: "1", amount: 2000 },
            { rateId: 211, professionCode: "NURSE", groupNo: 3, itemNo: "3.1", subItemNo: "2", amount: 2000 },
            { rateId: 212, professionCode: "NURSE", groupNo: 3, itemNo: "3.1", subItemNo: "3", amount: 2000 },
          ],
          "NURSE",
        ),
      ).toBe(212);
    });

    it("resolves short numeric sub item when source clause already includes sub item", () => {
      expect(
        resolveImportedRateId(
          {
            sourceGroupNo: "3",
            sourceClause: "3.1.3",
            sourceItemNo: null,
            announcedRate: 2000,
          },
          [
            { rateId: 312, professionCode: "NURSE", groupNo: 3, itemNo: "3.1", subItemNo: "3", amount: 2000 },
          ],
          "NURSE",
        ),
      ).toBe(312);
    });
  });

  describe("deriveImportedPayoutMetrics", () => {
    it("derives eligible and deducted days from actual monthly amount", () => {
      expect(
        deriveImportedPayoutMetrics({
          daysInMonth: 31,
          announcedRate: 2000,
          monthlyAmount: 1741.94,
          retroactiveAmount: 0,
          totalAmount: 1741.94,
        }),
      ).toEqual({
        calculatedAmount: 1741.94,
        retroactiveAmount: 0,
        totalPayable: 1741.94,
        eligibleDays: 27,
        deductedDays: 4,
      });
    });
  });
});
