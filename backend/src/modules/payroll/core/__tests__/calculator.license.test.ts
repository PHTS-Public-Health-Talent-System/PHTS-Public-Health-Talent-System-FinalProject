import { calculateMonthlyWithData } from "@/modules/payroll/core/calculator";

test("no license record yields zero payment even with eligibility", async () => {
  const result = await calculateMonthlyWithData(2024, 10, {
    eligibilityRows: [
      {
        effective_date: "2024-09-01",
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: "2022-01-01",
        movement_type: "ENTRY",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.netPayment).toBe(0);
  expect(result.eligibleDays).toBe(0);
});
