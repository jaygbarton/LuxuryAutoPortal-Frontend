# Reviewed owner onboarding

## User flow

1. Submit the public application at `/onboarding`, `/salt-lake-city/onboarding` or `/wilmington-nc/onboarding`.
2. GLA reviews and edits it at `/admin/forms?section=client-onboarding&item=lyc`, then approves it. Approval creates or links the exact-email owner profile/account, requests its existing account email, sends the initial contract, and retains the configured LYC Slack/admin notifications.
3. Admin chooses **Create vehicle record**. The reviewed fields populate the existing `car` schema and a car-specific banking record, under the real `client.client_aid`. The vehicle remains `off_fleet` while awaiting the contract/drop-off. Existing same-owner VIN records are linked without overwriting them.
4. Owner signs the contract. Signing is separate from approval and does not create or activate a car.
5. Owner signs in and opens `/admin/forms?section=client-onboarding&item=car-on`. Only off-fleet vehicles with an approved, signed contract linked to that owner account are eligible. The existing physical drop-off submission activates an eligible vehicle and keeps its existing notification pathway.

A vehicle record is allowed to exist before signature. The drop-off form is not available for that vehicle until signing. Vehicle creation is explicit; creating a login alone does not create/activate vehicles. Company inventory without an assigned customer owner is not given a fictitious customer contract requirement.

## Review behavior

- Account matching is exact normalized email, never a name-only match. Duplicate accounts/profiles/VINs and conflicting owners produce actionable errors.
- Existing passwords, account roles and owner profile/default banking values are preserved. New owner roles use the existing client role. An inactive/blocked login requires separate account review.
- An approved application must return to Pending before editing. Owner identity/VIN cannot be changed through this editor once linked to an account or signed contract. After vehicle creation, use the existing Cars editor; historical onboarding is not silently rewritten.
- Only changed fields are submitted. Masked sensitive values cannot overwrite stored values. The audit records field names and actor IDs, not sensitive values.
- A version check rejects stale reviews. Creation is transactional and retry-safe. Vehicle insert, banking insert and workflow link roll back together on failure.
- Approval, signing and vehicle status are separate. Already-active legacy vehicles are not retroactively disabled by unrelated edits. Activation or ownership changes on the guarded car services require the correct signed owner contract.
- Pending applications no longer receive signing links at intake. Approval requests the initial contract email. Existing unsigned sent/opened links are preserved; reminders run only for approved applications. **Resend contract** uses the existing provider/endpoint and cannot replace a signed contract.
- Application submission, approval and physical drop-off keep their existing Slack channels. Tests exercise the configured `lyc` lookup; no real Slack message or email was sent during testing. Provider acceptance does not prove delivery to an inbox.

## Backend endpoints and schema

Existing: public `/api/onboarding/submit`, contract sign/validate endpoints, admin approve/status/reject, and authenticated `/api/car-onboarding/submit`.

New admin-scoped endpoints:

- `GET /api/onboarding/submissions/:id/review`
- `PATCH /api/onboarding/submissions/:id/review` with `{version,changes}`
- `POST /api/onboarding/submissions/:id/create-vehicle` with `{version}`

The review middleware excludes actual co-host workspaces and impersonated client/employee/co-host views, even if the underlying account has an admin role. The physical drop-off path uses existing authentication and owner/co-host scope, followed by signed-contract proof.

Two additive InnoDB tables are initialized on first review use: `onboarding_review_workflow` and `onboarding_review_history`. No bulk migration or existing-record deletion occurs. The database user needs CREATE TABLE, normal read/write and advisory-lock support. New vehicle creation expects the existing `client_banking_info` table.

## Source worktrees

- Frontend: `/workspace/LuxuryAutoPortal-Frontend-onboarding`, branch `onboarding-review-workflow`, starting base `f48e6933f0bca699ddadd3193a6ec16715415ff7`.
- Backend: `/workspace/LuxuryAutoPortal-Replit-onboarding`, same branch name, starting base `c670ee1c61fe8eb8f65fc2c40ea0b62daab2ec0f`.

These are coding-workspace Git worktrees, not a claim to have edited a live Replit editor. Other worktrees are left intact.

## Focused verification

Backend: 74 focused/regression tests passed across seven files, including existing signup ownership and co-host write-scope checks. The initial concurrent regression run timed out during module imports while both builds ran; the serial rerun passed all tests.

Commands: `npm run lint`, `npm run build`, and Vitest files `onboardingReview`, `onboardingNotifications`, `onboardingSlackChannel`, `onboardingAccess`, `vehicleContractPolicy` under `backend/src/services/__tests__/`, plus `signupAccountOwnership` and `coHostPaymentsAndCarWrites`. Use `--maxWorkers=1 --hookTimeout=30000 --testTimeout=30000` when checking these alongside builds in this workspace.

Frontend: `npm run lint`, `npm run build`, `npx playwright test --config playwright.onboarding.config.ts`. Browser fixtures cover the public wizard at 390px/1280px, validation/back navigation, multipart license retention, sensitive summary, explicit admin editing/approval/creation, and drop-off eligibility. External requests and real submission endpoints are mocked. Local Chromium is selected by `CHROMIUM_PATH` or `/usr/bin/chromium`.

Before a live rollout: reconcile current remote main; deploy the backend first, verify table initialization and endpoint access, then the frontend. With an authorized test owner, verify account email, approval-triggered contract email, signed PDF persistence, off-fleet record, drop-off eligibility and actual Slack delivery. No production database or provider delivery was exercised in this coding workspace. Local tests do not replace these deployment checks.

The current remote main branches were re-fetched before handoff and still matched the starting bases. No unrelated files, main branches or other worktrees were replaced. No push or production deployment is included in this source handoff.
