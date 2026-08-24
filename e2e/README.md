# E2E regression suite

Playwright tests for the 5 critical flows, driven through the real UI as a
real user (no API shortcuts except for read-only assertions and admin-only
teardown that has no client-facing equivalent). No application code was
modified to make these tests possible.

## Setup

1. Start both dev servers (`backend`: `npm run dev` on :3000, `frontend`:
   `npm run dev` on :5000).
2. Create the three test accounts + a client fixture + test car (idempotent,
   safe to re-run):
   ```bash
   cd LuxuryAutoPortal-Replit/backend
   set -a && source .env && set +a
   npx tsx src/scripts/e2eSetupFixtures.ts
   ```
3. Install Playwright's browser once: `npx playwright install chromium`.
4. Run the suite from `LuxuryAutoPortal-Frontend`:
   ```bash
   E2E_TEST_CAR_ID=<a real active car id with I&E data> npx playwright test
   ```
   `E2E_TEST_CAR_ID` is only required for flow 4 (payment split vs I&E
   table) — it needs a real car with existing income/expense rows, which
   the fixture script's own test car doesn't have. Any active car works;
   flow 4 only reads figures, it never writes a payment.

## Test accounts

| Role | Email | Password |
|---|---|---|
| Admin | e2e-admin@gla.local | E2eTest@123 |
| Employee | e2e-employee@gla.local | E2eTest@123 |
| Client | e2e-client@gla.local | E2eTest@123 |

The client account is linked (by email match, per `getClientIdFromSession`)
to a dedicated `client` row and one test car (plate `E2ETESTCAR`), so the
parking-ticket flow has something real of its own to submit against without
touching another customer's data.

## Flow-by-flow notes

**1. Employee login** (`01-employee-login.spec.ts`) — passes. Employees
redirect to `/staff/dashboard`, distinct from the admin/client `/dashboard`.

**2. Car onboarding** (`02-car-onboarding.spec.ts`) — **cannot pass as
written; this is a real product bug, not a test defect.** The "Add New Car"
dialog in `CarOnboarding.tsx` is unreachable: `isAddDialogOpen` (line 88) is
only ever set to `false` (lines 197, 608) — no button, icon, or handler
anywhere in the file calls `setIsAddDialogOpen(true)`, and the `Plus` icon
imported at line 43 is never rendered. Confirmed empirically: navigating to
`/admin/forms?section=car-on` and expanding "Car On-boarding" shows the full
table and search/filter UI, with genuinely no way to open the add-car
dialog. The test documents the intended golden path and will start passing
automatically once a trigger is added — no test changes needed.

**3. Parking ticket submission → My Submissions** (`03-parking-ticket-submission.spec.ts`)
— passes, but **not as an Employee**. The "Submit a Parking Ticket" section
is only included in the Admin and Client form-section lists in `forms.tsx`
— it's absent from the plain-Employee section list entirely, so an employee
login cannot reach this feature. Tested as Client instead, since that's the
role the feature is actually built for.

**4. Payment modal owner split vs I&E table** (`04-payment-split-vs-ie-table.spec.ts`)
— **fails consistently, and this is a real calculation bug**, reproduced
against two independent cars (833 and 834) with real income data. Both
`AddEditPaymentModal.tsx` and `IncomeExpenseTable.tsx` independently
reimplement the same `calculateCarOwnerSplit` formula. For car 833, July
2026 (real `rental_income=1226.00`, `delivery_income=125.00`): the payment
modal correctly computes **$546.02**, while the I&E table's own copy of the
row renders **$0.00** for every month of the year for that car. Worth
triaging before this suite gates a refactor — the two formulas have drifted,
exactly the kind of duplication risk flagged separately in the jscpd
duplication report for this codebase.

**5. Dashboard Mountain-Time bucketing** (`05-dashboard-mt-day-bucketing.spec.ts`)
— passes. `CarBlockedOffSection.tsx` has no visible MT-day column; it's a
client-side filter that hides any block-off whose planned end date (in
Mountain Time) is before today. The test proves the boundary is handled
correctly by submitting two real block-offs as a client through the actual
Car Block Off form — one ending yesterday (MT), one ending later today (MT)
— and asserting the admin dashboard shows only the second. Cleans up both
test submissions afterward (via admin delete, since clients can't delete
their own block-off submissions).

## Known environment caveats

- The dev backend runs real cron jobs (Bouncie sync every 10s, Turo email/API
  sync) that compete for CPU/DB connections and can make page loads
  noticeably slower than production. Timeouts in `playwright.config.ts` and
  `helpers/auth.ts` are set generously (30–90s) to absorb this; a properly
  deployed/warmed environment should be faster.
- `loginAs()` cannot be called twice on the same `page` without calling
  `logout()` in between — `admin/login.tsx` redirects straight to
  `/dashboard` if a session cookie is already present, so a second login
  attempt silently no-ops instead of switching accounts.
