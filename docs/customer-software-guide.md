# Golden Luxury Auto customer software guide

Source-verified October 23, 2026. Intended as a factual knowledge-base draft, not
proof that a particular customer's account or third-party integration is working.
The portal only shows records permitted for the signed-in account. A URL containing
`/admin/` can still be an owner-facing page; use the portal's own navigation.

## Sign in and account access

Sign in with your email and password at `/login` or `/admin/login`. Use **Forgot
password?** to request an emailed reset link from `/reset-password`. Password setup
links also use the reset flow. If your email already has an account, use setup/reset
rather than registering again. `/signup` exists for new accounts and can process
pending onboarding submissions. Vehicle access depends on linked owner/onboarding
records. Ask GLA if your car is missing
or your invitation/reset link fails. Do not send passwords or reset links to chat.

## Owner dashboard and vehicles

`/dashboard` opens the dashboard for your current role. Owners also have
`/client/dashboard`. Select the available vehicle/year/month controls to inspect
income, expenses, owner profit, earnings, payment history and report links. `/cars`
and the car's detail page provide vehicle information. Owners can open per-car
Earnings, Totals, Graphs and Charts, NADA Depreciation, purchase details and payment
reports where available. Missing or unverified figures should not be treated as
confirmed zero balances or guaranteed earnings.

Co-hosts have different navigation: My Co-Host Cars, My Profile, fleet accounting,
Co-Host Payments, trip/calendar and tracking tools, and existing Operations vehicle
workflows (trips, issues, maintenance and related tabs) when their account already
has access. My Profile is available through the co-host sidebar; the shared
account menu can also open `/admin/profile` for admin-flagged co-hosts. Their assigned-fleet scope and
available actions differ from an owner account. Do not teach owners to use staff
controls just because a co-host or administrator can see them.

## Income, expenses, payments and statements

Open a vehicle's Income & Expenses or Earnings report and select the relevant year
and period. Owner financial access is view-only. Values with linked receipts can
open the receipt viewer; not every number has an attachment. Payment History shows
recorded payments and any available payment receipts. Income & Expenses provides
**Export ZIP**, which bundles its CSV and available receipts. This is an export of
recorded data, not a promise of an official tax document or a reconciled statement.
No dedicated customer “monthly statement PDF” workflow was verified; request a
formal statement or accounting clarification from GLA.

## Documents and receipts

Use the car's **Records & Files** area and open a record to view its files. Receipt
and file links require the appropriate signed-in account; copying a private storage
URL may not work. Owners can view/download available documents and receipts, but
cannot use financial receipt editing/upload/delete controls reserved for authorized
staff/co-hosts. To submit updated license, registration or insurance documents, use
**Forms → License & Registration or Insurance Updates** and its submission/status
views. A missing attachment does not mean the work or expense never occurred.

## Personal use, requests and leaving the program

Use **Car Block Off** to submit a request for an assigned vehicle for **Personal
Use**, **Maintenance**, or **Others**, with the required pickup/end dates and form
details. Submission is not a chatbot-confirmed reservation or repair appointment;
check the recorded status and coordinate with GLA. Owners/co-hosts are shown the
pickup/start form; staff retain the separate end/drop-off workflow.

Owners have an **Off-boarding Form** for arranging vehicle pickup when leaving the
program. Fill the required car/pickup details and pickup agreement. **List Another
Car** opens onboarding; referral and document-update forms are also available.
Co-host forms additionally include car issues/repairs and incident-related forms,
subject to their role. Owner maintenance history is currently hidden/disabled;
ask GLA for maintenance details rather than directing owners to staff Service Due.

## Trips, tracking and rental instructions

Owners have Trip History, Trip Calendar, vehicle trips, tracking and driving
behavior pages for their permitted cars. Tracking/mileage depends on available
Bouncie records; stale/missing readings are not live guarantees.

Public visitors can choose a location, browse `/fleet` or location fleet pages,
and follow a vehicle's Turo link where provided; otherwise use Contact. The direct
booking preview is currently a super-admin testing route, not a verified public
checkout. `/pick-up-and-drop-off` and its Salt Lake City route contain pickup/return
instructions and videos. Use instructions for the actual booking/location and ask
GLA when uncertain. The detail-shop booking page embeds a GHL appointment calendar;
it is separate from rental booking and from the proposed help chatbot.

## Troubleshooting and human support

If a page fails, retry or refresh, confirm the correct account and selected vehicle/
period, and sign in again if the session expired. For a receipt that fails to open,
open it from the signed-in portal instead of a copied storage link. If the problem
persists, give support the page, vehicle/reservation reference and error text. Avoid
sending passwords, reset tokens or financial documents into general chat.

The owner dashboard currently lists:

- General support: **goldenluxuryauto@gmail.com**, **1-800-346-1394**.
- Account inquiries: **cathy@goldenluxuryauto.com**.
- **Schedule a Zoom Call** links to `https://rent.goldenluxuryauto.com/lyc-client-check-in`.
- Public `/contact`, Training Manual, Turo Guide, and News & Media are additional
  resources. Support hours and response-time guarantees were not verified.

## Bot boundaries

Explain navigation and verified workflows. Do not claim access to private account
records, make up balances/availability, approve requests, promise refunds, or say a
human has been contacted unless the separately configured GHL workflow actually
performs that handoff. Payroll, staff clock-in, user administration and developer
previews are staff functions, not owner self-service features. Operations vehicle
workflows, including Day Schedule and Service Due, are available to co-hosts with
existing access; do not assume a client-only owner has that access. The help widget is approved for launch on customer-facing pages and has no API
integration for reading or changing portal records. Bot activation/settings are
managed separately in GHL.

## Source references for knowledge-base editors

- Routes and guards: `src/App.tsx`, `src/components/admin/auth-guard.tsx`,
  `require-role.tsx`, `admin-layout.tsx`, `src/hooks/use-co-host.ts`.
- Accounts: `src/pages/admin/login.tsx`, `src/pages/reset-password.tsx`,
  `src/pages/signup.tsx`; backend `src/admin-routes.ts` signup handler,
  `src/services/authService.ts` password setup, `src/routes/auth.ts`.
- Owner tools/support: `src/pages/client/dashboard.tsx`,
  `src/components/client/ClientPageLinks.tsx`, `GlaContactCard.tsx`.
- Financial/files: `src/pages/admin/earnings.tsx`, `payments.tsx`, `records.tsx`,
  `view-record-files.tsx`, `income-expenses/components/TableActions.tsx`;
  backend `src/services/receiptAccess.ts`.
- Requests: `src/pages/admin/CarBlockOff.tsx`, `forms.tsx`,
  `src/components/forms/CarOffboardingForm.tsx`; backend `src/routes/carBlockOff.ts`.
- Guest instructions/booking: `src/pages/fleet.tsx`,
  `src/pages/marketing/legacy-pages.tsx`.
- Client maintenance limitation: backend
  `src/services/maintenanceApprovalService.ts` (`CLIENT_MAINTENANCE_VISIBLE=false`).
