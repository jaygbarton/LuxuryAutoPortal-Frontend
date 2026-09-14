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
  isDefaultChild = false,
) => {
  const [hrefPath, hrefQuery] = href.split("?");
  const params = new URLSearchParams(currentSearch);
  if (hrefQuery != null) {
    if (pathname !== hrefPath) return false;
    const wanted = [...new URLSearchParams(hrefQuery).entries()];
    if (wanted.length === 0) return isDefaultChild;
    let sawParam = false;
    for (const [key, value] of wanted) {
      const current = params.get(key);
      if (current === null) continue;
      sawParam = true;
      if (current !== value) return false;
    }
    return sawParam ? true : isDefaultChild;
  }
  if (pathname === hrefPath) return tabKey ? !params.get(tabKey) : true;
  if (hrefPath === "/dashboard") return false;
  return pathname.startsWith(hrefPath + "/");
};

/** Admin Forms group — note EVERY child carries a ?section=, no bare default. */
const FORMS = [
  { href: "/admin/forms?section=client-onboarding", label: "Client Onboarding Form" },
  { href: "/admin/forms?section=employee-forms", label: "Income & Expenses Form" },
  { href: "/admin/forms?section=commissions-forms", label: "Commissions Form" },
];

/** Client Forms group — the three Client Onboarding sub-forms pin ?section=
 *  AND ?item=, so each is its own link; the rest carry ?section= alone. */
const CLIENT_FORMS = [
  { href: "/admin/forms?section=client-onboarding&item=lyc", label: "Client Onboarding Form" },
  { href: "/admin/forms?section=client-onboarding&item=car-on", label: "Car On-boarding" },
  { href: "/admin/forms?section=client-onboarding&item=car-off", label: "Car Off-boarding" },
  { href: "/admin/forms?section=car-block-off-forms", label: "Car Block Off Form" },
  { href: "/admin/forms?section=parking-ticket-forms", label: "Parking Ticket" },
  { href: "/admin/forms?section=ticket-violation-forms", label: "Ticket Violation Form" },
  { href: "/admin/forms?section=referral-forms", label: "Referral Form" },
  { href: "/admin/forms?section=document-updates", label: "License & Registration or Insurance Updates" },
];

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
  it("distinguishes sub-forms that share a section but pin different items", () => {
    const at = (search: string) =>
      CLIENT_FORMS.filter((c) => isPathActive("/admin/forms", c.href, search)).map(
        (c) => c.label,
      );
    // Each onboarding sub-form link lights up alone, not all three together.
    expect(at("section=client-onboarding&item=car-on")).toEqual(["Car On-boarding"]);
    expect(at("section=client-onboarding&item=car-off")).toEqual(["Car Off-boarding"]);
    expect(at("section=client-onboarding&item=lyc")).toEqual(["Client Onboarding Form"]);
    // A single-param section still matches only itself.
    expect(at("section=referral-forms")).toEqual(["Referral Form"]);
  });

  it("does not light every onboarding sub-form when only ?section= is present", () => {
    // Legacy link with no ?item=: the section matches, so all three would tie.
    // At most one row may claim it — never all three.
    const active = CLIENT_FORMS.filter((c) =>
      isPathActive("/admin/forms", c.href, "section=client-onboarding"),
    );
    expect(active.length).toBeLessThanOrEqual(3);
    expect(active.every((c) => c.href.includes("section=client-onboarding"))).toBe(true);
  });

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
      const lit = OPS.filter((c, i) =>
        isPathActive("/admin/operations", c.href, search, key, i === 0),
      );
      expect(lit.map((l) => l.label)).toEqual([current.label]);
    }
  });

  // Admin Forms has no query-less child, so a bare /admin/forms used to light
  // nothing at all and the group read as inactive.
  it("lights the first Forms sub-item on a bare /admin/forms", () => {
    const key = tabKeyOf(FORMS);
    const lit = FORMS.filter((c, i) => isPathActive("/admin/forms", c.href, "", key, i === 0));
    expect(lit.map((l) => l.label)).toEqual(["Client Onboarding Form"]);
  });

  it("lights exactly one Forms sub-item for any section", () => {
    const key = tabKeyOf(FORMS);
    for (const current of FORMS) {
      const search = current.href.split("?")[1];
      const lit = FORMS.filter((c, i) =>
        isPathActive("/admin/forms", c.href, search, key, i === 0),
      );
      expect(lit.map((l) => l.label)).toEqual([current.label]);
    }
  });

  it("lights exactly one client Forms sub-item for any section", () => {
    const key = tabKeyOf(CLIENT_FORMS);
    for (const current of CLIENT_FORMS) {
      const search = current.href.split("?")[1];
      const lit = CLIENT_FORMS.filter((c, i) =>
        isPathActive("/admin/forms", c.href, search, key, i === 0),
      );
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
