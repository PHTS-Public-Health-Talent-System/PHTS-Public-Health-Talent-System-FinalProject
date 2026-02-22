import { calculateMonthlyWithData } from "@/modules/payroll/core/calculator";

const makeBaseInput = (overrides: Record<string, any> = {}) => ({
  eligibilityRows: [
    {
      effective_date: "2024-01-01",
      expiry_date: null,
      rate: 6000,
      rate_id: 90,
    },
  ],
  movementRows: [],
  employeeRow: {
    position_name: "เจ้าหน้าที่",
    start_work_date: "2020-01-01",
  },
  licenseRows: [
    {
      valid_from: "2024-01-01",
      valid_until: "2025-12-31",
      status: "ACTIVE",
    },
  ],
  leaveRows: [],
  quotaRow: null,
  holidays: [],
  noSalaryPeriods: [],
  returnReportRows: [],
  ...overrides,
});

const buildWeekdayOneDayLeaves = (
  leaveType: string,
  startDate: string,
  count: number,
  idStart: number,
) => {
  const rows: any[] = [];
  let cursor = new Date(startDate);
  let id = idStart;
  while (rows.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const d = cursor.toISOString().slice(0, 10);
      rows.push({
        id,
        leave_type: leaveType,
        start_date: d,
        end_date: d,
        duration_days: 1,
      });
      id += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
};

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

test("study movement uses precomputed quota path without fallback and deducts over-quota days", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-10-01",
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: "2020-01-01",
        movement_type: "ENTRY",
      },
      {
        effective_date: "2024-10-01",
        movement_type: "STUDY",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.totalDeductionDays).toBe(30);
  expect(result.netPayment).toBe(161.29);
});

test("return report shortens study leave deduction window for synthetic study leave id", async () => {
  const baseInput = {
    eligibilityRows: [
      {
        effective_date: "2024-10-01",
        expiry_date: null,
        rate: 5000,
        rate_id: 84,
      },
    ],
    movementRows: [
      {
        effective_date: "2020-01-01",
        movement_type: "ENTRY",
      },
      {
        effective_date: "2024-10-01",
        movement_type: "STUDY",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
  };

  const withoutReturn = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [],
  });
  const withReturn = await calculateMonthlyWithData(2024, 12, {
    ...baseInput,
    returnReportRows: [
      {
        leave_record_id: -1,
        return_date: "2024-12-20",
      },
    ],
  });

  expect(withoutReturn.totalDeductionDays).toBe(30);
  expect(withReturn.totalDeductionDays).toBeLessThan(withoutReturn.totalDeductionDays);
});

test("exit status cuts payroll eligibility even if there is re-entry in the same month", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2020-01-01",
        movement_type: "ENTRY",
      },
      {
        effective_date: "2024-12-10",
        movement_type: "RESIGN",
      },
      {
        effective_date: "2024-12-20",
        movement_type: "REINSTATE",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // ธ.ค. 2024 ตัดสิทธิหลัง RESIGN วันที่ 10 จึงเหลือวันมีสิทธิแค่วันที่ 1-9
  expect(result.eligibleDays).toBe(9);
});

test("historical exit before this month does not cut current payroll rights by itself", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2020-01-01",
        movement_type: "ENTRY",
      },
      {
        effective_date: "2023-08-01",
        movement_type: "RESIGN",
      },
      {
        effective_date: "2024-01-15",
        movement_type: "REINSTATE",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(31);
});

test("TC-05 license ครอบคลุมทั้งเดือน => ได้สิทธิครบและได้เงินเต็ม", async () => {
  const result = await calculateMonthlyWithData(2024, 9, makeBaseInput());
  expect(result.eligibleDays).toBe(30);
  expect(result.netPayment).toBe(6000);
});

test("TC-06 license หมดกลางเดือน => ได้สิทธิถึงวันหมดอายุ", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      licenseRows: [
        {
          valid_from: "2024-01-01",
          valid_until: "2024-09-15",
          status: "ACTIVE",
        },
      ],
    }),
  );
  expect(result.eligibleDays).toBe(15);
  expect(result.netPayment).toBe(3000);
});

test("TC-08 license เริ่มกลางเดือน => ได้สิทธิแค่ช่วงปลายเดือน", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      licenseRows: [
        {
          valid_from: "2024-09-20",
          valid_until: "2025-12-31",
          status: "ACTIVE",
        },
      ],
    }),
  );
  expect(result.eligibleDays).toBe(11);
  expect(result.netPayment).toBe(2200);
});

test("TC-09 ลากิจเกินลิมิตสะสม => หักเฉพาะส่วนที่เกิน", async () => {
  const previousPersonal40 = buildWeekdayOneDayLeaves(
    "personal",
    "2024-10-01",
    40,
    1000,
  );
  const currentPersonal10 = buildWeekdayOneDayLeaves(
    "personal",
    "2024-12-02",
    10,
    2000,
  );

  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [...previousPersonal40, ...currentPersonal10],
      quotaRow: { quota_personal: 45 },
    }),
  );

  expect(result.totalDeductionDays).toBe(5);
});

test("TC-10 ลาป่วยยังไม่เกินลิมิต => ไม่ถูกหัก", async () => {
  const previousSick50 = buildWeekdayOneDayLeaves(
    "sick",
    "2024-10-01",
    50,
    3000,
  );
  const currentSick5 = buildWeekdayOneDayLeaves(
    "sick",
    "2024-12-02",
    5,
    4000,
  );

  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [...previousSick50, ...currentSick5],
      quotaRow: { quota_sick: 60 },
    }),
  );

  expect(result.totalDeductionDays).toBe(0);
});

test("TC-11 ลาเรียนคนละหลักสูตรไม่นับสะสมรวมกัน (per_event)", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [
        {
          id: 5001,
          leave_type: "education",
          start_date: "2024-10-01",
          end_date: "2024-10-30",
          duration_days: 30,
        },
        {
          id: 5002,
          leave_type: "education",
          start_date: "2024-12-01",
          end_date: "2024-12-10",
          duration_days: 10,
        },
      ],
    }),
  );

  expect(result.totalDeductionDays).toBe(0);
});

test("TC-12 ลาเรียนยาวเกิน 60 วัน => หักเฉพาะช่วงเกินในเดือนเป้าหมาย", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    12,
    makeBaseInput({
      leaveRows: [
        {
          id: 5101,
          leave_type: "education",
          start_date: "2024-10-01",
          end_date: "2024-12-09",
          duration_days: 70,
        },
      ],
      returnReportRows: [
        {
          leave_record_id: 5101,
          return_date: "2024-12-10",
        },
      ],
    }),
  );

  // ช่วงเกินคือวันลำดับ 61-70 -> ในเดือน ธ.ค. มี 9 วัน (1-9)
  expect(result.totalDeductionDays).toBe(9);
});

test("TC-14 ใบอนุญาตหมดกลางเดือน + ลาเกินลิมิต => eligible_days เหลือ 15", async () => {
  const previousPersonal45 = buildWeekdayOneDayLeaves(
    "personal",
    "2024-07-01",
    45,
    6000,
  );
  const currentPersonal5 = buildWeekdayOneDayLeaves(
    "personal",
    "2024-09-02",
    5,
    7000,
  );

  const result = await calculateMonthlyWithData(
    2024,
    9,
    makeBaseInput({
      leaveRows: [...previousPersonal45, ...currentPersonal5],
      quotaRow: { quota_personal: 45 },
      licenseRows: [
        {
          valid_from: "2024-01-01",
          valid_until: "2024-09-20",
          status: "ACTIVE",
        },
      ],
    }),
  );

  expect(result.eligibleDays).toBe(15);
  expect(result.netPayment).toBe(3000);
});

test("TC-15 ลาข้ามเดือน => ในรอบก.พ.นับเฉพาะวันในก.พ.", async () => {
  const result = await calculateMonthlyWithData(
    2025,
    2,
    makeBaseInput({
      leaveRows: [
        {
          id: 8001,
          leave_type: "sick",
          start_date: "2025-01-31",
          end_date: "2025-02-02",
          duration_days: 3,
          is_no_pay: 1,
        },
      ],
    }),
  );

  // ก.พ. 2025 มี 28 วัน และถูกหักเฉพาะ 1-2 ก.พ.
  expect(result.totalDeductionDays).toBe(2);
  expect(result.eligibleDays).toBe(26);
});

test("leap year february no-pay across month deducts all 29 days in Feb only", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    2,
    makeBaseInput({
      leaveRows: [
        {
          id: 8101,
          leave_type: "sick",
          start_date: "2024-01-31",
          end_date: "2024-02-29",
          duration_days: 30,
          is_no_pay: 1,
        },
      ],
    }),
  );

  expect(result.totalDeductionDays).toBe(29);
  expect(result.eligibleDays).toBe(0);
  expect(result.netPayment).toBe(0);
});

test("leave crossing fiscal boundary Sep to Oct deducts only October days", async () => {
  const result = await calculateMonthlyWithData(
    2024,
    10,
    makeBaseInput({
      leaveRows: [
        {
          id: 8201,
          leave_type: "sick",
          start_date: "2024-09-30",
          end_date: "2024-10-02",
          duration_days: 3,
          is_no_pay: 1,
        },
      ],
    }),
  );

  // ในรอบ ต.ค. ต้องหักเฉพาะ 1-2 ต.ค.
  expect(result.totalDeductionDays).toBe(2);
  expect(result.eligibleDays).toBe(29);
});

test("no movements in month keeps full eligible days when license and eligibility are valid", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(31);
});

test("exit on first day yields zero eligible days", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2024-12-01",
        movement_type: "RESIGN",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(0);
  expect(result.netPayment).toBe(0);
});

test("exit on last day keeps eligibility until day before exit", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2024-12-31",
        movement_type: "TRANSFER_OUT",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(30);
});

test("when multiple exits exist in month, first exit date is used", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2024-12-18",
        movement_type: "RETIRE",
      },
      {
        effective_date: "2024-12-10",
        movement_type: "RESIGN",
      },
      {
        effective_date: "2024-12-25",
        movement_type: "DEATH",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // first exit = 2024-12-10 => eligible 1..9
  expect(result.eligibleDays).toBe(9);
});

test("same-day entry and exit still cut rights by exit status policy", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2024-12-10",
        movement_type: "ENTRY",
      },
      {
        effective_date: "2024-12-10",
        movement_type: "RESIGN",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(9);
});

test("exit datetime with time still cuts by the movement local date", async () => {
  const result = await calculateMonthlyWithData(2024, 12, {
    eligibilityRows: [
      {
        effective_date: "2024-01-01",
        expiry_date: null,
        rate: 6200,
        rate_id: 90,
      },
    ],
    movementRows: [
      {
        effective_date: "2024-12-10T00:30:00+07:00",
        movement_type: "RETIRE",
      },
    ],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2024-01-01",
        valid_until: "2025-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.eligibleDays).toBe(9);
});

test("missing start_work_date raises blocker check and does not fallback to first_entry_date", async () => {
  const personal20Days = buildWeekdayOneDayLeaves(
    "personal",
    "2026-11-02",
    20,
    9000,
  );

  const result = await calculateMonthlyWithData(2026, 11, {
    eligibilityRows: [
      {
        effective_date: "2026-01-01",
        expiry_date: null,
        rate: 6000,
        rate_id: 90,
      },
    ],
    movementRows: [],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: null,
      first_entry_date: "2026-10-10",
    },
    licenseRows: [
      {
        valid_from: "2026-01-01",
        valid_until: "2026-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: personal20Days,
    quotaRow: { quota_personal: 45 },
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  // ถ้า fallback ไป first_entry_date จะถูกมองเป็นปีแรกและโดนหัก 5 วัน
  // เคสนี้ต้องไม่ fallback จึงไม่ถูกหัก
  expect(result.totalDeductionDays).toBe(0);
  expect(result.checks?.some((c) => c.code === "MISSING_START_WORK_DATE")).toBe(true);
  expect(
    result.checks?.some(
      (c) => c.code === "MISSING_START_WORK_DATE" && c.severity === "BLOCKER",
    ),
  ).toBe(true);
});

test("does not extend deduction for missing return report and raises warning instead", async () => {
  const result = await calculateMonthlyWithData(2026, 2, {
    eligibilityRows: [
      {
        effective_date: "2026-01-01",
        expiry_date: null,
        rate: 6000,
        rate_id: 90,
      },
    ],
    movementRows: [],
    employeeRow: {
      position_name: "เจ้าหน้าที่",
      start_work_date: "2020-01-01",
    },
    licenseRows: [
      {
        valid_from: "2026-01-01",
        valid_until: "2026-12-31",
        status: "ACTIVE",
      },
    ],
    leaveRows: [
      {
        id: 9901,
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-10",
        duration_days: 10,
        return_report_status: "PENDING",
      },
    ],
    quotaRow: null,
    holidays: [],
    noSalaryPeriods: [],
    returnReportRows: [],
  });

  expect(result.totalDeductionDays).toBe(0);
  expect(result.checks?.some((c) => c.code === "PENDING_RETURN_REPORT")).toBe(true);
  expect(
    result.checks?.some(
      (c) => c.code === "PENDING_RETURN_REPORT" && c.severity === "WARNING",
    ),
  ).toBe(true);
});
