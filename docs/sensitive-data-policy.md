# GLA sensitive-data handling policy

Updated November 3, 2026. This is the operating policy for this implementation, with deployment checks explicitly separated below. It is not a claim of a legal retention requirement or a completed audit of provider permissions.

## Collection and use

- Collect applicant contact/identity details for account access and application review; collect vehicle details per vehicle. Reuse saved owner information for additional applications instead of requesting duplicate documents.
- Tax, bank and identity documents are for the existing review, payment and employment workflows. Never place their values in analytics, chatbot context, marketing integrations, ordinary logs or support screenshots.
- Existing forms still require their configured tax and manufacturer-account fields. Changing SSN-versus-EIN eligibility or replacing manufacturer passwords with delegated access requires a business decision and a compatibility migration; this release does not pretend those fields are no longer collected.
- Do not copy real customer files into development fixtures. Tests use fabricated accounts/documents and block external messages/uploads.

## Access, storage and failure behavior

- Applicant sessions are default-denied from staff and client APIs. They can access their own saved profile, applications and retention requests. Approval alone does not grant client access. Approved, signed proof is required for new client conversion.
- Owner service history verifies the actual `client.client_aid` relationship to the selected vehicle on every data/file request. It includes completed/approved records and identified historical imports, excludes internal notes and pending new receipts, and never proxies an arbitrary caller-supplied file URL.
- Existing sensitive-field masking and superadmin-only audited reveal remain. Account/HR/application/financial responses use `private, no-store` and `no-referrer`. Credentials and secret tokens must not be logged or included in exports.
- New applicant drafts/reusable private defaults and retained contract proof use authenticated encryption with the configured application key. Existing submitted-form, client and employee columns have **not** all been migrated to application-level encryption. Provider disk/database encryption is a separate control.
- Employee document uploads use the existing Drive folder with public-sharing creation disabled. Selected insurance pages are preserved together as a PDF. Employee IDs/previous document references remain intact on failure; the UI retains selected files for retry while that page remains open.
- New onboarding documents and signed PDFs require a successful durable GCS write. There is no temporary-disk fallback reported as success. A failed PDF write does not mark the contract signed or convert the applicant.
- `private, no-store` is cache control, **not** an access-control boundary. GCS uniform-bucket IAM and inherited Drive folder permissions must be verified independently. Do not add `allUsers`/`anyone` grants to make a failed private document link work.
- Preserve the original record when a receipt cannot be opened. Show an explicit error/retry or file-review message; an unavailable provider must not look like an empty service history.

## Retention and removal

- Never-client applicant accounts are eligible after six months of inactivity, using creation/login/application activity. Existing client history, signed proof, extra roles and unresolved dependencies block automatic applicant removal.
- Former clients enter an admin review after two years without an active vehicle. There is no automatic client deletion. Notice is scheduled three days before the known due date; an information request pauses removal until handled.
- Admin choices are keep with a reason, remove eligible software records, or remove personal details while retaining financial history/contracts. Preview dependencies and require typed client ID plus reason. Unknown/shared records, files without proven ownership, active vehicles and mixed staff roles block removal.
- Keep financial/contract records under the explicit chosen exception, minimize the remaining identity fields, restrict access, and retain an audit trail. Do not invent a statutory expiry date for these records.
- Automated cleanup only deletes file objects whose ownership and path are proven. External backups, Google/Drive history, exports and third-party CRM copies require their own documented review; deleting an application row is not proof every external copy was erased.

## Required deployment verification / remaining migration work

1. Verify a stable encryption key, private GCS IAM, inherited Drive permissions, authorized signed-link reads, and restart-persistent storage using a designated test account. Do not print secrets.
2. Review the read-only owner reconciliation output before correcting historical ambiguous links; keep all current IDs unchanged.
3. Inventory legacy plaintext columns, old `/onboarding-docs` and signed-PDF public/static paths, copies/backups and exports. Plan encryption/backfill/key rotation and authenticated replacement URLs before changing access to historical files. Those legacy access paths are not silently removed in this compatibility release.
4. Review retention previews against the real schema and recover verified inactivity dates; do not infer them from import timestamps. Test actual notice delivery and information-request holds before approving a real removal.

Implementation files: backend `sensitiveFieldService.ts`, `lycApplicantService.ts`, `lycApplicantRetention.ts`, `clientRetentionService.ts`, `durableDocuments.ts`, `employeeDocuments.ts`, `ownerVehicleHistory.ts` and associated routes. This policy documents the remaining legacy-data/provider controls rather than claiming they have already been verified.
