import {
  addEligibilityGapRangeEvidence,
  addOverlappingEligibilityEvidence,
  applyDailyCheckImpact,
  buildEligibilityGapRanges,
  checkTitle,
  normalizeReasonCode,
  pushEvidence,
  reasonSeverity,
  setEligibilityGapRange,
  type CheckAgg,
  type DailyCheckImpactContext,
} from "@/modules/payroll/core/calculator/checks/calculator.checks.rules.js";
import type {
  PayrollCheckCode,
  PayrollCheckEvidence,
} from "@/modules/payroll/core/calculator/facade/calculator.js";

const createAgg = (code: PayrollCheckCode): CheckAgg => ({
  code,
  impactDays: 0,
  impactAmount: 0,
  startDate: null,
  endDate: null,
  evidence: [],
  evidenceKeySet: new Set(),
});

const createEnsureAgg = () => {
  const map = new Map<PayrollCheckCode, CheckAgg>();
  const ensureAgg = (code: PayrollCheckCode): CheckAgg => {
    const existing = map.get(code);
    if (existing) return existing;
    const next = createAgg(code);
    map.set(code, next);
    return next;
  };
  const updateAggRange = (agg: CheckAgg, dateStr: string) => {
    if (!agg.startDate || dateStr < agg.startDate) agg.startDate = dateStr;
    if (!agg.endDate || dateStr > agg.endDate) agg.endDate = dateStr;
  };
  return { map, ensureAgg, updateAggRange };
};

describe("calculator.checks.rules", () => {
  test("maps deduction reason codes", () => {
    expect(normalizeReasonCode("NO_PAY")).toBe("NO_PAY");
    expect(normalizeReasonCode("OVER_QUOTA")).toBe("OVER_QUOTA");
  });

  test("resolves severity and title", () => {
    expect(reasonSeverity("NO_PAY")).toBe("BLOCKER");
    expect(reasonSeverity("OVER_QUOTA")).toBe("WARNING");
    expect(checkTitle("NO_PAY")).toBe("ลาไม่รับค่าตอบแทน");
    expect(checkTitle("NO_LICENSE")).toContain("ใบอนุญาต");
  });

  test("deduplicates evidence by key", () => {
    const agg = createAgg("OVER_QUOTA");
    const evidence: PayrollCheckEvidence = {
      type: "movement",
      movement_type: "TRANSFER",
      effective_date: "2026-02-01",
    };

    pushEvidence(agg, "same-key", evidence);
    pushEvidence(agg, "same-key", evidence);

    expect(agg.evidence).toHaveLength(1);
    expect(agg.evidenceKeySet.size).toBe(1);
  });

  test("applies NO_LICENSE impact when license is missing", () => {
    const { ensureAgg, updateAggRange } = createEnsureAgg();
    const context: DailyCheckImpactContext = {
      daysInMonth: 30,
      ensureAgg,
      updateAggRange,
      leaveById: new Map(),
      quotaInfoByLeaveId: new Map(),
    };

    applyDailyCheckImpact(
      {
        currentRate: 3000,
        hasLicense: false,
        reasons: [],
        deductionWeight: 0,
        dateStr: "2026-02-10",
      },
      context,
    );

    const agg = ensureAgg("NO_LICENSE");
    expect(agg.impactDays).toBe(1);
    expect(agg.impactAmount).toBeCloseTo(100, 6);
    expect(agg.startDate).toBe("2026-02-10");
    expect(agg.endDate).toBe("2026-02-10");
  });

  test("applies OVER_QUOTA impact when no reason list but deduction exists", () => {
    const { ensureAgg, updateAggRange } = createEnsureAgg();
    const context: DailyCheckImpactContext = {
      daysInMonth: 30,
      ensureAgg,
      updateAggRange,
      leaveById: new Map(),
      quotaInfoByLeaveId: new Map(),
    };

    applyDailyCheckImpact(
      {
        currentRate: 3000,
        hasLicense: true,
        reasons: [],
        deductionWeight: 0.5,
        dateStr: "2026-02-11",
      },
      context,
    );

    const agg = ensureAgg("OVER_QUOTA");
    expect(agg.impactDays).toBe(0.5);
    expect(agg.impactAmount).toBeCloseTo(50, 6);
  });

  test("applies leave reason impact and keeps evidence", () => {
    const { ensureAgg, updateAggRange } = createEnsureAgg();
    const context: DailyCheckImpactContext = {
      daysInMonth: 30,
      ensureAgg,
      updateAggRange,
      leaveById: new Map([
        [
          7,
          {
            id: 7,
            leave_type: "sick",
            start_date: "2026-02-05",
            end_date: "2026-02-05",
            duration_days: 1,
          },
        ],
      ]),
      quotaInfoByLeaveId: new Map([
        [7, { limit: 10, duration: 12, exceedDate: "2026-02-05", leaveType: "sick" }],
      ]),
    };

    applyDailyCheckImpact(
      {
        currentRate: 3000,
        hasLicense: true,
        reasons: [
          {
            code: "OVER_QUOTA",
            weight: 1,
            leave_record_id: 7,
            leave_type: "sick",
          },
        ],
        deductionWeight: 1,
        dateStr: "2026-02-05",
      },
      context,
    );

    const agg = ensureAgg("OVER_QUOTA");
    expect(agg.impactDays).toBe(1);
    expect(agg.evidence).toHaveLength(1);
    expect((agg.evidence[0] as any).leave_record_id).toBe(7);
  });

  test("builds and applies eligibility gap ranges", () => {
    const ranges = buildEligibilityGapRanges("2026-02-01", "2026-02-28", {
      daysWithEligibilityRate: 20,
      firstEligibilityDay: "2026-02-03",
      lastEligibilityDay: "2026-02-25",
    });

    expect(ranges).toEqual([
      { start: "2026-02-01", end: "2026-02-02" },
      { start: "2026-02-26", end: "2026-02-28" },
    ]);

    const agg = createAgg("ELIGIBILITY_GAP");
    setEligibilityGapRange(agg, ranges);
    expect(agg.startDate).toBeNull();
    expect(agg.endDate).toBeNull();

    addEligibilityGapRangeEvidence(
      agg,
      ranges,
      "2026-02-01",
      "2026-02-28",
      "2026-02-01",
      "2026-02-28",
    );
    expect(agg.rangeLabel).toContain("2026-02-01");
    expect(agg.evidence).toHaveLength(1);
  });

  test("adds overlapping eligibility evidence", () => {
    const agg = createAgg("ELIGIBILITY_GAP");

    addOverlappingEligibilityEvidence(
      agg,
      [
        {
          effectiveTs: new Date("2026-01-01").getTime(),
          expiryTs: new Date("2026-12-31").getTime(),
          effectiveDate: "2026-01-01",
          expiryDate: "2026-12-31",
          rate: 6000,
          rateId: 9,
          professionCode: "NURSE",
          groupNo: 1,
          itemNo: "A",
        },
      ],
      "2026-02-01",
      "2026-02-28",
    );

    expect(agg.evidence).toHaveLength(1);
    expect((agg.evidence[0] as any).type).toBe("eligibility");
  });
});
