import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guards the point of Phase 4: every place that used to hardcode
 * "America/Denver" now reads getActiveTimezone() (or the tz parameter on
 * mt-datetime.ts's own functions) instead, so the app actually honors a
 * user's timezone preference. Without this check, the next date-formatting
 * change quietly reintroduces a hardcoded literal and the count creeps back
 * toward the 108 occurrences this phase started from.
 *
 * This project has no ESLint config (checked: no .eslintrc*, no eslint
 * dependency, no lint script in package.json — CLAUDE.md's documented
 * `npm run lint` does not currently exist), so a no-restricted-syntax rule
 * has nowhere to live. This test is the equivalent guard using what the
 * project actually runs.
 */

const SRC_DIR = join(__dirname, "..");

// Files allowed to hold the literal, each for a specific reason (see the
// comment at that file's own occurrence for the full explanation):
const ALLOWED_FILES = new Set([
  // The datetime lib itself — its `tz` parameters default to this.
  "src/lib/mt-datetime.ts",
  "src/hooks/use-timezone.ts",

  // Feeds a backend query window (?from=/?to=/day-bucketing param) rather
  // than rendering to the screen — changing this is Phase 5 (backend SQL
  // day-bucketing) territory, not a display fix. Converting it now would
  // desync what's requested from what the backend actually returns.
  "src/components/admin/dashboard/OperationsSection.tsx",
  "src/components/shared/TripCalendar.tsx",
  "src/pages/admin/bouncie-trips.tsx",
  "src/pages/client/vehicle-trips.tsx",
  "src/pages/admin/operations/DayScheduleTab.tsx",
  "src/pages/staff/time.tsx",

  // Round-trips a write: an admin edits a raw stored value (a clock-in/out,
  // an invoice date) through a plain date/time input. The value must read
  // and save identically regardless of which zone the editing admin is in,
  // or two admins would silently disagree on what they saved.
  "src/pages/admin/hr/time.tsx",
  "src/pages/admin/co-host-payments.tsx",

  // Reverses an already-Mountain-Time-collapsed string from the Day Schedule
  // API back into a UTC instant. The string has no timezone marker of its
  // own and genuinely IS Mountain Time regardless of viewer — needs the
  // backend to emit raw UTC fields first (Phase 5's "Day Schedule payload"
  // step) before this can honor a per-viewer zone.
  "src/pages/admin/operations/TvTimelineTab.tsx",

  // Cross-references Turo's own fixed Mountain-Time display (booking emails,
  // the Turo app). Showing a viewer's own local projection instead would
  // make this LESS useful for that comparison, not more correct.
  "src/pages/admin/turo-trips.tsx",

  // Public, unauthenticated, token-based page (email approve/decline link) —
  // there is no logged-in session for getActiveTimezone() to read.
  "src/pages/maintenance-approval.tsx",

  // A quick-filter button ("Today" / "Last 7 days") that sets state sent to
  // the backend as a query param — same reasoning as the query-window group
  // above, just structured as an inline literal rather than a named const.
  "src/pages/admin/forms/ExpenseFormApprovalDashboard.tsx",
]);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("no hardcoded America/Denver outside the timezone lib", () => {
  it("every occurrence lives in an allowed file", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_DIR)) {
      const relPath = relative(join(SRC_DIR, ".."), file).replace(/\\/g, "/");
      if (ALLOWED_FILES.has(relPath)) continue;
      const content = readFileSync(file, "utf8");
      if (content.includes("America/Denver")) {
        offenders.push(relPath);
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Hardcoded "America/Denver" found outside the timezone lib in:\n` +
          offenders.map((f) => `  - ${f}`).join("\n") +
          `\n\nRoute this through getActiveTimezone() (from @/hooks/use-timezone) ` +
          `or an mt-datetime.ts function's tz parameter instead, so it follows ` +
          `the viewer's preference. If this occurrence genuinely must stay pinned ` +
          `to the org timezone (a shared calendar event, a cron anchor, a value ` +
          `coupled to another org-time value elsewhere in the same file), add it ` +
          `to ALLOWED_FILES here with a comment explaining why.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
