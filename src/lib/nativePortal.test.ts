import { describe, expect, it } from "vitest";
import { installNativeHistory, isNativeRootPath, nativePortalPath, shouldRefreshNativeQuery } from "./nativePortal";

describe("native app URL routing", () => {
  it("keeps approved HTTPS deep links on the current first-party origin", () => {
    expect(nativePortalPath("https://goldenluxuryauto.com/admin/operations?tab=day-schedule#task-4")).toBe("/admin/operations?tab=day-schedule#task-4");
    expect(nativePortalPath("https://www.goldenluxuryauto.com/staff/time")).toBe("/staff/time");
    expect(nativePortalPath("https://goldenluxuryauto.com/reset-password?token=one-time-token")).toBe("/reset-password?token=one-time-token");
  });
  it.each([
    "https://goldenluxuryauto.com.evil.test/dashboard", "https://evil.test/admin",
    "https://app.goldenluxuryauto.com/portal", "https://luxury-auto-portal-frontend.vercel.app/dashboard",
    "javascript:alert(1)", "http://goldenluxuryauto.com/dashboard", "//goldenluxuryauto.com/dashboard",
    "https://user:password@goldenluxuryauto.com/dashboard", "https://goldenluxuryauto.com:444/dashboard",
    "https://goldenluxuryauto.com//evil.test", "https://goldenluxuryauto.com/%2fevil.test",
    "https://goldenluxuryauto.com/api/auth/me", "https://goldenluxuryauto.com/uploads/private.pdf",
  ])("rejects untrusted or non-page link %s", url => expect(nativePortalPath(url)).toBeNull());
});

function fakeHistory() {
  const entries: unknown[] = [{ externalEntry: true }, { wouterState: "initial" }];
  let position = 1;
  const history = {
    get state() { return entries[position]; },
    pushState(state: unknown) { entries.splice(position + 1); entries.push(state); position++; },
    replaceState(state: unknown) { entries[position] = state; },
    back() { if (position > 0) position--; },
    forward() { if (position + 1 < entries.length) position++; },
  } as unknown as History;
  return history;
}

describe("native back stack", () => {
  it("treats login and role dashboards as roots to avoid authentication redirect loops", () => {
    for (const path of ["/admin/login", "/dashboard", "/staff/dashboard", "/client/dashboard/"]) expect(isNativeRootPath(path)).toBe(true);
    expect(isNativeRootPath("/staff/time")).toBe(false);
  });
  it("never backs into a document predating this app session", () => {
    const history = fakeHistory();
    const runtime = installNativeHistory({ history });
    expect(runtime.canGoBack()).toBe(false);
    expect(history.state.wouterState).toBe("initial");
    history.pushState({ task: 41 }, "", "/staff/task-management");
    expect(runtime.canGoBack()).toBe(true);
    history.replaceState({ task: 42 }, "", "/staff/task-management?task=42");
    expect(runtime.canGoBack()).toBe(true);
    expect(history.state.task).toBe(42);
    history.back();
    expect(runtime.canGoBack()).toBe(false);
    history.forward();
    expect(runtime.canGoBack()).toBe(true);
    runtime.dispose();
  });
  it("handles backward navigation followed by a new branch", () => {
    const history = fakeHistory();
    const runtime = installNativeHistory({ history });
    history.pushState(null, "", "/staff/forms");
    history.pushState(null, "", "/staff/time");
    history.back();
    history.pushState(null, "", "/staff/task-management");
    history.back();
    expect(runtime.canGoBack()).toBe(true);
    history.back();
    expect(runtime.canGoBack()).toBe(false);
    runtime.dispose();
  });
  it("restores history methods without changing other integrations", () => {
    const history = fakeHistory();
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const runtime = installNativeHistory({ history });
    runtime.dispose();
    expect(history.pushState).toBe(originalPush);
    expect(history.replaceState).toBe(originalReplace);
    const second = installNativeHistory({ history });
    const laterWrapper = () => {};
    history.pushState = laterWrapper;
    second.dispose();
    expect(history.pushState).toBe(laterWrapper);
  });
});

it("resume refreshes operational reads without triggering form options or mutations", () => {
  expect(shouldRefreshNativeQuery(["/api/operations/day-schedule", "2026-10-18"])).toBe(true);
  expect(shouldRefreshNativeQuery(["/api/internal-calendar/events"])).toBe(true);
  expect(shouldRefreshNativeQuery(["/api/auth/me"])).toBe(true);
  expect(shouldRefreshNativeQuery(["/api/expense-form-submissions/options"])).toBe(false);
  expect(shouldRefreshNativeQuery(["/api/receipt-ocr"])).toBe(false);
  expect(shouldRefreshNativeQuery([null])).toBe(false);
});
