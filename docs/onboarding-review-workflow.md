# LYC accounts, applications and reviewed onboarding

## Agreed sequence

**Create applicant account → complete and submit vehicle application → GLA approval → contract sent and signed → client access → create off-fleet vehicle record → vehicle drop-off.**

Approval alone creates neither a new Client Database profile nor client permissions. A restricted applicant stays in Applicants until an approved application has a signed status, signature timestamp and stored signed contract. Signing creates or links the client profile and promotes the applicant login without changing the password. Existing clients retain their established access while adding another vehicle.

The signature is saved before conversion. If conversion fails, it is preserved, the response explains that account setup needs review, and admins can retry **Complete signed client setup** / **Move account to Clients**. These recovery actions enforce the same signed-proof requirement. New manual client creation and new client-role grants cannot bypass that requirement. Established legacy clients are not retrospectively revoked because their historical contract is stored elsewhere.

Vehicle creation is explicit and requires the signed application and linked client profile. It uses `client.client_aid`, not a guessed login ID. New vehicles remain `off_fleet`; creating a record does not activate it. Physical drop-off only offers eligible vehicles with approved, signed proof belonging to that owner, and its backend rechecks these conditions before activation. Company inventory without a customer owner is not given a fictitious customer contract.

## Applicant and returning-client experience

The List Your Car overview (`/onboarding`, `/salt-lake-city/onboarding`, `/wilmington-nc/onboarding`) is public. Its video, consultation booking link and testimonial sidebar are available before sign-in. **Get Started** opens `?start=1`: guests create an account directly in the application column (or use the existing sign-in link) and continue to the steps; signed-in applicants/clients open their steps directly. Explicit `?new=1` and `?draft=…` workspace links continue to open applications without an extra marketing detour. Browsing the overview does not fetch reusable private application details or create an application. Testimonials reuse the existing published video list and remain below the video/consultation card beside the form.

- Sign-in offers account creation for future booking or List Your Car. Signup uses a chosen email/password and `LYC Applicant`, with no client, employee, admin or owner privileges. Matching an email never claims legacy records or resets an existing password.
- Existing `/onboarding`, `/salt-lake-city/onboarding` and `/wilmington-nc/onboarding` entry links take a guest through signup/sign-in and then continue the application. Existing List Your Car Get started links use these entry routes.
- Applicants use their own `/lyc/status`, `/lyc/profile`, application steps and contract link. The staff/client shell is not mounted. An API allowlist enforces the restriction independently of the UI.
- The vehicle questionnaire appears inside the Vehicle information step on **every new application**, including returning clients. It never appears as a separate global button. A new application starts unanswered; resuming an existing application restores its own answers.
- Every vehicle application asks **Do you have this vehicle yet?** A purchase/finance plan and an unknown planned model are supported. No fabricated VIN is used. Selecting Not yet explains that a pending application can be submitted now and must later be completed before approval.
- Personal/license, vehicle and banking/tax steps can be saved separately and resumed. A no-car applicant can explicitly **Submit pending application** after completing personal details, uploading a driver’s license, answering the vehicle-plan questions and completing payment/tax information. Only car information (including VIN, vehicle insurance and manufacturer account details) can wait. This records a follow-up timestamp on the same owned draft, visible to admins. It is distinct from submission for approval. The applicant returns to the same application to add the car and check saved information before requesting approval; no client role, contract or car is created by pending submission.
- Own personal details, saved license and complete banking/tax defaults are reused. Existing clients use their established profile and designated default bank record. A second vehicle does not overwrite the account default with car-specific banking. Explicit license uploads replace the reusable license; reopening an old draft does not.
- `/lyc/status` shows multiple saved plans and submitted applications, with application/approval/contract/drop-off progress. Clients can add another vehicle without another account or re-entering saved personal/banking details; the vehicle questionnaire repeats for that application.
- Account created on and Client since are distinct. Conversion records Client since once. Established clients use their recorded legacy client date, not today's migration or login; missing dates remain unknown.
- Mobile retains the current light/gold style. Drafts are saved on the server, not in sensitive browser-local-storage copies.

## Admin experience

- `/admin/applicants` is a separate account directory beside Clients and Co-Hosts. It includes not-started accounts, saved plans and submissions, sorted closest to client access first. Search and status/name/newest/activity sorting are available.
- Pending no-car applications have a separate status/filter and submission date in Applicants. Admins can view the plan and use email/phone links to follow up. Contact details come from the account/profile; raw personal profile JSON and encrypted banking/tax data are not added to the directory response.
- Accounts expand into their vehicle applications. Review links open `/admin/forms?section=client-onboarding&item=lyc&submission=ID`.
- Vehicle applications, physical car onboarding/drop-off and car offboarding stay under Forms. Accounts and vehicle workflows remain separate.
- Reviews retain explicit editing, version checks and changed-field/actor audit history. Masked values cannot overwrite sensitive fields. Approved applications return to Pending before editing; linked/signed identity fields are protected. Created vehicles use the existing Cars editor.
- Approval, conversion and vehicle creation use transactions and an advisory lock. Duplicate emails/VINs or conflicting owners produce errors, not guessed matches. Same-owner vehicles are linked without overwriting existing data.
- Intake does not send a signing link. Approval requests the initial contract email. Resend cannot replace a signed agreement; reminders require approval.
- Existing completed-intake, approval, signing and drop-off notification pathways are preserved, including configured LYC Slack alerts. A no-car pending submission sends a separate pending Slack alert to the same configured LYC channel. When the applicant returns with car information and fully submits, the regular LYC alert still fires. No contract is sent before approval. Tests use mocks; no actual Slack message or email was sent here.

## Retention

### Never-client applicants

The daily six-month job uses the latest account creation, login and LYC activity. It can expire abandoned unsigned applications, including approved-but-unsigned ones. Signed proof, a prior client date/profile, additional roles, linked vehicles/client records or conflicting references prevent automatic removal. Approval/signing races are rechecked under locks. Unknown foreign keys roll back removal rather than being bypassed.

Only this flow's dedicated `lyc-UUID` uploads qualify for automated file cleanup. Imported/shared/unknown storage references remain in an encrypted cleanup queue for review. This does not erase archival backups or external-system copies.

### Former clients

`/admin/client-retention`, linked from Clients, is a manual two-year review queue. Clients are never automatically deleted. Admins can keep an exception, remove eligible software records, or remove personal details while retaining financial history and signed agreements. Removal requires a current dependency preview, a reason and typed client ID. Unknown links, mixed/unclassified files, shared staff roles and active vehicles block removal.

Notice is scheduled three days before the two-year anniversary. Provider acceptance and at least three days are required before removal; acceptance does not prove inbox delivery. `/lyc/records` lets a client request information. An open request pauses removal; fulfillment grants another three-day grace period.

Guarded vehicle status/ownership/removal services track inactivity transactionally, including reactivation between daily scans. Unknown statuses conservatively count as active. **Historical inactivity dates are not invented:** absent a reliable baseline, tracking starts with the first verified observation. Older cases need a reviewed historical-date backfill to count prior inactive years.

Selective removal archives only executed-contract proof, not raw onboarding SSN/bank credentials. It retains financial/vehicle references, removes supported personal records, anonymizes/disables the login, and queues dedicated-file cleanup. Unknown schema relationships, required personal columns or legacy files can block removal. The preview explicitly excludes archived backups and external systems. Validate against the deployed schema before any real removal.

## Source and configuration

- Frontend: `/workspace/LuxuryAutoPortal-Frontend-onboarding`, branch `onboarding-review-workflow`; remote base `f48e6933f0bca699ddadd3193a6ec16715415ff7`.
- Backend: `/workspace/LuxuryAutoPortal-Replit-onboarding`, same branch; remote base `c670ee1c61fe8eb8f65fc2c40ea0b62daab2ec0f`.
- Earlier local onboarding commits: frontend `7501834eb8ed9f86e5d682366dc9ed8d4580f98a`, backend `3f7dae0936f0a9f909caf4d478cec9ae94d3229d`. This continuation builds on them. These are coding-workspace Git worktrees, not the live Replit editor.
- Both remote main branches were fetched during final validation and still matched these bases. Other worktrees and unrelated work were preserved. No production database edits or actual provider messages were performed during local testing. The user subsequently authorized a scoped push after validation; final commits and remote evidence are reported in the handoff.
- Additive InnoDB tables: `onboarding_review_workflow`, `onboarding_review_history`, `lyc_applicant_profiles`, `lyc_application_drafts`, `lyc_draft_secure`, `lyc_account_defaults`, `lyc_account_questionnaire`, `lyc_account_lifecycle`, `lyc_expired_document_cleanup`, `client_record_retention`, `client_retained_contracts`. Initialization is on first use; source import performs no bulk migration. DB access needs CREATE TABLE, read/write, transactions and advisory locks. The pending-intake follow-up adds nullable `lyc_application_drafts.pending_submitted_at`; existing installations also need ALTER TABLE for this additive column. Existing IDs are preserved.
- New draft private values/defaults and retained proof use AES-256-GCM with stable `LYC_DRAFT_ENCRYPTION_KEY` or existing `SESSION_SECRET` (at least 16 characters). Preserve that key across restarts and plan rotation. This does not encrypt/migrate every existing submitted-form/client column.
- Jobs use the existing environment gate: disabled outside production unless explicitly enabled. Applicant expiry/file cleanup runs 04:25 and client review/notices 04:45, America/Denver. Keep `ENABLE_CRON=0` on staging copies containing real contacts.

## Main API changes

- `/api/onboarding/submit` now requires a signed-in, non-View-As account; identity is server-bound. Owned draft/version checks and transactional submission prevent retry duplicates.
- Own account: `GET/PATCH /api/lyc/profile`, `GET /api/lyc/reusable`, `POST /api/lyc/questionnaire`, `GET /api/lyc/applications`, `POST /api/lyc/drafts`, `GET/PATCH /api/lyc/drafts/:id`, `POST /api/lyc/drafts/:id/documents`, `POST /api/lyc/drafts/:id/submit-pending` (owned draft, active account, version and confirmation checks; retries do not create duplicates).
- GLA admins: `/api/onboarding/applicants`, `/api/onboarding/applicant-progress`, submission `review`, `activate-client`, `create-vehicle`. Actual co-host workspaces and View As are excluded.
- Retention: own `GET /api/lyc/retention`, `POST /api/lyc/retention/request`; GLA admin `/api/admin/client-retention` and per-client `preview`, `decision`, `fulfilled`, `contracts`.
- Removed/anonymized clients cannot keep using an already-open private API/file session.

## Verification and rollout limits

147 backend tests passed (130 workflow tests plus 17 cron-gate checks) across onboarding review/notifications/Slack/access, contract policy, signup ownership, co-host write scope, applicant access/encryption/races, reusable details, signed client access and retention. These use fixture databases/mocks, not live MySQL or real provider delivery.

13 frontend route-policy tests passed. Eleven browser scenarios passed overall: mobile/desktop onboarding, admin review/signed creation, drop-off eligibility, signup, applicant staff-shell exclusion, resume without a car, returning-client reuse, applicant sorting/conversion and retention review. Ten passed in the combined run; retention passed separately after correcting its ambiguous accessibility selector. External requests/submissions were mocked; previews listened on loopback only.

Commands: backend `npm run build` and targeted Vitest files in `src/services/__tests__/` with `--maxWorkers=1 --hookTimeout=30000 --testTimeout=30000`; frontend `npm run lint`, `npm run build`, `npx vitest run src/lib/customerHelpRoutes.test.ts`, `npx playwright test --config playwright.onboarding.config.ts`. Run `git diff --check` before handoff. No claim of zero possible bugs is made.

Before rollout, reconcile main again and validate additive schema, encryption key and actual ownership joins in staging with cron disabled. Deploy backend before frontend only when authorized. Use an authorized test owner to verify approval email/Slack, signed PDF persistence/conversion, off-fleet creation and drop-off. Check storage across a deploy: the follow-up removes onboarding/contract local-disk fallbacks and requires a successful durable write. See sensitive-data-policy.md for IAM and historical-file limitations. Inspect retention previews against real schema/storage dependencies and supply verified historical dates where needed. Local builds do not establish production behavior or delivery.

## November 3 follow-up: pending intake and representatives

- The consultation CTA is “Book a Free Consulting Appointment”; its existing GHL booking URL is unchanged.
- Andy Zhang is added once to the admin-managed Sales Representatives setting, preserving custom names. A transactional marker prevents repeated additions and allows later admin edits/removal. The frontend fallback also includes Andy; existing chosen representatives and account/vehicle IDs are unchanged.
- The existing YouTube origin-only referrer fix remains intact. Public overview, video and testimonials remain available before Get Started.
- Follow-up checks: 57 focused backend tests passed, TypeScript and both production builds passed, and 18 browser scenarios passed overall (17 in the combined run; the mobile pending-completion scenario passed on a focused rerun after making the test wait for the new step before filling fields). Coverage includes per-application questionnaire visibility, pending submission and retry/failure handling, resuming and completing the same application, admin contact/filter controls, and one-time representative configuration. Browser/API fixtures are local; live provider delivery and deployment are not established by these checks.

## Pending validation and Slack follow-up

The no-car flow remains four steps: Personal → Vehicle plan → Secure information → Review. Choosing Not yet shows one short explanation of pending status. Continue opens Secure information, not an early submission screen. Both browser and server require all non-car details before pending submission; Save & exit still saves incomplete work. Review shows a saved driver’s license correctly.

Pending alerts contain contact/plan/representative information and an admin link, not sensitive details. Delivery markers and per-application locks guard ordinary retries. The backend retries eligible undelivered alerts every five minutes, including earlier pending applications whose information is complete. Existing incomplete pending records are preserved but do not generate a misleading completion alert. The completed-application notification remains independent. See backend `docs/lyc-pending-intake.md` for delivery guarantees and environment gates.

Follow-up validation: 82 backend tests and seven focused desktop/mobile browser scenarios passed, covering missing personal/secure/license/plan data, saved-step navigation, submission retry, completing the same application later, and both notification stages. Provider delivery was mocked; local tests do not verify live Slack delivery.


### Inline account creation (November 3, 2026)

`CreateAccountForm` is shared by the standalone `/signup` page and the application
column on all three public onboarding routes after Get Started. The video,
consultation link and testimonials remain alongside it on desktop and below it
on mobile. Signup, login, local-only continuation URLs and restricted applicant
roles use the existing APIs. No authentication or backend signup policy changed.
The auth cache observer stays mounted through signup; other cached account data
is cleared before displaying the newly signed-in applicant's steps.
