import { Page, expect } from "@playwright/test";

export type TestRole = "admin" | "employee" | "client";

export interface TestCredentials {
  email: string;
  password: string;
}

// Test-only accounts. See e2e/README.md for the fixture setup script that
// creates these `user` (and, for the client role, `client`) rows.
export const CREDENTIALS: Record<TestRole, TestCredentials> = {
  admin: { email: "e2e-admin@gla.local", password: "E2eTest@123" },
  employee: { email: "e2e-employee@gla.local", password: "E2eTest@123" },
  client: { email: "e2e-client@gla.local", password: "E2eTest@123" },
};

/**
 * Logs in through the real /admin/login form (no API shortcuts) and waits
 * for the post-login redirect, matching the 800ms cookie-propagation delay
 * and /dashboard -> role-specific redirect in dashboard-router.tsx.
 */
export async function loginAs(page: Page, role: TestRole) {
  const { email, password } = CREDENTIALS[role];

  await page.goto("/admin/login");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });

  if (role === "employee") {
    await page.waitForURL((url) => url.pathname.startsWith("/staff/dashboard"), { timeout: 15_000 });
  } else {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  }
}
