# Onboarding follow-up, report reliability and public UI

Worktrees: `LuxuryAutoPortal-Frontend-onboarding` and `LuxuryAutoPortal-Replit-onboarding`, branch `onboarding-review-workflow`. Starting remote main commits: frontend `f48e6933f0bca699ddadd3193a6ec16715415ff7`, backend `c670ee1c61fe8eb8f65fc2c40ea0b62daab2ec0f`. Latest remote state must be fetched again before pushing. No reset/force push or renumbering of existing IDs is part of this work.

## Completed source changes

- Employee creation now persists selected insurance/license documents. Upload failure keeps the created employee and selected files available for retry without creating another employee. Multiple insurance pages are preserved in one PDF. Public onboarding separately reports document failure after receiving the employee application.
- Onboarding/contract document saves require durable storage. Contract signing cannot proceed when PDF persistence fails; temporary local files are no longer used as a success fallback.
- Owner vehicle service history combines completed/approved service records, financial service dates, receipts and recovered records, with explicit failures and protected file access. Historical inactive vehicles remain in owner records. Internal notes are excluded.
- Owner IDs remain in their existing namespaces: `user.id` is the login, `client.client_aid` is ownership, `car.car_client_id` is the relationship. Unique-email resolution does not manufacture records on read. Fleet availability uses `car_status`; `car_is_active` is management metadata. Manual/unknown client states are preserved. `backend/src/scripts/auditOwnerIdentity.ts` is a read-only audit, not an automatic migration.
- Report-specific links keep vehicle and period context. Accounting formulas remain unchanged; see [financial review](owner-financial-review.md).
- Shared selection controls are searchable from one letter, alphabetized and scrollable in dialogs/mobile viewports. Driver exceptions Uber/N/A and placeholder/all options remain ahead of ordinary options. Vehicle labels sort by name rather than a leading year. Remaining native visible selects use the shared control; hidden native inputs still preserve form values/required validation.
- Homepage business cards use one responsive, in-flow layout with gold accents, larger typography, rounded imagery, focus states and real links. The fixed scroll scene's pointer-event/overlap bug is removed. SLC and Wilmington retain their existing destinations and location availability. Review heading is “What our guests say”; no generated-process commentary is shown to visitors.
- [Sensitive-data policy](sensitive-data-policy.md) documents implemented access, encryption, retention and failure behavior plus legacy-data/provider checks still required.

## Validation scope

Focused unit/browser checks cover document failure and retry, identity collisions, ownership and public-field projection, financial-reference math/navigation, one-letter/sorted/scrollable menus, desktop/mobile homepage links, and onboarding/retention regressions. External APIs and messages are mocked during browser tests. TypeScript, production builds and `git diff --check` are required before push.

Production verification must distinguish a successful source push/build from actual deployed backend/frontend behavior. No private production database audit, real document upload, Slack/email delivery or current customer-statement reconciliation has been claimed. The storage/retention rollout checks in [onboarding workflow](onboarding-review-workflow.md) and the sensitive-data policy remain relevant.

## Completed local checks

- Frontend TypeScript and production build: passed. 17 focused unit tests: passed.
- Browser checks: 11 onboarding/retention + 14 dropdown + 6 public-home + 2 owner-history/employee-document scenarios passed. Chromium desktop/mobile viewports; network providers mocked. Safari error recovery tests simulate its DOM exception in Chromium, not a real Safari device.
- Backend TypeScript/Prisma production build: passed. 97 workflow/document/identity checks, 31 additional access/Slack/notification/contract/reusable-detail checks, and 36 financial-reference tests passed (the separate 54-test run also included 18 document/identity tests counted in the 97).
- The earlier 147-test onboarding validation remains documented in onboarding-review-workflow.md. No actual production document/message or database mutation was used for these tests.
