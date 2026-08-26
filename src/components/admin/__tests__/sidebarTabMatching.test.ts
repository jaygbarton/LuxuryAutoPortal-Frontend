/**
 * The sidebar's active-item matching, once tab sub-items address themselves
 * with a query string (/admin/operations?tab=maintenance). Getting this wrong
 * lights up every Operations child at once, or none of them.
 */
import { describe, it, expect } from "vitest";

// Mirror of isPathActive in admin-layout.tsx.
const isPathActive = (pathname: string, href: string, currentSearch = "") => {
  const [hrefPath, hrefQuery] = href.split("?");
  if (hrefQuery != null) {
    const [key, value] = hrefQuery.split("=");
    return pathname === hrefPath && new URLSearchParams(currentSearch).get(key) === value;
  }
  if (pathname === hrefPath) return true;
  if (hrefPath === "/dashboard") return false;
  return pathname.startsWith(hrefPath + "/");
};

describe("sidebar tab matching", () => {
  it("matches the tab whose query is current, and only that one", () => {
    const search = "tab=maintenance";
    expect(isPathActive("/admin/operations", "/admin/operations?tab=maintenance", search)).toBe(true);
    expect(isPathActive("/admin/operations", "/admin/operations?tab=claims", search)).toBe(false);
    expect(isPathActive("/admin/operations", "/admin/operations?tab=inspections", search)).toBe(false);
  });

  it("matches the default (query-less) tab when no tab param is present", () => {
    expect(isPathActive("/admin/operations", "/admin/operations", "")).toBe(true);
  });

  it("does not match a different page's path", () => {
    expect(isPathActive("/admin/forms", "/admin/operations?tab=claims", "tab=claims")).toBe(false);
  });

  it("ignores unrelated params, so subcategory deep links still highlight", () => {
    const search = "section=employee-forms&category=cogs&field=mechanic";
    expect(
      isPathActive("/admin/forms", "/admin/forms?section=employee-forms", search),
    ).toBe(true);
    expect(
      isPathActive("/admin/forms", "/admin/forms?section=referral-forms", search),
    ).toBe(false);
  });

  it("keeps prefix matching for ordinary nav items", () => {
    expect(isPathActive("/admin/bouncie-devices", "/admin/bouncie")).toBe(false);
    expect(isPathActive("/admin/cars/12", "/admin/cars")).toBe(true);
  });
});
