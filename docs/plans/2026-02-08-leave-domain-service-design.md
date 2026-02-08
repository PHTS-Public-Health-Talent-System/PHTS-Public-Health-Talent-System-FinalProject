# Leave Domain Service (Real-time Quota Analysis) Design

## Summary
We will centralize leave-quota analysis inside the Leave Records Module as a domain service. Other modules (payroll, alerts, UI) will consume the service output rather than re-implementing logic. The service computes per-leave-type `limit`, `used`, `remaining`, `overQuota`, and `exceedDate` in real time, with a short TTL cache to reduce DB load.

## Goals
- Single source of truth for leave rules, quota usage, and over-quota detection.
- Real-time results consistent with current leave records and extensions.
- Safe integration with existing payroll calculations and UI.

## Non-Goals
- No schema changes in this iteration.
- No batch precompute jobs.

## Data Sources
Tables (existing):
- `leave_records` (base leave data)
- `leave_record_extensions` (document dates, return report status, is_no_pay, pay_exception, local_status)
- `leave_quotas` (vacation quota only from HRMS view; personal/sick limits from rules)
- `cfg_holidays` (holiday calendar)

Rules:
- `LEAVE_RULES` in `phts-project/backend/src/modules/payroll/payroll.constants.ts`
- Fiscal year: Oct–Sep (same as payroll)

Date precedence:
- Use `document_start_date`/`document_end_date` if present; otherwise use `leave_records.start_date`/`end_date`.

## Architecture
### Domain Service (new)
Location: `phts-project/backend/src/modules/leave-records/services/leave-domain.service.ts`

Key APIs:
- `getLeaveQuotaStatus(citizenId: string, fiscalYear: number)`
  - Returns per-leave-type status: `limit`, `used`, `remaining`, `overQuota`, `exceedDate`.
- `getLeaveQuotaSummary(citizenId: string, fiscalYear: number)`
  - Summarized view (e.g., types exceeded, totals).

### Repository (extend)
Location: `phts-project/backend/src/modules/leave-records/repositories/leave-records.repository.ts`

Add read helpers:
- `findLeaveRowsForQuota(citizenId, fiscalYear)` returning leave rows with extension fields and normalized date fields.
- `findHolidaysForYear(year)` returning active holidays.
- `findQuotaRow(citizenId, fiscalYear)` returning `leave_quotas` row.

### Cache
- In-memory TTL cache in service.
- Key: `quotaStatus:{citizenId}:{fiscalYear}`
- TTL: 60s (configurable)

## Calculation Rules
### Limit
- Use `LEAVE_RULES` as baseline.
- `vacation`: limit from `leave_quotas.quota_vacation` (if not present, treat as `null` meaning unlimited for deduction logic).
- `personal`: if first fiscal year of service, limit = 15.
- `ordain`: if service < 1 year, limit = 0.

### Used
- Business days for: `sick`, `personal`, `vacation`, `wife_help`.
- Calendar days for: `maternity`, `ordain`, `military`, `education`, `rehab`.
- Holidays from `cfg_holidays` are excluded from business-day counts.
- `is_no_pay` or `pay_exception` leaves are excluded from `used`.

### Over Quota
- `used > limit` → `overQuota = true`.
- `exceedDate` is computed using same logic as payroll (first day when remaining quota is exceeded).

## Data Flow
1. Consumer calls `getLeaveQuotaStatus`.
2. Service loads leave rows + extensions, quota row, and holidays.
3. Service normalizes dates (document dates when present) and computes used days by leave type.
4. Service computes limits and over-quota status.
5. Result cached for 60s and returned.

## Error Handling
- Missing `leave_quotas`: fallback to `LEAVE_RULES` limits (vacation remains `null` if no quota).
- Missing holidays: compute business days using Mon–Fri only.
- Invalid date ranges (end < start): skip record and log warning.

## Integration Points
- Payroll: replace direct quota/usage logic with service call.
- Alerts: use service to determine over-quota or near-limit signals.
- Leave Management UI: consume service result for display.

## Testing Strategy (TDD)
Unit tests in `backend/src/modules/leave-records/__tests__/`:
1. Business days exclude weekend/holiday.
2. Calendar days count all days.
3. Document dates override leave record dates.
4. Vacation quota uses `leave_quotas`.
5. First-year personal leave limit = 15.
6. Ordain leave limit = 0 when service < 1 year.

## Open Questions
- Vacation limit when `leave_quotas` missing: `null` (no limit) vs `0` (disallow). Current payroll treats `null` as no limit.
- Whether to include rejected/canceled leaves in usage (default: include only active records; decision needed).

