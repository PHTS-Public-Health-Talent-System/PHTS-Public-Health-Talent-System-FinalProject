# Sync Users From Profiles and Support Staff

## Summary
Reorder the sync workflow so `emp_profiles` and `emp_support_staff` are synced before `users`. Then derive `users` from these tables to ensure `users.is_active` reflects HR status and login entitlement.

## Goals
- Ensure `users.is_active` is computed from HR data: active if either `emp_profiles.original_status` starts with "ปฏิบัติงาน" or `emp_support_staff.is_enable_login = 1`.
- Keep user deactivation as a soft disable (`is_active = 0`), not a delete.
- Reduce reliance on `vw_hrms_users_sync` for existence/activation; use it only for new user passwords.

## Non-Goals
- Changing HR source schemas or view definitions.
- Hard-deleting users.
- Altering role assignment logic.

## Proposed Flow
1. Sync `emp_profiles` from `vw_hrms_employees`.
2. Sync `emp_support_staff` from `vw_hrms_support_staff`.
3. Build a combined citizen_id set from both tables.
4. Upsert `users`:
   - `is_active = is_active_profile OR is_active_support`.
   - If user exists and has `password_hash`, keep it.
   - If user is missing and a password is available from `vw_hrms_users_sync`, create with role `USER`.
   - If no password exists, skip creation and log a warning.
5. Any `users` not in the combined set are set `is_active = 0`.
6. Continue with signatures, licenses, quotas, leaves, movements, scopes, roles.

## Data Rules
- `is_active_profile`: `original_status` starts with "ปฏิบัติงาน".
- `is_active_support`: `is_enable_login = 1`.
- Final activation: OR across sources.

## Edge Cases
- Citizen IDs missing in password view: skip create; do not insert empty passwords.
- Unknown status values: treated as inactive.
- No overlap between support and profile rows (verified in current data).

## Error Handling
- Keep transaction boundaries for data sync tables.
- User creation failures should be logged and not break the sync.

## Testing
- Unit tests for activation logic (profile active, support active, both inactive).
- A dry-run query to confirm counts of active vs inactive before/after.
