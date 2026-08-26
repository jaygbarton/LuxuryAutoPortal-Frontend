/**
 * The sidebar's active-item matching, once tab sub-items address themselves
 * with a query string (/admin/operations?tab=maintenance). Getting this wrong
 * lights up every Operations child at once, or none of them.
 */
import { describe, it, expect } from "vitest";

// Mirror of isPathActive / tabKeyOf in admin-layout.tsx.
const isPathActive = (
  pathname: string,
  href: string,
  currentSearch = "",
  tabKey?: string,
) => {
  const [hrefPath, hrefQuery] = href.split("?");
  const params = new URLSearchParams(currentSearch);
  if (hrefQuery != null) {
    const [key, value] = hrefQuery.split("=");
    return pathname === hrefPath && params.get(key) === value;
  }
  if (pathname === hrefPath) return tabKey ? !params.get(tabKey) : true;
  if (hrefPath === "/dashboard") return false;
  return pathname.startsWith(hrefPath + "/");
};

const tabKeyOf = (children: { href: string }[]) => {
  for (const c of children) {
    const q = c.href.split("?")[1];
    if (q) return q.split("=")[0];
  }
  return undefined;
};

/** The Operations group, as the sidebar declares it. */
const OPS = [
  { href: "/admin/operations", label: "Trips Overview" },
  { href: "/admin/operations?tab=turo-inspection", label: "Turo Messages" },
  { href: "/admin/operations?tab=inspections", label: "Car Issues" },
  { href: "/admin/operations?tab=maintenance", label: "Maintenance" },
];

describe("sidebar tab matching", () => {
  it("matches the tab whose query is current, and only that one", () => {
    const search = "tab=maintenance";
    expect(isPathActive("/admin/operations", "/admin/operations?tab=maintenance", search)).toBe(true);
    expect(isPathActive("/admin/operations", "/admin/operations?tab=claims", search)).toBe(false);
    expect(isPathActive("/admin/operations", "/admin/operations?tab=inspections", search)).toBe(false);
  });

  it("matches the default (query-less) tab when no tab param is present", () => {
    expect(isPathActive("/admin/operations", "/admin/operations", "", "tab")).toBe(true);
  });

  // The reported bug: clicking a second sub-category left the FIRST one lit,
  // because the query-less default child matched on pathname alone.
  it("un-highlights the default tab once another tab is open", () => {
    expect(
      isPathActive("/admin/operations", "/admin/operations", "tab=commission", "tab"),
    ).toBe(false);
  });

  it("lights exactly one sub-item for any tab in the group", () => {
    const key = tabKeyOf(OPS);
    for (const current of OPS) {
      const search = current.href.split("?")[1] ?? "";
      const lit = OPS.filter((c) => isPathActive("/admin/operations", c.href, search, key));
      expect(lit.map((l) => l.label)).toEqual([current.label]);
    }
  });

  it("does not match a different page's path", () => {
    expect(isPathActive("/admin/forms", "/admin/operations?tab=claims", "tab=claims")).toBe(false);
  });

  it("ignores unrelated params, so subcategory deep links still highlight", () => {
    const search = "section=employee-forms&category=cogs&field=mechanic";
    expect(
      isPathActive("/admin/forms", "/admin/forms?section=employee-forms", search, "section"),
    ).toBe(true);
    expect(
      isPathActive("/admin/forms", "/admin/forms?section=referral-forms", search, "section"),
    ).toBe(false);
  });

  it("keeps prefix matching for ordinary nav items", () => {
    expect(isPathActive("/admin/bouncie-devices", "/admin/bouncie")).toBe(false);
    expect(isPathActive("/admin/cars/12", "/admin/cars")).toBe(true);
  });
});
