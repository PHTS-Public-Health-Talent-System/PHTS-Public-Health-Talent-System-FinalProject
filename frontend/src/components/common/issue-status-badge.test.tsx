import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { IssueStatusBadge } from "./issue-status-badge"

describe("IssueStatusBadge", () => {
  it("shows blocker state when blockerCount > 0", () => {
    render(<IssueStatusBadge checkCount={3} blockerCount={2} warningCount={1} />)
    expect(screen.getByText("หยุดจ่าย (2)")).toBeInTheDocument()
  })

  it("shows warning state when only warning exists", () => {
    render(<IssueStatusBadge checkCount={3} blockerCount={0} warningCount={2} />)
    expect(screen.getByText("ตรวจสอบ (2)")).toBeInTheDocument()
  })

  it("shows normal state when no issue", () => {
    render(<IssueStatusBadge checkCount={0} blockerCount={0} warningCount={0} />)
    expect(screen.getByText("ปกติ")).toBeInTheDocument()
  })
})
