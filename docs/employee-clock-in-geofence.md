# Employee clock-in geofence

Prepared October 26, 2026. Deployment authorized October 30, 2026.
Reconciled with both current remote main branches before release. Git pushes use
the existing Vercel/Render automatic deployment path. A successful push is not
proof of a completed deployment; confirm hosted versions independently.

## Owner-approved rule

Employee clock-ins require a fresh browser location within **300 meters** of
**40.76904610555129, -111.94181788921198**, the owner-confirmed center of
Diamond Parking & Storage, 50 S Redwood Road, Salt Lake City.

Admins and super admins are exempt, including accounts that also have an employee
role and admins using View as Employee. Exemption uses authenticated server session
roles, never flags supplied by the client. Clock-in does not require a 1099
agreement. Clock-out has no location requirement.

## Implementation

Backend `src/services/clockInGeofence.ts` calculates spherical distance in meters.
`src/routes/timeSheet.ts` enforces it on both `POST /api/me/time-sheet/clock-in`
and the clock-in branch of the legacy `POST /api/me/time-sheet/action`.
`GET /api/me/time-sheet/clock-in-policy` is authenticated, uncached, and tells the
browser whether this session requires location.

Frontend `src/lib/clockInLocation.ts` requests high accuracy, no cached position,
and a 15-second timeout on each employee clock-in attempt. Both staff and admin
Time Sheet pages use it. A refused location never sends a clock-in POST. Errors
appear beside the clock controls and in a toast; the button indicates location lookup.

The server rejects malformed coordinates, readings older than 60 seconds or more
than 30 seconds in the future, and accuracy worse than 100 meters. Accuracy does
not enlarge the 300-meter boundary. These quality checks can require employees
to enable precise location or move to a clearer signal.

Browser/OS settings control whether permission persists. The site requests a
position again on each attempt but cannot force a native prompt after a persistent
block; the error explains how to allow location in site settings. HTTPS is required
in production. This is a browser-reported-location check, not device attestation:
a modified client or location-spoofing device can fabricate a reading. This change
does not persist GPS coordinates or perform background/continuous tracking.

## Workspace and base

Both branches: `employee-clock-in-geofence`.

- Backend: `/workspace/LuxuryAutoPortal-Replit-clock-in-geofence`, base
  `47727ab8af81764efa577d7f03c8ae1297b5be40`; release parent
  `71c67da7ff95d7718037737140ffb06d83924899`.
- Frontend: `/workspace/LuxuryAutoPortal-Frontend-clock-in-geofence`, base
  `f6d2be122d16a51fc7d18a841800f035996c2ec7`; release parent
  `ea815cdfc57e57ea7be131a02e94e35bf3e834ef`.

These are isolated Git worktrees in the coding workspace, not edits to a live
Replit editor. Existing developer/user work remains in its original worktrees.
Local node_modules symlinks are development dependencies, not part of this change.

## Verification

- Backend focused geofence and contractor-policy route tests: 29 passed.
- Frontend location-permission unit tests: 6 passed.
- Playwright actual Time Sheet pages with mocked APIs/location: 3 passed
  (390px employee denial/retry, admin exemption, super-admin exemption).
- Frontend and backend TypeScript checks and production builds passed.
- Both worktrees pass `git diff --check`.
- Browser tests make no real clock entries or notifications.

Commands:

```sh
# Backend worktree
cd backend
npm test -- src/services/__tests__/clockInGeofence.test.ts src/routes/__tests__/contractorPolicyGate.test.ts
npm run lint
npm run build

# Frontend worktree
npm test -- src/lib/clockInLocation.test.ts
npm run lint
npx playwright test --config playwright.clock-in.config.ts
npm run build
```

## Release / real-device check

No database migration or new secret is needed. Review and reconcile these scoped
changes with current main before publishing. Both backend and frontend are required:
an older frontend cannot supply location to the new backend; a new frontend cannot
read clock-in policy from the old backend. Coordinate their release and have users
refresh their tabs. Never remove the server gate as a rollout workaround.

After deployment, verify an actual employee device at the lot and outside 300m,
including browser permission denied and then enabled in site settings. Verify admin
and super-admin clock-in without permission and unrestricted clock-out. Real-device
GPS and production deployment have not been tested in this coding workspace.

Release verification limitation (October 30): the coding environment returned
proxy `403 Forbidden` for the public Golden site and GitHub deployment-status
API. Public runtime verification requires an allowed browser/network connection.
No production clock entries are made by these checks.

## Employee waiver required before clock-in (November 5)

The Oct 31 removal of the agreement prerequisite is reversed at the client's
request: the GLA Contractor Policy 1099 is replaced by the **GLA - Independent
Contractor or W-2 Employee Waiver**, and employees must sign it before they can
clock in.

- Admins publish it themselves in Admin → Settings (title, text, document link).
  Until text or a link is saved, nothing is required. Saving with "every
  employee must sign it again" starts a new version.
- Employees sign on the Employee Onboarding Form, or in a prompt shown after they
  log in, with a typed or drawn signature (same choice as the client contract).
- Both clock-in endpoints refuse an unsigned non-admin employee with
  `code: CONTRACTOR_POLICY_REQUIRED`; the staff and admin clock pages open the
  waiver and continue the clock-in once it is signed. Admins, super admins and
  View as Employee sessions are exempt, by session role, like the geofence.
- 1099 signatures are kept as version 1 and shown as history on the profile;
  they no longer satisfy the requirement.

The geofence, admin exemptions and clock-out workflow are unchanged.
