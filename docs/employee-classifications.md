# Employee departments and job titles

Added October 30, 2026 on employee-departments-job-titles, from frontend
289261e5deb0bcfc1b6ef75f49031cae8aa286b9 and backend
f66d6cd29e472c92bf606a685d9467f690b6ba5d.

Department choices: Operations, Sales & Marketing, Administration, Custom.
Job title choices: Car Driver, Car Cleaner, Mechanic, Custom. Both can be cleared
with Not set. Custom values (up to the existing 200-character column size) remain
attached to the employee and reopen as Custom; older labels are preserved rather
than silently recategorized. No global cross-employer taxonomy is introduced.

The shared selector is used by Add Employee, HR employee Job and Pay → Job
Information → Update, and the existing staff self-service Job Information editor.
Titles and departments use the existing employee_job_pay columns and API fields;
login roles and operational employee roles remain separate. No existing HR edit
permission is broadened. Role editing still uses its existing admin-only endpoint.

Legacy operational roles were inferred from job titles until an explicit role list
was saved. Before a title is edited, employeeJobClassificationService now locks
the employee and existing job row, snapshots the prior inferred roles with INSERT
IGNORE, and saves the title in the same transaction. Explicit roles, including an
empty list, are preserved. Failures roll back both operations. Department-only
edits do not touch roles. Newly created admin employee records start with an
explicit empty role list so choosing a title does not implicitly grant Car Driver
chart participation or Manager access. Existing inferred roles are not bulk reset.
Future title writes must use EmployeeService.updateEmployeeJobPay to retain this
separation. Public pending onboarding has no job-title grant; its first title edit
uses the same guard. No account, login, salary or pay-rule update is added.

Checks cover legacy/explicit/empty role preservation, new employee initialization,
custom values, clear operations, missing job records, rollback, password-email
regressions, chart/manager role access and independent role editing. Fixture browser
checks exercise standard/custom/cleared values and reopening on phone/desktop, the
Add Employee choices, and staff self-service without role or pay writes. No actual
employee records, emails or notifications are created by these checks.

Both repositories follow their existing normal main pushes and Render/Vercel auto
deployment paths. Deployment availability is not established by a local build;
this environment's public-site/deployment-status requests remain proxy-blocked.
