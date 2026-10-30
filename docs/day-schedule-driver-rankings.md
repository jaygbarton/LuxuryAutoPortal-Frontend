# Day Schedule: operational roles and monthly driver rankings

Implemented October 30, 2026 in isolated `day-schedule-driver-rankings` worktrees.
Frontend base `98d33bb8c3b2c87bd9d6e911e99b9a7799637ab0`;
backend base `75806c7ad867cb1d55dfdc17b01f8c8b600a64f5`.

## Workflow and layout

Day Schedule opens in Timeline by default. By Employee remains selectable; its
saved employee-priority and expanded Unassigned behavior still apply in that view.
Collapsed cards in both views show the task's own location beneath the car name,
wrapping long addresses on mobile. Missing locations say Location not set. No
additional inline actions or location guesses from the opposite trip leg are added.

Vehicle photos are larger (96×64 on phones, 112×80 from the small breakpoint),
with a larger bold plate immediately to their left. TV Timeline has been removed
from Operations navigation and its unused screen deleted. Existing TV Timeline
URLs replace themselves with Day Schedule, preserving date and booking parameters.

Unassigned opens expanded, with search and all cards available. Existing receipt
submission assigns only its explicitly linked unassigned task to the employee
selected on the form; the task then appears under that employee. Existing
assignments are preserved. The existing saved employee-priority behavior remains.

Cards show a red Carried over badge immediately after the Turo/owner source badge
when the scheduled day precedes the viewed schedule day and work remains
unfinished. Completed, delivered, no-issues and cancelled work is excluded, as are
records with an actual completion date. Operation tasks with null/blank status
now count as new for the existing past-day carryover query.

Driver receipt charts stack vertically on the right at desktop widths, below the
schedule on phones. The month selector defaults to the current month in the
viewer's configured timezone. Receipt date determines the month; changing the
schedule's selected day does not change the chart month. The existing location
filter scopes chart receipts as well. Gas/parking submission refreshes the charts;
other updates are picked up on focus or the 60-second refresh.

## Employee roles

HR → Employees → employee → Job and Pay → Employee roles supports multiple work
roles and custom roles. Car Driver qualifies an active employee for both charts.
This changes operational classification only; login/account authorization and the
existing job/pay title are unchanged. Roles are stored in the additive
`employee_operational_roles` table, created through the existing ensure-table
pattern. Before an explicit assignment is saved, existing job titles are used as
roles (comma/semicolon/pipe-separated). An explicitly saved empty list remains
empty. Car Driver matches case, space, underscore and hyphen variants.

Only admins can edit these roles. Co-host admins can access only their scoped
employees. Edits record actor, old list and new list in profile edit history.

## Calculation rules

- Both charts use actual receipt-bearing reimbursed-bills forms and the form's
  selected employee ID, never the uploader ID or a guessed name.
- Pending and approved submissions are included. Declined, invalid/negative
  amounts and forms without receipts are excluded. Pending counts are displayed;
  a submitted gas amount is not represented as a confirmed payroll payment.
- Airport parking: sum amounts ÷ distinct linked trips, lowest average first.
  Multiple parking forms on one linked trip count as one trip. Only verified
  airport-return trips count by default. Missing links are matched automatically
  using the vehicle and receipt date against airport-return pickup tasks. A Manager
  can Force include an unresolved entry with a reason; each unlinked forced entry
  counts once, labeled in review and rankings.
  Tickets of $40 or more are excluded from both numerator and denominator unless
  a Manager explicitly includes them after review. Lowering an adjustment below
  $40 does not remove the original ticket's review requirement.
- Gas Reimbursed: sum submitted amounts, highest first. Gas Not Reimbursed and Gas
  Service Run are not included. Stable standard field values and dynamic field
  labels resolve the existing form types.
- Currency is summed in integer cents. Zero-cost receipts are legitimate data.
  Eligible employees without receipts show No data at the bottom, not a fake $0
  parking average. Only active employees with Car Driver are eligible, including
  when viewing earlier months; changing current roles changes participation.
- Co-host vehicle and employee restrictions are applied on the server. The
  endpoint requires admin/employee access and returns only employee display names,
  IDs and aggregate figures. Month/date/location parameters are validated.

## Source and checks

Backend: `employeeOperationalRolesService.ts`, `dayScheduleDriverRankingsService.ts`,
`routes/employeeOperationalRoles.ts`, employee-route registration, and the existing
Day Schedule carryover query. Frontend: `EmployeeOperationalRoles.tsx`, its profile
mount, `DayScheduleDriverRankings.tsx`, and the Day Schedule layout/badge/default.

15 backend tests and 22 browser scenarios passed. Both TypeScript/build checks and
worktree diff checks passed. Tests use fixture APIs/data and do not submit real
forms, send notifications, or modify real employees. Coverage includes multi-role
persistence and access scope, expense classification and math, distinct trips,
zero/missing amounts, month defaults/leap-year boundaries, responsive layout,
expanded Unassigned, carryover badges, and the existing receipt assignment/retry
flows.

```sh
# Backend repository
npm --prefix backend test -- src/services/__tests__/dayScheduleDriverRankings.test.ts src/routes/__tests__/employeeOperationalRoles.test.ts src/services/__tests__/dayScheduleBookingKeys.test.ts
npm --prefix backend run build
# Frontend repository
npm run lint
npm run build
npx playwright test --config playwright.driver-rankings.config.ts
```

Preview screenshots contain fixture data, not real employee totals:
`/workspace/artifacts/day-schedule-driver-charts-1440.png` and
`/workspace/artifacts/day-schedule-driver-charts-390.png`.

Release uses scoped, non-force main pushes into the existing Render/Vercel path,
with current remote changes checked before integration. Runtime deployment cannot
be confirmed from this session because the public Golden domain and provider
status API are blocked by the network proxy. The backend must be deployed along
with the frontend so role storage and chart endpoints are available.
