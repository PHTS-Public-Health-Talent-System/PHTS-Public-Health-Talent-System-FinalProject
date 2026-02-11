# Navigation API Integration Design

## Goals
- Replace sidebar mock data with a single API-backed source of truth for all roles.
- Reduce duplicate frontend menu logic while keeping UI structure unchanged.
- Provide badge counts (e.g., notifications, pending requests) in the same response.

## Non-Goals
- Dynamic CMS-like sidebar editing.
- Download/export changes.

## Approach (Chosen)
**Single endpoint**: `GET /api/navigation` returns role-based menu + user display info + badge counts.

### Payload Shape (draft)
```json
{
  "success": true,
  "data": {
    "user": { "id": 123, "name": "พรทิพย์ สุขใจ", "role": "HEAD_HR" },
    "badges": {
      "notifications": 3,
      "pendingRequests": 12,
      "pendingPayroll": 2
    },
    "menu": [
      { "label": "แดชบอร์ด", "href": "/head-hr", "iconKey": "LayoutDashboard" },
      { "label": "คำขอ", "href": "/head-hr/requests", "iconKey": "Inbox", "badgeKey": "pendingRequests" }
    ]
  }
}
```

### Icon Strategy
Backend returns `iconKey` only. Frontend maps `iconKey` → Lucide icon to avoid sending SVG.

### Caching
- Frontend `staleTime: 5 minutes`, `cacheTime: 15 minutes`.
- Invalidate query on login/logout or role change.

## Data Sources
- `notifications` badge: existing notifications API/service.
- `pendingRequests` badge: existing request status counts.
- `pendingPayroll` badge: payroll status counts (if applicable for role).

## Error Handling
- If API fails: fallback to static menu for that role.
- If badge missing: hide or show `0`.

## Tests
- Backend: unit test service per role.
- Frontend: `UnifiedSidebar` icon mapping + fallback path test.

## Rollout
1. Add backend `navigation` module (route/controller/service).
2. Add frontend `features/navigation` (api/hooks/types).
3. Update sidebars (user/head-hr/admin/director/finance-officer/pts-officer) to use API.
4. Verify lint/typecheck.
