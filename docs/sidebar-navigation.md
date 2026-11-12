# Workspace navigation

The sidebar groups authorized links after the existing role and chart-management checks:

- Accounts: Admins, Co-Hosts (including My Co-Host Cars), Applicants, Clients.
- Cars: existing fleet links, Bouncie and its tools, Car Rental. Staff get only the vehicle tools they could already access; client My Cars / tracking / history / stats links remain available.
- Operations begins with Day Schedule, Car Block Off, Maintenance, Service Due, then Turo Trips where authorized. The duplicate standalone Car Block Off shortcut is removed. Existing block-off submission forms and their routes remain usable through Forms.
- System: Turo Guide, System Tutorial, Client Testimonials, News & Media, Notice Board, AI Hub, according to existing access.

Nested groups render recursively. Deep links expand every ancestor and highlight the destination. External Car Rental links retain their new-tab behavior. Co-host, employee, client and impersonation views keep their existing route permissions; group headers do not grant access. The existing Co-Hosts / Totals / Payroll grouping is retained.

Rental Listings is retired from the sidebar and quick links. Its lazy page import is removed, and the old authenticated /admin/rental-listings bookmark redirects to /cars without mounting the obsolete page or fetching its APIs. No listing records or backend APIs are deleted.

Validation uses mocked APIs and real Chromium at mobile and desktop sizes, including role/impersonation visibility, nested links, active states, ordering, external links and the retired-route redirect. No production data, emails or sync jobs are involved.
