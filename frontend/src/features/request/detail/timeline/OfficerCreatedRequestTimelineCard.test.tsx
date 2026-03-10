import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OfficerCreatedRequestTimelineCard } from "./OfficerCreatedRequestTimelineCard"
import { buildTimelineRequest } from "./test-fixtures"

describe("OfficerCreatedRequestTimelineCard", () => {
  it("renders a simplified completed flow for approved officer-created requests", () => {
    render(
      <OfficerCreatedRequestTimelineCard
        request={buildTimelineRequest({
          status: "APPROVED",
          current_step: 7,
          step_started_at: null,
          actions: [
            {
              action: "SUBMIT",
              actor: { first_name: "พตส", last_name: "ทดสอบ" },
              comment: null,
              action_date: "2026-03-04T01:13:02.000Z",
              step_no: 1,
            },
          ],
        })}
      />,
    )

    expect(screen.getByText("บันทึกคำขอแทนบุคลากร")).toBeInTheDocument()
    expect(screen.getByText("ส่งคำขอโดยเจ้าหน้าที่ พ.ต.ส.")).toBeInTheDocument()
    expect(screen.getByText("อนุมัติแล้ว")).toBeInTheDocument()
    expect(screen.getByText("ดำเนินการเสร็จสิ้น")).toBeInTheDocument()
  })

  it("keeps the last step pending for officer-created drafts", () => {
    render(
      <OfficerCreatedRequestTimelineCard
        request={buildTimelineRequest({
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
