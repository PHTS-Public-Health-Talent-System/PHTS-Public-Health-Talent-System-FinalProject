import { getConnection } from "@config/database.js";
import { RequestStatus, RequestType } from "@/modules/request/contracts/request.types.js";
import { AuditEventType } from "@/modules/audit/entities/audit.entity.js";
import { OcrRequestRepository } from "@/modules/ocr/repositories/ocr-request.repository.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { requestQueryService } from "@/modules/request/read/services/query.service.js";
import { RequestCommandService } from "@/modules/request/services/command.service.js";
import {
  makeDbConnectionMock,
  mockOfficerTargetCitizenLookup,
  mockUniqueRequestNo,
} from "./command.officer-on-behalf.test-helpers.js";

jest.mock("@config/database.js", () => ({
  getConnection: jest.fn(),
}));

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  AuditEventType: {
    REQUEST_CREATE: "REQUEST_CREATE",
    REQUEST_SUBMIT: "REQUEST_SUBMIT",
  },
  emitAuditEvent: jest.fn().mockResolvedValue(1),
}));

jest.mock("@/modules/notification/services/notification.service.js", () => ({
  NotificationService: {
    notifyRole: jest.fn().mockResolvedValue(undefined),
    notifyUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/modules/ocr/services/ocr-precheck.service.js", () => ({
  enqueueRequestOcrPrecheck: jest.fn().mockResolvedValue(undefined),
}));

describe("RequestCommandService officer on behalf flow", () => {
  let service: RequestCommandService;
  const connection = makeDbConnectionMock();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    service = new RequestCommandService();
    (getConnection as jest.Mock).mockResolvedValue(connection);
    mockUniqueRequestNo();
  });

  it("creates request for selected personnel when PTS_OFFICER submits on behalf", async () => {
    mockOfficerTargetCitizenLookup();
    jest.spyOn(requestRepository, "findSignatureIdByUserId").mockResolvedValue(null);
    jest.spyOn(requestRepository, "findEmployeeProfile").mockResolvedValue({
      citizen_id: "1100702579863",
      title: "นางสาว",
      first_name: "พีรดา",
      last_name: "แก้วทอด",
      emp_type: "CIVIL_SERVANT",
      position_name: "พยาบาลวิชาชีพ",
      position_number: "1234",
      department: "การพยาบาล",
      sub_department: "หอผู้ป่วย 1",
      mission_group: "พยาบาลวิชาชีพ",
    } as any);
    jest.spyOn(requestRepository, "create").mockResolvedValue(501);
    jest.spyOn(requestRepository, "updateRequestNo").mockResolvedValue();
    jest.spyOn(requestQueryService, "getRequestDetails").mockResolvedValue({
      request_id: 501,
      user_id: 2001,
      citizen_id: "1100702579863",
    } as any);

    await service.createRequest(
      9001,
      "PTS_OFFICER",
      {
        target_user_id: 2001,
        personnel_type: "CIVIL_SERVANT" as any,
        request_type: RequestType.NEW_ENTRY,
        requested_amount: 1500,
        effective_date: "2026-03-03",
        submission_data: {
          title: "นางสาว",
          first_name: "พีรดา",
          last_name: "แก้วทอด",
          position_name: "พยาบาลวิชาชีพ",
          department: "การพยาบาล",
          sub_department: "หอผู้ป่วย 1",
          rate_mapping: {
            rate_id: 101,
          },
        },
      },
      [],
      undefined,
    );

    expect(requestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 2001,
        citizen_id: "1100702579863",
        applicant_signature_id: null,
        request_type: RequestType.NEW_ENTRY,
        effective_date: "2026-03-03",
        submission_data: expect.objectContaining({
          created_by_officer_id: 9001,
          created_by_officer_role: "PTS_OFFICER",
          target_user_id: 2001,
          target_citizen_id: "1100702579863",
        }),
      }),
      connection as any,
    );
  });

  it("submits officer-created request by approving immediately and creating eligibility", async () => {
    mockOfficerTargetCitizenLookup();
    jest
      .spyOn(requestRepository, "findById")
      .mockResolvedValueOnce({
        request_id: 501,
        user_id: 2001,
        citizen_id: "1100702579863",
        request_no: "REQ-2026-501",
        status: RequestStatus.DRAFT,
        current_step: 1,
        requested_amount: 1500,
        effective_date: new Date("2026-03-03"),
        submission_data: {
          title: "นางสาว",
          first_name: "พีรดา",
          last_name: "แก้วทอด",
          position_name: "พยาบาลวิชาชีพ",
          rate_mapping: {
            rate_id: 101,
            group_no: 2,
            item_no: "2.1",
            amount: 1500,
            profession_code: "NURSE",
          },
          created_by_officer_id: 9001,
          created_by_officer_role: "PTS_OFFICER",
        },
        position_name: "พยาบาลวิชาชีพ",
      } as any)
      .mockResolvedValueOnce({
        request_id: 501,
        user_id: 2001,
        citizen_id: "1100702579863",
        request_no: "REQ-2026-501",
        status: RequestStatus.APPROVED,
        current_step: 7,
        requested_amount: 1500,
        effective_date: new Date("2026-03-03"),
        submission_data: {
          created_by_officer_id: 9001,
          created_by_officer_role: "PTS_OFFICER",
        },
      } as any);
    jest.spyOn(requestRepository, "findSignatureSnapshot").mockResolvedValue(null);
    jest.spyOn(requestRepository, "update").mockResolvedValue();
    jest.spyOn(requestRepository, "insertApproval").mockResolvedValue(1 as any);
    jest.spyOn(requestRepository, "insertVerificationSnapshot").mockResolvedValue(88);
    jest.spyOn(requestRepository, "deactivateEligibility").mockResolvedValue();
    jest.spyOn(requestRepository, "insertEligibility").mockResolvedValue();
    jest.spyOn(requestRepository, "findVerificationSnapshotById").mockResolvedValue({
      snapshot_id: 88,
    } as any);
    jest.spyOn(requestRepository, "findMatchingRateId").mockResolvedValue(101);
    jest.spyOn(OcrRequestRepository, "upsertRequestPrecheck").mockResolvedValue();

    const result = await service.submitRequest(501, 9001, "PTS_OFFICER");

    expect(requestRepository.insertVerificationSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 501,
        user_id: 2001,
        citizen_id: "1100702579863",
        master_rate_id: 101,
        created_by: 9001,
      }),
      connection as any,
    );
    expect(requestRepository.deactivateEligibility).toHaveBeenCalledWith(
      2001,
      "1100702579863",
      "2026-03-03",
      connection as any,
    );
    expect(requestRepository.insertEligibility).toHaveBeenCalledWith(
      2001,
      "1100702579863",
      101,
      501,
      "2026-03-03",
      connection as any,
    );
    expect(requestRepository.update).toHaveBeenCalledWith(
      501,
      expect.objectContaining({
        status: RequestStatus.APPROVED,
        current_step: 7,
      }),
      connection as any,
    );
    expect(requestRepository.insertApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 501,
        actor_id: 9001,
        action: "SUBMIT",
        signature_snapshot: null,
      }),
      connection as any,
    );
    const { emitAuditEvent } = jest.requireMock("@/modules/audit/services/audit.service.js");
    const { enqueueRequestOcrPrecheck } = jest.requireMock("@/modules/ocr/services/ocr-precheck.service.js");
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.REQUEST_SUBMIT,
      }),
      connection as any,
    );
    expect(OcrRequestRepository.upsertRequestPrecheck).toHaveBeenCalledWith(
      501,
      expect.objectContaining({
        status: "queued",
        source: "AUTO_ON_SUBMIT",
      }),
      connection as any,
    );
    expect(enqueueRequestOcrPrecheck).toHaveBeenCalledWith(501);
    expect(result.status).toBe(RequestStatus.APPROVED);
  });

  it("submits legacy officer-created draft identified from create audit log", async () => {
    mockOfficerTargetCitizenLookup();
    jest
      .spyOn(requestRepository, "findById")
      .mockResolvedValueOnce({
        request_id: 67906,
        user_id: 2001,
        citizen_id: "1100702579863",
        request_no: "REQ-2026-67906",
        status: RequestStatus.DRAFT,
        current_step: 1,
        requested_amount: 1500,
        effective_date: new Date("2026-03-03"),
        submission_data: {
          title: "นางสาว",
          first_name: "พีรดา",
          last_name: "แก้วทอด",
          position_name: "พยาบาลวิชาชีพ",
          rate_mapping: {
            rate_id: 101,
            group_no: 2,
            item_no: "2.1",
            amount: 1500,
            profession_code: "NURSE",
          },
        },
        position_name: "พยาบาลวิชาชีพ",
      } as any)
      .mockResolvedValueOnce({
        request_id: 67906,
        user_id: 2001,
        citizen_id: "1100702579863",
        request_no: "REQ-2026-67906",
        status: RequestStatus.APPROVED,
        current_step: 7,
        requested_amount: 1500,
        effective_date: new Date("2026-03-03"),
        submission_data: {},
      } as any);
    jest.spyOn(requestRepository, "findRequestCreateAuditMeta").mockResolvedValue({
      actor_id: 9001,
      actor_role: "PTS_OFFICER",
      action_detail: {
        owner_user_id: 2001,
      },
    } as any);
    jest.spyOn(requestRepository, "findSignatureSnapshot").mockResolvedValue(null);
    jest.spyOn(requestRepository, "update").mockResolvedValue();
    jest.spyOn(requestRepository, "insertApproval").mockResolvedValue(1 as any);
    jest.spyOn(requestRepository, "insertVerificationSnapshot").mockResolvedValue(89);
    jest.spyOn(requestRepository, "deactivateEligibility").mockResolvedValue();
    jest.spyOn(requestRepository, "insertEligibility").mockResolvedValue();
    jest.spyOn(requestRepository, "findVerificationSnapshotById").mockResolvedValue({
      snapshot_id: 89,
    } as any);
    jest.spyOn(requestRepository, "findMatchingRateId").mockResolvedValue(101);
    jest.spyOn(OcrRequestRepository, "upsertRequestPrecheck").mockResolvedValue();

    const result = await service.submitRequest(67906, 9001, "PTS_OFFICER");

    expect(requestRepository.findRequestCreateAuditMeta).toHaveBeenCalledWith(67906);
    expect(requestRepository.insertVerificationSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 67906,
        user_id: 2001,
        citizen_id: "1100702579863",
        master_rate_id: 101,
        created_by: 9001,
      }),
      connection as any,
    );
    expect(result.status).toBe(RequestStatus.APPROVED);
  });

  it("preserves officer-created metadata when updating draft on behalf request", async () => {
    jest.spyOn(requestRepository, "findById").mockResolvedValue({
      request_id: 501,
      user_id: 2001,
      citizen_id: "1100702579863",
      request_no: "REQ-2026-501",
      status: RequestStatus.DRAFT,
      current_step: 1,
      requested_amount: 1500,
      effective_date: new Date("2026-03-03"),
      submission_data: {
        created_by_officer_id: 9001,
        created_by_officer_role: "PTS_OFFICER",
        created_mode: "OFFICER_ON_BEHALF",
        target_user_id: 2001,
        target_citizen_id: "1100702579863",
        rate_mapping: {
          rate_id: 104,
          amount: 1500,
        },
      },
      position_name: "พยาบาลวิชาชีพ",
    } as any);
    jest.spyOn(requestRepository, "update").mockResolvedValue();
    jest.spyOn(requestQueryService, "getRequestDetails").mockResolvedValue({
      request_id: 501,
    } as any);

    await service.updateRequest(
      501,
      9001,
      "PTS_OFFICER",
      {
        requested_amount: 2000,
        submission_data: {
          title: "นางสาว",
          first_name: "พีรดา",
        },
      } as any,
      [],
      undefined,
    );

    expect(requestRepository.update).toHaveBeenCalledWith(
      501,
      expect.objectContaining({
        submission_data: expect.objectContaining({
          created_by_officer_id: 9001,
          created_by_officer_role: "PTS_OFFICER",
          created_mode: "OFFICER_ON_BEHALF",
          target_user_id: 2001,
          target_citizen_id: "1100702579863",
          title: "นางสาว",
          first_name: "พีรดา",
        }),
      }),
      connection as any,
    );
  });

  it("allows rate mapping update for legacy on-behalf draft identified from create audit log", async () => {
    jest.spyOn(requestRepository, "findById").mockResolvedValue({
      request_id: 67906,
      user_id: 46409,
      citizen_id: "1570400181863",
      request_no: "REQ-2569-67906",
      status: RequestStatus.DRAFT,
      current_step: 1,
      position_name: "พยาบาลวิชาชีพ",
      submission_data: {
        title: "นางสาว",
        first_name: "กันยกร",
      },
    } as any);
    jest.spyOn(requestRepository, "findRequestCreateAuditMeta").mockResolvedValue({
      actor_id: 9001,
      actor_role: "PTS_OFFICER",
      action_detail: {
        owner_user_id: 46409,
      },
    } as any);
    jest.spyOn(requestRepository, "findRateByDetails").mockResolvedValue({
      rate_id: 104,
      amount: 1500,
      group_no: 1,
      item_no: "1.1",
      sub_item_no: null,
    } as any);
    jest.spyOn(requestRepository, "update").mockResolvedValue();

    const result = await service.updateRateMapping(67906, 9001, "PTS_OFFICER", {
      group_no: 1,
      item_no: "1.1",
      sub_item_no: null,
    });

    expect(requestRepository.findRequestCreateAuditMeta).toHaveBeenCalledWith(67906);
    expect(result).toEqual(
      expect.objectContaining({
        request_id: 67906,
        rate_id: 104,
      }),
    );
  });
});
