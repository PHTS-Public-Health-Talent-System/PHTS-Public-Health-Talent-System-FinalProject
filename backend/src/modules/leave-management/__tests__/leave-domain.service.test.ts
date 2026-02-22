import { expect, test } from "@jest/globals";
import { calculateLeaveQuotaStatus } from "../services/leave-domain.service";

const baseRules = {
  sick: { limit: 60, unit: "business_days", rule_type: "cumulative" },
  personal: { limit: 45, unit: "business_days", rule_type: "cumulative" },
  vacation: { limit: null, unit: "business_days", rule_type: "cumulative" },
  wife_help: { limit: 15, unit: "business_days", rule_type: "per_event" },
  maternity: { limit: 90, unit: "calendar_days", rule_type: "per_event" },
  ordain: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  military: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  education: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
  rehab: { limit: 60, unit: "calendar_days", rule_type: "per_event" },
} as const;

test("business days exclude weekend and holiday", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 1,
        citizen_id: "123",
        leave_type: "sick",
        start_date: "2026-02-02",
        end_date: "2026-02-04",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: ["2026-02-03"],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.sick.used).toBe(2);
});

test("calendar days count all days", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 2,
        citizen_id: "123",
        leave_type: "maternity",
        start_date: "2026-02-02",
        end_date: "2026-02-04",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: ["2026-02-03"],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.maternity.used).toBe(3);
});

test("document dates override leave record dates", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 3,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-10",
        document_start_date: "2026-02-03",
        document_end_date: "2026-02-04",
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.education.used).toBe(2);
});

test("vacation uses quota from leave_quotas", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 4,
        citizen_id: "123",
        leave_type: "vacation",
        start_date: "2026-02-02",
        end_date: "2026-02-09",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 5, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perType.vacation.limit).toBe(5);
  expect(result.perType.vacation.overQuota).toBe(true);
});

test("first-year personal leave limit is 15", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 5,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2026-11-02",
        end_date: "2026-11-23",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: new Date("2026-10-10"),
  });

  expect(result.perType.personal.limit).toBe(15);
  expect(result.perType.personal.overQuota).toBe(true);
});

test("ordain leave has no paid quota if service < 1 year", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 6,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-06-01",
        end_date: "2026-06-05",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: new Date("2026-01-01"),
  });

  expect(result.perType.ordain.limit).toBe(0);
  expect(result.perType.ordain.overQuota).toBe(true);
});

test("ignores leaves after range end when calculating usage", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 1,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2025-08-04",
        end_date: "2025-08-05",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 2,
        citizen_id: "123",
        leave_type: "personal",
        start_date: "2025-09-01",
        end_date: "2025-09-02",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
    rangeStart: new Date("2025-01-01"),
    rangeEnd: new Date("2025-08-31"),
  });

  expect(result.perType.personal.used).toBe(2);
  expect(Object.keys(result.perLeave)).toEqual(["1"]);
});

test("clamps leave across fiscal year boundary to range start", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 10,
        citizen_id: "123",
        leave_type: "vacation",
        start_date: "2024-09-30",
        end_date: "2024-10-01",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
    rangeStart: new Date("2024-10-01"),
    rangeEnd: new Date("2024-10-31"),
  });

  expect(result.perLeave[10].duration).toBe(1);
});

test("wife_help is per_event: two separate events under 15 days should not become over quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 20,
        citizen_id: "123",
        leave_type: "wife_help",
        start_date: "2026-01-05",
        end_date: "2026-01-16",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 21,
        citizen_id: "123",
        leave_type: "wife_help",
        start_date: "2026-03-02",
        end_date: "2026-03-13",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perLeave[20].duration).toBe(10);
  expect(result.perLeave[21].duration).toBe(10);
  expect(result.perLeave[20].overQuota).toBe(false);
  expect(result.perLeave[21].overQuota).toBe(false);
  expect(result.perType.wife_help.overQuota).toBe(false);
});

test("education with same course key accumulates across interruptions while different course stays separate", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 30,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-01-30",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "A",
      },
      {
        id: 31,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-15",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "B",
      },
      {
        id: 32,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-16",
        end_date: "2026-03-31",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_program: "A",
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perLeave[30].duration).toBe(30);
  expect(result.perLeave[31].duration).toBe(15);
  expect(result.perLeave[32].duration).toBe(44);

  expect(result.perLeave[30].overQuota).toBe(false);
  expect(result.perLeave[31].overQuota).toBe(false);
  expect(result.perLeave[32].overQuota).toBe(true);
  expect(result.perLeave[32].exceedDate).toBe("2026-03-18");
});

test("education A/B/A/C/A counts only A cumulatively and exceeds quota by 8 days", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 101,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-01-30", // A รอบ 1 = 30 วัน
        study_program: "A",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 102,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-15", // B = 15 วัน (ไม่นับรวม A)
        study_program: "B",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 103,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-03-01",
        end_date: "2026-03-20", // A รอบ 2 = 20 วัน
        study_program: "A",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 104,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-04-01",
        end_date: "2026-04-10", // C = 10 วัน (ไม่นับรวม A)
        study_program: "C",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 105,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-05-01",
        end_date: "2026-05-18", // A รอบ 3 = 18 วัน
        study_program: "A",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  // A รวม 30 + 20 + 18 = 68 > 60 (เกิน 8)
  expect(result.perLeave[101].duration).toBe(30);
  expect(result.perLeave[103].duration).toBe(20);
  expect(result.perLeave[105].duration).toBe(18);
  expect(result.perLeave[105].overQuota).toBe(true);
  expect(result.perLeave[105].exceedDate).toBe("2026-05-11");

  // B/C ไม่เอาไปรวมกับ A series
  expect(result.perLeave[102].overQuota).toBe(false);
  expect(result.perLeave[104].overQuota).toBe(false);
});

test("ordain with same remark accumulates across interruptions and can exceed quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 40,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-01-01",
        end_date: "2026-01-30",
        remark: "ORDAIN-2026",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 41,
        citizen_id: "123",
        leave_type: "ordain",
        start_date: "2026-03-01",
        end_date: "2026-04-09",
        remark: "ORDAIN-2026",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: new Date("2020-01-01"),
  });

  expect(result.perLeave[40].duration).toBe(30);
  expect(result.perLeave[41].duration).toBe(40);
  expect(result.perLeave[41].overQuota).toBe(true);
  expect(result.perLeave[41].exceedDate).toBe("2026-03-31");
});

test("military with same remark accumulates across interruptions and can exceed quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 50,
        citizen_id: "123",
        leave_type: "military",
        start_date: "2026-05-01",
        end_date: "2026-05-30",
        remark: "MILITARY-CALL-1",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
      {
        id: 51,
        citizen_id: "123",
        leave_type: "military",
        start_date: "2026-07-01",
        end_date: "2026-08-09",
        remark: "MILITARY-CALL-1",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  expect(result.perLeave[50].duration).toBe(30);
  expect(result.perLeave[51].duration).toBe(40);
  expect(result.perLeave[51].overQuota).toBe(true);
  expect(result.perLeave[51].exceedDate).toBe("2026-07-31");
});

test("single education leave with return-report events pauses quota counting between report and resume", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 900,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-04-03",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_institution: "A",
        study_program: "A",
        study_major: "A",
        return_report_events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15" }, // pause 15 days
          { report_date: "2026-03-07", resume_date: "2026-03-17" }, // pause 10 days
        ],
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  // effective A duration = 30 + 20 + 18 = 68
  expect(result.perLeave[900].duration).toBe(68);
  expect(result.perLeave[900].overQuota).toBe(true);
  expect(result.perLeave[900].exceedDate).toBe("2026-03-27");
});

test("single education leave can switch A/B/C via resume event metadata and only A series exceeds quota", () => {
  const result = calculateLeaveQuotaStatus({
    leaveRows: [
      {
        id: 901,
        citizen_id: "123",
        leave_type: "education",
        start_date: "2026-01-01",
        end_date: "2026-04-21",
        document_start_date: null,
        document_end_date: null,
        is_no_pay: 0,
        pay_exception: 0,
        study_institution: "HOSPITAL",
        study_program: "A",
        study_major: "A",
        return_report_events: [
          {
            report_date: "2026-01-31",
            resume_date: "2026-02-15",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "B",
            resume_study_major: "B",
          },
          {
            report_date: "2026-03-02",
            resume_date: "2026-03-03",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "A",
            resume_study_major: "A",
          },
          {
            report_date: "2026-03-23",
            resume_date: "2026-03-24",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "C",
            resume_study_major: "C",
          },
          {
            report_date: "2026-04-03",
            resume_date: "2026-04-04",
            resume_study_institution: "HOSPITAL",
            resume_study_program: "A",
            resume_study_major: "A",
          },
        ],
      },
    ],
    holidays: [],
    quota: { quota_vacation: 10, quota_personal: 45, quota_sick: 60 },
    rules: baseRules,
    serviceStartDate: null,
  });

  // A = 30 + 20 + 18 = 68 -> exceed 60 at 2026-04-14
  expect(result.perLeave[901].overQuota).toBe(true);
  expect(result.perLeave[901].exceedDate).toBe("2026-04-14");
  expect(result.perType.education.used).toBe(93); // A+B+A+C+A
});
