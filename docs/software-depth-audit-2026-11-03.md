# GLA software depth review — November 3, 2026

## What was reviewed

This is a source and local-preview review, not a claim that every production record, customer account or integration was tested. The starting revisions were frontend `f48e6933f0bca699ddadd3193a6ec16715415ff7` and backend `c670ee1c61fe8eb8f65fc2c40ea0b62daab2ec0f`. Separate `onboarding-review-workflow` worktrees preserve other developers’ changes.

Legacy references: the available `gla-v3` source at `42f33ef5`, the locally available legacy archive inventory, and the current Developer archive viewer (`src/components/developer/LegacyArchivePortal.tsx`). Archived code was read, not executed. No signed-in production archive browser was available. File/route inventory counts do not prove that all old data or receipts have been recovered.

The legacy client vehicle pages had explicit destinations for financial history, COGS, direct delivery, office support, owner split, purchase/finance information and records/files. Useful examples are under `gla-v3/src/component/pages/client-page/cars/view-cars/`, especially `car-totals/car-all-totals-item/`, `car-purchase-details/` and `car-records-and-files/`. The old admin onboarding detail component also grouped the submitted owner and vehicle details for review.

## Assessment

There are real working systems in the new software: accounting reports, maintenance approvals/history, service records and receipts, trip operations, owner reports and forms. The stronger explanation for a customer perceiving “less” is a mix of fragmented journeys, lost report-specific navigation, incomplete edge cases and a few explicitly unfinished implementations. A page existing or a route being restored is not evidence of a complete workflow. This review does not establish which problems were caused by AI-assisted coding.

## Work implemented in this change

The final sequence is **applicant account → application → GLA approval → contract sent and signed → client access → off-fleet vehicle record → physical drop-off**. Approval alone creates no new client profile or client permissions. Existing established clients retain access when submitting another vehicle.

- New self-service accounts have a restricted applicant role and only their own profile/application workspace. Staff/client APIs are denied independently of the UI. Signup cannot claim an old profile or overwrite an existing password by matching an email.
- The first questionnaire follows saved personal details. A person without a car can save a purchase/finance plan, complete other steps and return later with the vehicle; no invented VIN is required. Returning applicants/clients reuse their details and banking/license defaults. Each vehicle has its own saved plan, submission and progress.
- Mobile-friendly steps use the current gold/light style, server-side saving, version checks and encrypted private draft/default data. Final submission still requires all actual required fields. Existing submitted-form storage is not globally migrated by this change.
- A separate Applicants account directory sits beside Clients/Co-Hosts, with progress sorting, search, filters and links to each vehicle application. Vehicle onboarding/drop-off and offboarding stay under Forms.
- Review editing remains explicit and audited. Approval preserves chosen passwords and sends the contract. Valid signing creates/links the client profile and promotes the applicant; failure preserves the signature for a guarded retry. Manual new-client creation and role grants also require signed proof. Client since and account-created dates are distinct.
- Staff then create the vehicle from reviewed details, using the real client profile ID. It stays off-fleet until eligible physical drop-off. Same-owner VINs link without overwrites; ambiguous ownership is rejected. Intake, approval, signing and drop-off notification pathways, including Slack, remain in place.
- Never-client applicants can expire after six inactive months. Former clients reach a manual admin review after two years without an active vehicle; no client is automatically deleted. Notice, information requests, keep exceptions and guarded removal/financial-contract retention are implemented. Existing historical inactivity is not guessed; unknown dependencies or storage ownership block removal.

See [onboarding-review-workflow.md](onboarding-review-workflow.md) for exact routes, checks, configuration and rollout limits. This is saved source, not a production deployment.

## Recommended next work — not implemented here

| Priority | Verified finding | Why it matters | Recommended completion and acceptance check |
| --- | --- | --- | --- |
| 1 | **Employee creation accepts document selections without uploading them.** `src/pages/admin/hr/employees.tsx` has an explicit upload TODO after the JSON request and clears both file states on success. | A user can believe a driver’s license/insurance document was saved when only the employee fields were saved. This is a concrete unfinished flow, separate from public employee onboarding. | Wire the existing document upload/storage path into creation with saved/upload-failed feedback and retry. Reopen a created employee and verify every uploaded file as the intended authorized role. |
| 1 | **Owner maintenance history is a task view, not the whole service record.** `src/pages/client/maintenance-history.tsx` calls `/api/client/maintenance-history`; backend `getMaintenanceHistoryForOwner` in `maintenanceApprovalService.ts` reads `maintenance_tasks` plus inspection/trip context. It does not itself unify all service receipts and recovered vehicle-file history. | Staff may see service evidence that an owner cannot discover from Maintenance History. | Provide a per-vehicle timeline linking tasks, service records, dates, approvals and authorized receipts. Keep provenance and avoid counting the same repair twice. Test a vehicle with a receipt-only record, a completed task and imported history. |
| 1 | **Maintenance fetch failure looks like an empty history.** That client page uses `data?.data ?? []` and renders an empty-state message after loading, without an error branch. | “No records” can be mistaken for lost data when the API failed. | Distinguish no records, unavailable data and filtered results; provide Retry. Verify 403/500 and genuinely empty datasets produce different messages. |
| 1 | **Document persistence still has a weak fallback.** `backend/src/controllers/onboardingController.ts` `saveOnboardingDoc` prefers GCS but falls back to local disk; the source itself documents prior losses on ephemeral-host redeploys. Contract save also retains local fallbacks. | A form can be accepted with an attachment that is not durably stored. | Make durable storage success explicit; retain a retryable upload job or fail the attachment save with clear feedback. Test storage failure and a subsequent deploy. Keep authorized file proxy access; do not make sensitive buckets public. |
| 1 | **Account IDs, owner profile IDs and activity flags remain inconsistent in older code.** New onboarding now writes `car_client_id = client.client_aid`. Older helpers such as `clientStatusService.ts` try `user.id` before `client.client_aid`, and some “active” queries still use `car_is_active` while operations use `car_status`. | Numeric ID collisions and different meanings of “active” can produce wrong ownership/status reports even with a polished UI. | Audit all write paths and standardize types/joins and activity definitions. Preserve suspended/blocked accounts. Use collision fixtures where a user and unrelated client have the same numeric ID. This change avoids guessing IDs in the new creation path but is not a global migration. |
| 2 | **Legacy report destinations collapse into a general income view.** `src/App.tsx` redirects legacy history, COGS, direct delivery, office support, owner split, P&L and rental-value routes to `legacyCarRoute('income')`. Current Totals/Earnings and ClientPageLinks do exist. | Familiar detailed links can appear to have disappeared even when some underlying data exists. | Preserve vehicle and period context, open the relevant report/section and show totals with source drill-downs. Compare representative legacy reports to the new result; do not restore extra menu entries without real data. |
| 2 | **Some earnings chart inputs are explicitly unfinished.** `src/pages/admin/earnings.tsx` sets `upcomingEarnings` and `missedEarnings` to zero with TODOs, and omits those series unless positive. | Forecast/missed revenue is not implemented by those variables. This is not evidence that all earnings charts are fake or that users see those zeros. | Define the business meaning and data source first. Calculate deterministically where possible, label estimates/unknowns and reconcile against real periods. The Days Rented definition also needs final business agreement before changing calculations. |
| 2 | **Sensitive onboarding collection needs a separate policy pass.** Existing schemas require an SSN and a vehicle-account password, with optional EIN. New private drafts/defaults now have application-level encryption, but existing submitted-form/client storage and the broader collection policy remain unchanged. This is not a finding about database/storage provider encryption. | A step called “Secure information” is not itself a storage/access control guarantee; business owners and non-connected cars may not fit current requirements. | Decide SSN versus EIN rules and whether a manufacturer password should be collected at all. Review retention, least-privilege access, audit logging, encryption and deletion. Do not silently change required fields or staff access without an agreed policy. |
| 3 | **Direct booking is intentionally a private preview.** `docs/DIRECT-BOOKING-PREVIEW.md` documents developer-only drafts, no live reservation/payment and unfinished final-price policy. | It should not be presented as a production-ready customer booking system. | Treat pricing/taxes/deposit/protection, real availability holds, confirmation and refunds as a separate release with clear acceptance checks. It was not enabled in this change. |

## Suggested order after review

1. Finish employee document persistence and document-storage failure handling.
2. Consolidate the owner vehicle history/report journey and make failed data loads explicit.
3. Normalize owner IDs and fleet/account state semantics with reconciliation fixtures.
4. Review the financial definitions and report-specific navigation with a real customer statement.
5. Finish the broader sensitive-data policy and, separately, the direct-booking production release.

The practical completion standard should be: **submit → review → save → reopen → view as the intended customer/employee → verify evidence and failure recovery**. A screenshot of the first page is not enough.

## Meeting transcript evidence

The supplied full transcript and AI summary were read. Both uploaded text files contain the same 50,242-byte transcript (SHA-256 `ddbe78534b3a606e70c4a2a0c4e6ba5b3ffd6a25b795f574238e882e6891f1b8`). The user's subsequent instructions take precedence over proposals in the meeting.

- **27:22–28:08:** divide onboarding into clearer steps.
- **28:29–31:48:** Jay clarified that the earnings statistics being discussed were in a presentation, not the old website. They are not reported here as a verified missing legacy-site feature.
- **47:03–47:47:** Alvin did not have a car, and the required VIN blocked the process. Saved vehicle-free plans address this case.
- **50:33–51:41:** test the actual flow before release; source/build success alone does not establish production behavior.
- **52:25–53:53:** ask whether the person has a car, support buying/financing, and save/return later. These requirements inform the one-time questionnaire and per-vehicle plan.
- **56:39:** the meeting's manual license/email account-creation proposal is superseded by the owner's later request for self-service applicant accounts.

The full videos were not visually reviewed: both MP4 files exceed the workspace's 32 MiB transfer limit. Audio was downloaded but local transcription was blocked; the subsequently supplied transcript provides the spoken-content evidence. Future SaaS/franchise/pricing proposals from the meeting are not implemented by this change.
