# Direct booking previews

The two new rental routes are private Developer previews, protected in App.tsx by RequireRole isSuperAdmin:

- `/admin/developer/direct-bookings?view=customer|worker|calendar|day-schedule`
- `/admin/developer/car-rentals?booking=<source>:<id>`

No new public direct booking route or staff navigation entry is enabled. Drafts use the separate developer API and `direct_booking_preview:<uuid>` identity. Every draft navigation link stays inside the Developer page, including its calendar and day schedule previews. The real record detail page is read only and links to the existing internal calendar and Operations day schedule.

## Legacy desktop source reviewed

The source in `/workspace/gla-legacy-restore` was read as text, never executed:

- `src/routes/RoutesCarRental.jsx`: vehicle, booked, history, calendar, inbox and reporting workflow.
- `src/component/pages/developer-page/car-rental/view/ViewCarRental.jsx` and its sibling editors: vehicle description, features, FAQs, extras, locations, protection and pricing setup.
- `src/component/pages/developer-page/car-rental/trips/booked/CarRentalTripsBookedList.jsx`: guest/vehicle search, booking detail, status and date workflow.

The customer visual shell uses the new site's fleet branding and clean React components. Vehicle and listing content comes from the new software's existing rental listing tables. Archived HTML, JavaScript, PHP and SQL are not rendered or run. This preview does not assert that every old backup receipt, database row or customer page has been recovered.

## Preview behavior

Customers can search vehicles, choose trip dates and a trip timezone, read listing features/locations/extras/guidelines/FAQ, see current availability issues and save a private request draft. Final total, taxes, delivery, deposit and protection remain pending until pricing policy is configured. There is no live reserve/payment button.

Workers can search and filter drafts, review contact and pickup details, edit draft/ready-for-review/cancelled status with a revision number, and move between the same draft's rental details, calendar and day schedule previews. Status updates do not create real holds. Availability is checked against the internal calendar using UTC instants. Skipped and repeated DST wall times are rejected instead of shifted silently. API errors remain visible; failed source reads do not appear as confirmed availability.

Draft updates use optimistic locking. If the database save succeeds but the immediate reload fails, the server's savedDraftId disables a duplicate customer POST and opens the already saved draft. Real booking records cannot be edited, charged, refunded or messaged here.

## Checks

- `npm run lint`
- `npx vitest run src/lib/__tests__/booking-navigation.test.ts src/lib/__tests__/directBookingPreviewDates.test.ts`
- `npx playwright test --config playwright.direct-booking.config.ts`

Browser fixtures use synthetic data and assert Developer-only access, exact UTC draft payloads, unknown availability, version conflicts, no live writes, saved-but-reload-failed duplicate prevention, crosslinks, cancelled-preview filters, and mobile/desktop layout.
