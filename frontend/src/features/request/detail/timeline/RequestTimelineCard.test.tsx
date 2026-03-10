import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RequestTimelineCard } from "./RequestTimelineCard"
import { buildTimelineRequest } from "./test-fixtures"

describe("RequestTimelineCard", () => {
  it("renders officer-created timeline when request metadata says officer-on-behalf", () => {
    render(
      <RequestTimelineCard
        request={buildTimelineRequest({
          status: "APPROVED",
          current_step: 7,
          submission_data: {
            created_mode: "OFFICER_ON_BEHALF",
            created_by_officer_id: 49005,
            created_by_officer_role: "PTS_OFFICER",
          },
        })}
      />,
    )

    expect(screen.getByText("ส่งคำขอโดยเจ้าหน้าที่ พ.ต.ส.")).toBeInTheDocument()
  })

  it("renders normal approval timeline for regular requests", () => {
    render(<RequestTimelineCard request={buildTimelineRequest()} />)

    expect(screen.queryByText("ส่งคำขอโดยเจ้าหน้าที่ พ.ต.ส.")).not.toBeInTheDocument()
    expect(screen.getByText("หัวหน้าการเงิน")).toBeInTheDocument()
  })
})
