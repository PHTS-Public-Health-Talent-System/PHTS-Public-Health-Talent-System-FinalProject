import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ApprovalTimelineCard } from "./ApprovalTimelineCard"
import type { RequestWithDetails } from "@/types/request.types"

const buildRequest = (overrides: Partial<RequestWithDetails> = {}): RequestWithDetails =>
  ({
    request_id: 1,
    request_no: "REQ-2569-0001",
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
    status: "PENDING",
    current_step: 3,
    created_at: "2026-03-04T01:13:02.000Z",
    updated_at: "2026-03-04T01:13:02.000Z",
    step_started_at: "2026-03-04T01:13:02.000Z",
    attachments: [],
    actions: [
      {
        action: "SUBMIT",
        actor: {
          first_name: "หัวหน้า",
          last_name: "กลุ่มงาน",
          role: "DEPT_SCOPE",
        },
        comment: null,
        action_date: "2026-03-04T01:13:02.000Z",
        step_no: 1,
      },
    ],
    ...overrides,
  }) as RequestWithDetails

describe("ApprovalTimelineCard", () => {
  it("shows skipped self-submit note for head department requests", () => {
    render(<ApprovalTimelineCard request={buildRequest()} />)

    expect(screen.queryByText("หัวหน้าตึก/หัวหน้างาน")).not.toBeInTheDocument()
    expect(screen.queryByText("หัวหน้ากลุ่มงาน")).not.toBeInTheDocument()
    expect(screen.getByText("เจ้าหน้าที่ พ.ต.ส.")).toBeInTheDocument()
    expect(screen.getByText("ขั้นตอนที่ 1 จาก 4")).toBeInTheDocument()
  })

  it("uses visible step numbering instead of raw backend step numbers", () => {
    render(<ApprovalTimelineCard request={buildRequest()} />)

    expect(screen.getByText("เจ้าหน้าที่ พ.ต.ส.")).toBeInTheDocument()
    expect(screen.getByText("หัวหน้ากลุ่มงานทรัพยากรบุคคล")).toBeInTheDocument()
    expect(screen.getByText("หัวหน้าการเงิน")).toBeInTheDocument()
    expect(screen.getByText("ผู้อำนวยการ")).toBeInTheDocument()
    expect(screen.queryByText("5")).not.toBeInTheDocument()
    expect(screen.queryByText("6")).not.toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("กำลังดำเนินการ")).toBeInTheDocument()
    expect(screen.getAllByText("รอดำเนินการ").length).toBeGreaterThan(0)
  })

  it("hides skipped ward head step when submitter is HEAD_SCOPE and current flow starts at step 2", () => {
    render(
      <ApprovalTimelineCard
        request={buildRequest({
          current_step: 2,
          actions: [
            {
              action: "SUBMIT",
              actor: {
                first_name: "หัวหน้า",
                last_name: "หน่วยงาน",
                role: "HEAD_SCOPE",
              },
              comment: null,
              action_date: "2026-03-04T01:13:02.000Z",
              step_no: 1,
            },
          ],
        })}
      />,
    )

    expect(screen.queryByText("หัวหน้าตึก/หัวหน้างาน")).not.toBeInTheDocument()
    expect(screen.getByText("หัวหน้ากลุ่มงาน")).toBeInTheDocument()
    expect(screen.getByText("ขั้นตอนที่ 1 จาก 5")).toBeInTheDocument()
  })

  it("does not show in-progress step when request is cancelled", () => {
    render(
      <ApprovalTimelineCard
        request={buildRequest({
          status: "CANCELLED",
          current_step: 1,
        })}
      />,
    )

    expect(screen.getByText("ผู้ยื่นขอยกเลิกก่อนเข้าสายอนุมัติ")).toBeInTheDocument()
    expect(screen.queryByText("กำลังดำเนินการ")).not.toBeInTheDocument()
    expect(screen.queryByText("เจ้าหน้าที่ พ.ต.ส.")).not.toBeInTheDocument()
  })

  it("shows cancelled step when cancel action has step_no", () => {
    render(
      <ApprovalTimelineCard
        request={buildRequest({
          status: "CANCELLED",
          current_step: 3,
          actions: [
            ...buildRequest().actions,
            {
              action: "CANCEL",
              actor: {
                first_name: "ผู้ยื่น",
                last_name: "คำขอ",
                role: "USER",
              },
              comment: null,
              action_date: "2026-03-04T02:13:02.000Z",
              step_no: 3,
            },
          ],
        })}
      />,
    )

    expect(screen.getByText("ผู้ยื่นขอยกเลิกก่อนเข้าสายอนุมัติ")).toBeInTheDocument()
    expect(screen.queryByText("ยกเลิกแล้ว")).not.toBeInTheDocument()
  })

  it("shows cancelled step when cancellation comes from approver flow", () => {
    render(
      <ApprovalTimelineCard
        request={buildRequest({
          status: "CANCELLED",
          current_step: 3,
          actions: [
            ...buildRequest().actions,
            {
              action: "CANCEL",
              actor: {
                first_name: "หัวหน้า",
                last_name: "กลุ่มงาน",
                role: "HEAD_SCOPE",
              },
              comment: null,
              action_date: "2026-03-04T02:13:02.000Z",
              step_no: 3,
            },
          ],
        })}
      />,
    )

    expect(screen.getByText("ยกเลิกที่ขั้นตอน 1 จาก 4")).toBeInTheDocument()
    expect(screen.getByText("ยกเลิกแล้ว")).toBeInTheDocument()
  })
})
