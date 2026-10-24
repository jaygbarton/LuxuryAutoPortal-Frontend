# GHL customer help: route inventory and approved native integration

Verified against frontend main `77c938e57eb136964e37dddf751a457272fe0b23` on
October 24, 2026 (America/Denver), preserving the off-boarding and newer claims
changes. Backend unchanged; earlier source review used `d1eb8be`. This inventory
does not claim every private screen was tested with a live customer account.
The subsequent user-approved frontend rollout is recorded below.

## Existing layout and integrations

`src/App.tsx` declares public pages first, outside the protected shell. Its
catch-all mounts one persistent `AdminLayout` containing the authenticated route
switch. `AuthGuard`, `RequireRole`, and backend scope checks retain all access
control. `/dashboard` selects the current role's dashboard. Co-hosts can carry
`isAdmin=true`; `use-co-host.ts` and the layout select co-host-specific navigation.
Customer eligibility therefore cannot be decided by `/admin` prefix alone.

No existing GHL chat/Conversation AI embed or other chat provider was found in
current frontend source, public assets or index.html. No GHL chat configuration
was found in backend source. Hosting dashboards/Replit secrets were not accessed.

The existing GHL **booking calendar**, not a chatbot, is in
`src/pages/marketing/legacy-pages.tsx` (`DetailShopAppointmentPage`):

- Public booking identifier: `koQOgzFBXBNtPzVJwPXW`
- URL: `https://api.leadconnectorhq.com/widget/booking/koQOgzFBXBNtPzVJwPXW`
- Rendered at `/detail-shop/book` and `/salt-lake-city/detail-shop/book`.
- Existing links also lead to `rent.goldenluxuryauto.com/lyc-client-check-in` for
  Zoom scheduling; this external page is not controlled by this SPA integration.

The booking identifier remains separate from the customer-help chat widget.

## Public routes (exact registered paths)

Each path below uses `PublicPageGate`, which reads the existing public-page
settings and can display “Page Under Maintenance.” Chat eligibility does not
bypass that gate. Recruitment/application pages are public, not staff dashboards.

- `/choose-location`
- `/salt-lake-city`
- `/wilmington-nc`
- `/myrtle-beach-sc/list-your-vehicle`
- `/charleston-sc/list-your-vehicle`
- `/myrtle-beach-sc`
- `/charleston-sc`
- `/fleet`
- `/salt-lake-city/fleet`
- `/wilmington-nc/fleet`
- `/myrtle-beach-sc/fleet`
- `/charleston-sc/fleet`
- `/salt-lake-city/pick-up-and-drop-off`
- `/salt-lake-city/detail-shop/book`
- `/salt-lake-city/detail-shop`
- `/salt-lake-city/chauffeur-services`
- `/salt-lake-city/cybercab`
- `/salt-lake-city/meet-us`
- `/salt-lake-city/deals`
- `/salt-lake-city/jobs/apply`
- `/salt-lake-city/jobs`
- `/salt-lake-city/suggested-cars`
- `/salt-lake-city/testimonials`
- `/salt-lake-city/reviews-options`
- `/salt-lake-city/reviews`
- `/salt-lake-city/extras`
- `/salt-lake-city/privacy-policy`
- `/salt-lake-city/terms-and-conditions`
- `/salt-lake-city/terms`
- `/salt-lake-city/onboarding`
- `/salt-lake-city/contact`
- `/wilmington-nc/testimonials`
- `/wilmington-nc/reviews-options`
- `/wilmington-nc/reviews`
- `/wilmington-nc/extras`
- `/wilmington-nc/privacy-policy`
- `/wilmington-nc/terms-and-conditions`
- `/wilmington-nc/terms`
- `/wilmington-nc/onboarding`
- `/wilmington-nc/contact`
- `/detail-shop/book`
- `/detail-shop`
- `/chauffeur-services`
- `/pick-up-and-drop-off`
- `/deals`
- `/jobs/apply`
- `/jobs`
- `/privacy-policy`
- `/terms-and-conditions`
- `/terms`
- `/testimonials`
- `/reviews-options`
- `/reviews`
- `/extras`
- `/suggested-cars`
- `/onboarding`
- `/contact`
- `/employee-form`
- `/co-host-form`

Other public entry routes: `/` redirects to `/salt-lake-city`; `/login` and
`/admin/login` use the same sign-in page; `/signup`; `/reset-password`;
`/sign-contract/:token`; `/maintenance-approval/:token`.

## Authenticated customer-facing routes

The chat allowlist below is visibility policy only. It cannot grant a customer
access to a page or record denied by the existing application.

| Audience | Registered paths | Existing purpose |
| --- | --- | --- |
| Owners | `/dashboard`, `/client/dashboard` | Owner dashboard, vehicle and period selection, reports/support links |
| Owners | `/profile`, `/tutorial`, `/cars` | Account profile, training, owned vehicles |
| Owners | `/client/my-car-tracking`, `/client/trip-history`, `/client/trip-calendar`, `/client/geofence-zones`, `/client/vehicle-trips`, `/client/vehicle-behavior` | Scoped fleet/trip/tracking pages; data availability depends on assigned vehicles/integrations |
| Owners | `/client/offboarding-form` | Vehicle off-boarding request |
| Owners | `/admin/view-car/:id`, `/admin/cars/:id` | Shared vehicle details |
| Owners | `/admin/cars/:id/earnings`, `/depreciation`, `/purchase`, `/graphs`, `/calculator`, `/totals`, `/payments`, `/income-expense` (suffixes on the same vehicle prefix) | Per-vehicle reports and financial pages, subject to existing role and ownership checks |
| Owners | `/admin/cars/:id/records`, `/admin/cars/:carId/records/:recordId/files` | Records and files |
| Owners/co-hosts | `/admin/forms`, `/admin/settings`, `/admin/car-block-off` | Role-specific forms, settings, block-off requests |
| Owners | `/admin/testimonials`, `/admin/turo-guide`, `/admin/news-media`, `/admin/notifications` | Existing customer support/content/notification pages |
| Co-hosts | `/dashboard`, `/admin/co-host-profile`, `/cohost/training-manual`, `/admin/my-co-host-cars`, `/cars` | Co-host home/profile/help and assigned vehicles |
| Co-hosts | Owner vehicle/report paths above where their current role grants access, plus `/admin/cars/:id/expenses` | Scoped vehicle information and financial work |
| Co-hosts | `/admin/income-expenses`, `/admin/payments`, `/admin/payment-status`, `/admin/co-host-payments`, `/admin/totals`, `/admin/turo-trips`, `/admin/trip-calendar` | Co-host-facing fleet accounting/payments/trips |
| Co-hosts | `/admin/bouncie`, `/admin/bouncie-trips`, `/admin/bouncie-geofence` | Co-host fleet tracking/trips/geofences |

Co-host visibility checks recognize both real co-host sessions and View as
Co-Host. Owner preview recognizes View as Client; View as Employee is excluded.
A normal admin/employee session gets no chat on authenticated screens, including
shared paths. Staff can still see chat on public website pages once enabled.

Legacy client aliases `/client/account`, `/client/profile`, `/client/cars`,
`/client/record-and-files`, `/client/earnings/details`, `/client/earnings-calculator`
redirect to the current shared pages. Other old `/admin/car/...` and
`/developer/car/...` URLs are redirects, not additional customer screens; chat
becomes eligible at their resolved customer destination.

Excluded: unknown/not-found URLs; `/staff/*`; staff-session Operations;
AI Hub; developer previews; HR/payroll; user/client management; admin-only
maintenance history; per-car income-expense edit log. Co-host sidebars contain
some staff management tools: those remain outside this customer-service widget
scope. Existing Operations vehicle tabs and `/admin/profile` now have an explicit
customer-context plus `isAdmin=true` check; ordinary staff remain excluded. `/client/maintenance-history` and `/admin/cars/:id/maintenance` are currently
admin-only; the backend also disables maintenance access for clients.

## Exact native embed and activation state (October 24, 2026 UTC)

GLA supplied the public native Live Chat widget **GLA Customer Help**, ID
`6adbf3186c0798678b00aa14`, with AI disclosure and bottom-right placement configured
in GHL. The local code uses these exact attributes:

```html
<script src="https://widgets.leadconnectorhq.com/loader.js"
  data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
  data-widget-id="6adbf3186c0798678b00aa14"></script>
```

**Production go-live approved October 24, 2026:** `GHL_NATIVE_WIDGET_CONFIG` now
references exactly `GHL_LOCAL_PREVIEW_CONFIG`. This enables the verified native
widget through the clean frame, without a preview flag or customer placeholder.
GHL settings, Hailey, phone routing and backend permissions are not changed here.

## Native integration and URL privacy

`CustomerHelpWidget` mounts once inside the existing QueryClientProvider. It
observes the existing session cache without starting an authentication request.
The policy recognizes owner/co-host contexts and customer-accessible admin paths,
including the existing Operations vehicle tabs and `/admin/profile`. Staff-only
routes, unknown tabs and unresolved protected sessions remain excluded. This is
chat visibility only and grants no page or API access.

The exact native embed runs in `/gla-help/frame.html`, a real clean static page.
The parent iframe has `referrerpolicy="no-referrer"`; no parent URL, query string,
account fields, authentication state or financial data crosses the bridge. Only
the public embed configuration and a boolean open/closed state are exchanged.
Both sides check the message origin and source window. The child accepts only
the expected provider URL/resources URL and a valid public widget ID.

This fixes a verified failure of the direct-page embed: the provider's attribution
service received a fake contract/reset token from the surrounding page URL.
With the clean frame, the real provider test observes no token in third-party
URLs, request bodies or headers on contract, maintenance-approval and reset links.
The frame's document.referrer is empty. GHL attribution sees the generic help
frame page instead of the customer's actual page address. This test does not
promise that GHL performs no analytics; its runtime still operates in the frame.

The same-origin iframe is **not a security boundary against malicious third-party
code**. The native GHL script remains a trusted integration. The frame prevents
its current automatic attribution code from receiving the surrounding URL; it
does not supply a private account API or authenticate someone asking a question.

One frame survives SPA navigation/StrictMode remounts. The complete frame is
hidden on excluded routes, including an already-open native panel or a late
provider load. Failed provider loads stay hidden without route-change retries.
The collapsed native launcher occupies a 100px square at the bottom right. The
native open/closed API resizes the frame for the actual chat panel. The public
numeric height setting adapts to shorter mobile viewports; no fake bot UI or
custom conversation transport is introduced.

The GHL widget's separate promotional chat prompt is disabled so the collapsed
frame contains only the native circle. Opening the chat still shows:
1. Book a car
2. List your car
3. Site help / find something
4. Other

## Configuration and preview

Production enablement is explicitly approved. The dedicated GLA Customer Help
agent is being activated separately by the user in GHL. Hailey and phone routing
remain outside this source change.

For a local loopback-only check of the approved source:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5352 --strictPort
```

Open `http://127.0.0.1:5352/contact`. No preview opt-in is required after
approved enablement. Query/storage preview flags cannot disable production chat.
If a rollback is needed, explicitly set the production config to null in source
and deploy that reviewed change; the development-only preview path remains. For real protected-page functionality, use an approved local
backend and legitimate test accounts; production login cookies do not transfer
to localhost and the tests never bypass authentication.

## Verified checks — October 24, 2026

- TypeScript and 11 focused route/configuration unit tests pass.
- Six browser checks pass on the Mac against the current main baseline:
  inactive/no-provider behavior; role-aware fixture transitions and one load;
  provider failure/no retries; rejection of spoofed bridge messages; real native
  menu/open/close, one load and desktop/mobile placement; real native private-token
  protection. The real-provider checks do not mock GHL or submit chats.
- Real screenshots were reviewed at desktop size and phone-sized viewports 390×844,
  390×667 and 390×400. The full native panel, header and composer remain within
  those viewport bounds. These are desktop-browser viewport simulations.
- Protected role transitions use a source-based session-cache fixture; they are
  not claims of live authenticated customer-account tests. Real phone keyboard,
  Safari/browser-specific behavior and actual voice call transfer still require
  an ordinary launch smoke check.

```sh
npm run lint
npx vitest run src/lib/customerHelpRoutes.test.ts
npm run build
GHL_REAL_WIDGET_TEST=1 npx playwright test --config playwright.customer-help.config.ts
```

On this Mac the existing Chrome binary can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
The test starts a loopback Vite server and stops it after completion. Provider
access is required for the opt-in tests; failures are never relabeled as fixture
successes. Existing PostCSS/build warnings are unrelated.

## Approved source rollout — October 24, 2026

Worktree: `/workspace/LuxuryAutoPortal-Frontend-ghl-verified`, branch
`gla-customer-help-verified-mac`. The recorded Mac baseline was
`77c938e57eb136964e37dddf751a457272fe0b23`; it was safely fast-forwarded to
`f784ddd607195b6c1c04a58560700c3d5729b26f` before enablement, preserving the
intervening employee-email fix. The only runtime change to the verified chatbot
implementation is the enabled production configuration. Both clean frame files,
no-referrer settings, restricted bridge, native height fitting and route policy
remain intact. App.tsx still receives only one import and one mount.

The normal existing publishing path is a scoped push to GitHub frontend main,
which Vercel builds with `npm run build` and serves from `dist` according to
`vercel.json`. Verify live goldenluxuryauto.com assets after publishing; a local
build alone does not establish deployment. Both `/gla-help/frame.html` and
`/gla-help/frame.js` must be present with their correct content types.

Focused enablement checks cover the approved config, clean frame startup without
preview flags, customer/staff route transitions, one provider load, provider
failure, and spoofed bridge messages using a local fixture. Real-provider tests
remain opt-in and are not rerun from the blocked coding environment. The earlier
six successful Mac checks are recorded above; the former inactive-state check is
now replaced with an explicit enabled-state regression.

The user separately owns GHL agent activation, phone concierge and appointment
configuration. Option 3 was confirmed by the user as 877-791-6153, with human
transfer 801-864-1009; recording these values does not configure or test routing.
No GHL settings, Hailey, phone routing, authentication, permissions or backend
changes are included in this frontend rollout. No messages or calls are sent.

Local rollout checks passed: TypeScript, 14 focused tests (11 chat policy/config
and 3 preserved employee-email tests), four non-provider browser checks, build,
and diff checks. Both built frame files match public source byte-for-byte.
