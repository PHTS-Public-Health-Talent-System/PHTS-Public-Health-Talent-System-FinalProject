import {
  generateRequestNoFromId,
  normalizeDateToYMD,
  parseJsonField,
  mapRequestRow,
} from '@/modules/request/services/helpers.js';
import { RequestStatus, RequestType, PersonnelType } from '@/modules/request/request.types.js';

describe("request helpers", () => {
  test("generateRequestNoFromId creates REQ-BE_YEAR-id", () => {
    expect(generateRequestNoFromId(1, "2026-01-01")).toBe("REQ-2569-1");
    expect(generateRequestNoFromId(66391, "2026-02-12")).toBe("REQ-2569-66391");
  });

  test("normalizeDateToYMD formats date to yyyy-mm-dd", () => {
    expect(normalizeDateToYMD("2026-02-04T10:30:00.000Z")).toBe("2026-02-04");
  });

  test("parseJsonField parses JSON strings and returns null on invalid", () => {
    expect(parseJsonField<{ a: number }>("{\"a\":1}")).toEqual({ a: 1 });
    expect(parseJsonField<{ a: number }>("not-json")).toBeNull();
    expect(parseJsonField(null)).toBeNull();
  });

  test("mapRequestRow parses json fields when stored as string", () => {
    const row = {
      request_id: 10,
      user_id: 5,
      citizen_id: "123",
      request_no: "REQ-2569-10",
      personnel_type: PersonnelType.CIVIL_SERVANT,
      current_position_number: "A-01",
      current_department: "Dept",
      main_duty: "Duty",
      work_attributes: JSON.stringify({
        operation: true,
        planning: false,
        coordination: false,
        service: true,
      }),
      applicant_signature_id: 1,
      request_type: RequestType.NEW_ENTRY,
      requested_amount: 1000,
      effective_date: "2026-02-01",
      status: RequestStatus.PENDING,
      current_step: 3,
      submission_data: JSON.stringify({ rate_id: 1 }),
      has_verification_snapshot: 1,
      created_at: "2026-02-01",
      updated_at: "2026-02-02",
    };

    const mapped = mapRequestRow(row);
    expect(mapped.work_attributes).toEqual({
      operation: true,
      planning: false,
      coordination: false,
      service: true,
    });
    expect(mapped.submission_data).toEqual({ rate_id: 1 });
  });
});
