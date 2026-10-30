# Driver chart review and workspace home location

Implemented October 30, 2026 on branch `driver-chart-review`.
Backend base: `ed7731fef470b10d3c756a9f95dd0baf5668d795`.
Frontend base: `82ef51a2c2e4a89f2b0673142b62a7d40e076734`.

## Driver charts

Operations → Chart Management is visible and accessible only to an active employee
with the operational Manager role. Being an admin or super-admin alone does not
grant access. An admin assigns roles under HR → Employees → employee → Job and Pay
→ Employee roles. Car Driver controls chart participation, independently of Manager.

Charts default to the current month in the viewer's timezone. Parking includes only
receipt-bearing pending/approved forms linked to verified airport-return trips.
Unverified, declined, missing-receipt, invalid and $40+ parking entries are excluded
from both cost and trip count by default. Normal Include after review can include
an expensive ticket once its airport-return link is verified. Force include, added
by explicit owner request, overrides the price/link rules with a required manager
reason. A selected active Car Driver, valid amount, eligible receipt status and
workspace access are still required. Multiple linked forms for one trip count as
one trip. Each forced entry without a verified link counts once, labeled in both
review and rankings; repeated loading does not duplicate it. Gas Reimbursed ranks total submitted amounts, not payroll payments.

The review page flags $40+ source tickets red even after a lower adjustment. Managers
can change attribution, date, amount or inclusion; choose No one to exclude; and add
manual chart entries. Parking references accept a unique Turo reservation number,
`turo:ID` or `owner_rental:ID`. The server verifies the car, account, cancellation
state and actual airport return. Manual entries are labeled as such. Chart overrides
do not alter original forms, expenses or accounting. Each edit requires a reason,
records actor/version/history, rejects stale saves, and uses idempotent manual-create
request IDs to avoid duplicate entries on retry.

Storage follows the existing additive ensure-table pattern:
`driver_chart_adjustments`, `driver_chart_adjustment_history`.
No source expense rows are rewritten or deleted.

## Home location and employer privacy

A shared `/api/me/workspace-context` resolves the user's saved preference, employee
home address, or co-host employer address/fleet locations. Utah maps to slc;
Wilmington/Leland/North Carolina maps to wilmington. GLA users with no recognized
home default to Utah. A co-host's choices are restricted to their employer's fleet
locations and recognized home location. View as uses the effective employer and
cannot overwrite the original admin's preference. Settings/Profile contains the
saved Home location control in the existing account-settings pages.

Home defaults apply to Operations (including Day Schedule, Service Due and its
calendar/history), Cars state filters, fleet/master/service calendars, trip
calendars, and the isolated developer direct-booking pickup preview. An explicit
page filter remains selectable and does not change the saved home. Explicit car
links and public market URLs keep their selected context. Finance pages tied to a
specific vehicle retain that vehicle. Location is not an authorization boundary.

Server employee scoping separates GLA from co-host teams, even in the same city.
Co-host employees inherit their employer's scope. Roster consumers, schedule shifts,
Day Schedule assignments and name-only driver labels, chart endpoints and expense
form options use the permitted roster. Generic form submissions reject employee or
car IDs outside that workspace. Existing View as Co-host remains the way an admin
enters that employer's workspace. Ambiguous employer identities fail closed.

The additive `user_workspace_preferences` table stores only the selected home
location. Calendar car responses add optional locationTag; no auth permissions,
public booking writes or accounting behavior are changed.

## Validation and release

Backend focused tests cover exclusion math, exact Manager checks, employee/co-host
scope, location inference and preference restrictions, adjustment transactions,
concurrent edits/retries, expense-form scope and calendar metadata. Both production
builds, frontend lint, duplication thresholds and git diff whitespace checks passed.
The existing service-workspace due-soon test now pins its clock to October 20 so
calendar-date passage does not change its expected fixture status.

Seven fixture browser scenarios passed: manager review at 390 and 1440 widths;
admin without Manager denied; manual entry saves; Wilmington default/choices;
Utah Cars and calendar defaults/manual override; and isolated direct-booking pickup
defaults. Screenshots in /workspace/artifacts/chart-management-390.png and
chart-management-1440.png contain fixture data only. No real forms or notifications
were submitted.

Relevant commands:

```sh
# Backend repository
npm --prefix backend test -- src/services/__tests__/driverChartPolicy.test.ts src/services/__tests__/driverChartReview.test.ts src/services/__tests__/workspaceScopes.test.ts src/services/__tests__/workspaceLocation.test.ts src/routes/__tests__/driverChartManagement.test.ts src/routes/__tests__/clientReceiptFiles.test.ts
npm --prefix backend run build
# Frontend repository
npm run lint
npm run build
npx playwright test --config playwright.chart-review.config.ts
```

Release follows the existing fast-forward main pushes to Render and Vercel. Both
backend and frontend updates are required. Public Golden and deployment-status
requests are blocked by this environment's proxy, so local checks and pushed Git
refs do not establish production availability. After automatic deployment, verify
with an actual Manager and a non-Manager, one Utah GLA employee and one Wilmington
co-host employee: home defaults, own-team pickers/assignments, chart exclusion and
a reviewed entry. Do not create artificial accounting receipts for that check.

## Chart-only override and receipt review update

Managers choose Employee (charts only) and Force include to attribute a receipt to
a different driver. Only driver_chart_adjustments/history are written. The source
form's employee, uploader, amount, attachments, accounting and payroll stay intact.
The card and edit dialog distinguish the chart employee from the form employee.
Force include is labeled, and an unverified entry's one-trip counting is disclosed.
It does not bypass team access, Car Driver eligibility, invalid amounts, missing
receipts or declined status. No one remains excluded.

When a parking receipt lacks a task/reference link, the chart now matches its car
and receipt date against existing Turo airport-return pickup tasks. Vehicle VIN/plate
identity is confirmed through the canonical calendar matcher, not model names.
Only noncancelled trips/tasks and airport returns qualify. Date matching uses the
car location's timezone (Utah Mountain; Wilmington Eastern), handles DST, and checks
scheduled and actual completion dates for carryovers. Repeated tasks for the same
trip collapse to one candidate; multiple different matching trips remain for review.
This derives chart linkage without rewriting the original form. Normal manager
inclusion also tries this match before requiring a manually entered reference.

View receipts is available on cards and inside the edit dialog. Original images/PDFs
open in the existing authenticated in-app viewer. The new manager-only list and file
endpoints check chart source/current ownership and use database-held references:
GET /api/operations/chart-management/:key/receipts
GET /api/operations/chart-management/:key/receipts/:index/file
They return no raw storage URLs and cannot fetch arbitrary caller-provided URLs.
Manual entries with no source form show no attachments; missing original files show
a readable error. File responses are private/no-store and use the existing browser
safe receipt conversion.

Focused update checks: 29 backend tests across the chart policy/review/rankings and
manager-route files passed (including scoped receipt delivery, force reassignment,
missing/ambiguous trips and Mountain/Eastern DST dates). Eight browser scenarios
passed across the focused runs: mobile/desktop review and force attribution,
non-Manager denial, original image/PDF previews, authenticated file fetches and
missing-file errors. Frontend TypeScript, both production builds, duplication
thresholds and diff whitespace checks passed. These checks use fixtures, not
production receipt/accounting writes. Live rollout remains subject to the existing
proxy limitation described above.

## Monthly charts, review queues and employee requests

Chart Management now includes the same live Airport parking average and Gas
Reimbursed charts as Day Schedule, using the manager page's selected month and
location. Entry review filters (All entries, Reviewed, Unreviewed) show counts and
do not change the monthly chart totals. Sort choices are review requests first
(default), newest date, oldest date and highest amount.

Existing chart adjustments count as reviewed unless explicitly reopened. New
unedited source receipts start unreviewed. Saving a chart edit marks it reviewed;
managers can also Mark reviewed or Mark unreviewed independently, using a scoped
PATCH /api/operations/chart-management/:key/review endpoint with an optimistic
review version. Review status is not expense approval and never changes inclusion,
attribution, reimbursement or accounting. Status changes retain actor, time, version
and history. Reopening a requested entry makes it yellow again.

The Day Schedule airport receipt dialog adds an optional Request manager review
checkbox with a required reason when selected. An information icon opens help on
mouse hover or touch/keyboard activation. It explains special circumstances and
that this request does not automatically include a ticket or approve reimbursement.
It is not shown on gas forms. The submitted vehicle, employee, amount and linked
airport pickup task are preserved. Ordinary unchecked submissions stay unchanged.

A request is saved in the same MySQL transaction as the original receipt and task
assignment. A failed request insert rolls back the expense so retry cannot lose
the request. Existing airport-task uniqueness and retry recovery remain in place.
Managers see a yellow requested-review card with the employee's reason while it is
unreviewed; $40+ anomaly text remains red. Requests are not an exemption from the
existing chart rules or a grant of manager access.

New additive tables follow the existing ensure-table pattern:
driver_chart_review_requests, driver_chart_review_status and
driver_chart_review_status_history. These are separate from the accounting form
and chart adjustment data. Review status history appears beside chart edit history.
The manager page refreshes on focus and every minute; a successful inline receipt
submission also invalidates chart/review queries.

Focused checks cover atomic receipt/request commit and rollback, malformed or
unlinked request rejection, manager-only review updates, stale review versions,
employer scoping, unchanged chart inclusion after marking reviewed, monthly charts
and filters, yellow request priority, desktop hover, mobile tap and optional/required
form behavior. Fixture browser checks submit no real receipts or notifications.
