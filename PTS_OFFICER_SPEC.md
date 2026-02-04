# PHTS - PTS Officer Module Specification

## 1. Project Context
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS
- **Role:** PTS_OFFICER (เจ้าหน้าที่ พ.ต.ส.)
- **Goal:** Manage high-volume request verification, payroll, and data quality.

## 2. Core Data Structures (Reference)
(อ้างอิงจากไฟล์ src/types/request.types.ts และ src/features/request/api.ts)
- RequestStatus: PENDING_PTS_OFFICER -> APPROVED / RETURNED / REJECTED
- API Functions: getPendingApprovals, approveBatch, getPeriods, validateData

## 3. UI/UX Wireframes & Workflow

### A. Dashboard (Command Center) - /dashboard/pts-officer
- **Layout:** 4 Cards (Pending Requests, Open Period, Data Quality, License Alerts)
- **Features:** Batch status overview, Quick Action buttons.

### B. Verification List (Batch Actions) - /dashboard/pts-officer/verification
- **UI:** Data Grid (Table) with Checkboxes.
- **Features:**
  - Filter by Department, Period.
  - "Select All" functionality.
  - Floating Action Bar for "Batch Approve".
  - Click row to view Detail.

### C. Payroll Management - /dashboard/pts-officer/payroll
- **UI:** Period List (Table).
- **Features:**
  - View current open period (Status, Count, Total Amount).
  - Actions: Re-calculate, Close Period (Submit to HR).
  - History of past payments.

### D. Data Quality Dashboard - /dashboard/pts-officer/data-quality
- **UI:** Summary Cards (Critical, Warning) + Issue List.
- **Features:**
  - Detect "Over Cap" (Requested > Limit).
  - Detect "Missing Salary".
  - Detect "License Expired".
  - Action: Fix or Return request.

### E. Master Data - /dashboard/pts-officer/master-data
- **UI:** Editable Table for Rates and Rules.
- **Features:** Update rates for each profession/position.

## 4. Implementation Rules
- Use `lucide-react` for icons.
- Use `shadcn/ui` components (Card, Button, Table, Dialog).
- Use `useQuery` / `useMutation` from existing hooks.
- Handle "Loading" and "Empty" states gracefully.