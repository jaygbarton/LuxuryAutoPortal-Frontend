import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Flow 1: Log in as an employee.
//
// dashboard-router.tsx redirects any authenticated non-admin/non-client user
// (i.e. isEmployee) to /staff/dashboard, distinct from the admin/client
// /dashboard route. This test only asserts the login + redirect mechanics —
// it deliberately doesn't assert on staff/dashboard page content, since that
// page isn't part of this flow.
test("employee can log in and lands on the staff dashboard", async ({ page }) => {
  await loginAs(page, "employee");

  await expect(page).toHaveURL(/\/staff\/dashboard/);

  // Confirm the session is actually recognized as an employee, not silently
  // falling through to the generic /dashboard admin/client branch.
  const me = await page.request.get("/api/auth/me");
  expect(me.ok()).toBeTruthy();
  const body = await me.json();
  expect(body.user?.isEmployee).toBe(true);
  expect(body.user?.isAdmin).toBeFalsy();
});
