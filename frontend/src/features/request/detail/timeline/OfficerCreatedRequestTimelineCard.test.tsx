import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OfficerCreatedRequestTimelineCard } from "./OfficerCreatedRequestTimelineCard"
import type { RequestWithDetails } from "@/types/request.types"

const buildRequest = (overrides: Partial<RequestWithDetails> = {}): RequestWithDetails =>
  ({
    request_id: 67913,
    request_no: "REQ-2569-67913",
    user_id: 1,
    citizen_id: "1234567890123",
    personnel_type: "CIVIL_SERVANT",
    current_position_number: null,
    current_department: null,
    work_attributes: { operation: true, planning: false, coordination: false, service: true },
    main_duty: null,
    request_type: "NEW_ENTRY",
    requested_amount: 1000,
    effective_date: "2026-03-04",
    status: "APPROVED",
    current_step: 7,
    created_at: "2026-03-04T01:13:02.000Z",
    updated_at: "2026-03-04T01:13:02.000Z",
    step_started_at: null,
    attachments: [],
    actions: [
      {
        action: "SUBMIT",
        actor: { first_name: "พตส", last_name: "ทดสอบ" },
        comment: null,
        action_date: "2026-03-04T01:13:02.000Z",
        step_no: 1,
      },
    ],
    ...overrides,
  }) as RequestWithDetails

describe("OfficerCreatedRequestTimelineCard", () => {
  it("renders a simplified completed flow for approved officer-created requests", () => {
    render(<OfficerCreatedRequestTimelineCard request={buildRequest()} />)

    expect(screen.getByText("บันทึกคำขอแทนบุคลากร")).toBeInTheDocument()
    expect(screen.getByText("ส่งคำขอโดยเจ้าหน้าที่ พ.ต.ส.")).toBeInTheDocument()
    expect(screen.getByText("อนุมัติแล้ว")).toBeInTheDocument()
    expect(screen.getByText("ดำเนินการเสร็จสิ้น")).toBeInTheDocument()
  })

  it("keeps the last step pending for officer-created drafts", () => {
    render(
      <OfficerCreatedRequestTimelineCard
        request={buildRequest({
          status: "DRAFT",
          actions: [],
          updated_at: "2026-03-04T01:13:02.000Z",
        })}
      />,
    )

    expect(screen.getByText("อนุมัติแล้ว")).toBeInTheDocument()
    expect(screen.getByText("บันทึกคำขอแทนบุคลากร")).toBeInTheDocument()
    expect(screen.getByText("กำลังดำเนินการ")).toBeInTheDocument()
  })
})
