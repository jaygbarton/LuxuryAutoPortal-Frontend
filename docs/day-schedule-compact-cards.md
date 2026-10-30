# Compact Day Schedule cards

Implemented October 30, 2026 in isolated `day-schedule-compact` worktrees.
Frontend starting base: `2660e6d3c4a533d2de17f1a5c968e2ab77a535fe`.
Backend starting base: `110547cc5b4c3347b0ab1508c44445ed78f432d3`.

## Behavior

- Timeline shows all operational events in time order, with unassigned work in
  the same list and no duplicate assignment sidebar. Employee view retains saved
  My tasks first behavior and groups other work by employee, then time.
- A whole-card keyboard-accessible trigger displays the task time, vehicle name,
  photo, plate, source and task badges, and flashing yellow trip extras. No guest,
  reservation, profile, status selector or separate action buttons appear on it.
- Source badge: Turo purple; owner rental and future live direct booking gold.
  The separate left border/task badge retains the task category's existing color.
- Clicking opens a bounded, scrollable dialog with the existing status, assignment,
  driver, duration, delete, receipt, photos and booking-navigation controls according
  to the existing event permissions. Nothing changes authentication or authorization.
- Airport/gas actions close the task dialog before opening the existing receipt
  dialog. The airport completion gate and expense/refuel behavior remain intact.
- Extras respect reduced-motion preferences with a solid yellow background.
  Photos use the existing shared source/fallback chain; absent photos show a car
  icon. No unrelated vehicle photo is substituted.

## Owner rental events

The backend already projects approved personal-use car_block_off rows into three
stable event identities; no duplicate persistent jobs are inserted here. The UI
now makes these rental jobs visibly distinct from the underlying block-off status.
Owner pickup at trip start (`owner_pickup`) is labeled **Drop Off** from the
employee's perspective; cleaning remains at trip start; owner return
(`owner_dropoff`) is labeled **Pick Up** at the return time. Existing per-leg
assignees and source keys remain unchanged. Point-in-time jobs no longer show
an unrelated return time as their end time. Existing block-off lifecycle controls
are preserved; no new per-leg completion database schema was introduced.

## Existing source limitations

The current direct-booking software has isolated developer UUID previews, but
no live direct-booking source (`getInternalCalendarEventByKey` explicitly returns
null for future direct_booking keys). Presentation and return actions recognize
future real direct-booking events, but previews are not promoted to employee jobs
or converted into real bookings. Creating that live source is separate work.

Owner personal-use records currently have no structured extras field; their
schedule projection returns extras=null. Existing Turo extras remain displayed
and flashing. This change does not infer extras from notes or fabricate data.

## Checks and previews

32 focused browser scenarios and 14 backend tests passed (with failing checks
corrected and rerun). Both production builds, frontend TypeScript, and both
worktree diff checks passed.

Focused backend checks cover owner start/return days, labels, assigned employees,
photos, booking-key separation, maintenance spans and block-off visibility.
Browser checks cover desktop/phone cards, chronological ordering, popup controls,
booking links, four mobile receipt sizes (including 390x500), parking/gas submission
and retry, unassigned search/assignment and saved employee priority.
All browser API writes use fixtures; no real trips, receipts or tasks are submitted.

```sh
# Frontend
npm run lint
npm run build
npx playwright test --config playwright.day-schedule-cards.config.ts e2e/day-schedule-cards.spec.ts e2e/day-schedule-booking.spec.ts e2e/day-schedule-receipts.spec.ts
npx playwright test --config playwright.day-schedule-cards.config.ts --grep "Day Schedule keeps"
# Backend (from backend/)
npm run build
npm test -- src/services/__tests__/dayScheduleBookingKeys.test.ts src/services/__tests__/dayScheduleBlockOffVisibility.test.ts src/services/__tests__/dayScheduleMaintenanceAppointments.test.ts
```

Coding-workspace screenshots (mock records; not production customer data):
`/workspace/artifacts/day-schedule-timeline-1280.png`,
`/workspace/artifacts/day-schedule-timeline-390.png`,
`/workspace/artifacts/day-schedule-controls-1280.png`,
`/workspace/artifacts/day-schedule-controls-390.png`.

No live runtime verification is claimed: this session's network proxy blocks the
public Golden domain and deployment-status API with 403 Forbidden. The existing
release path is scoped fast-forward pushes to main for Vercel/Render automatic
deployments. Confirm Ready/Live and refresh existing browser tabs after release.
