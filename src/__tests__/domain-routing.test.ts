import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
const isAppHost = (rule: any) => rule.has?.some(
  (condition: any) => condition.type === "host" && condition.value === "app.goldenluxuryauto.com",
);

function apiDestination(host: string, path: string): string | undefined {
  for (const rule of config.rewrites) {
    if (!rule.source.includes(":path*")) continue;
    if (rule.has && !rule.has.every((condition: any) =>
      condition.type === "host" && condition.value === host,
    )) continue;
    const prefix = rule.source.replace(":path*", "");
    if (path.startsWith(prefix)) return rule.destination.replace(":path*", path.slice(prefix.length));
  }
}

describe("production domain routing", () => {
  it("serves the old portal for app-domain SPA routes and the new portal otherwise", () => {
    const appIndex = config.rewrites.findIndex((rule: any) => rule.source === "/:path*" && isAppHost(rule));
    expect(appIndex).toBeGreaterThanOrEqual(0);
    expect(config.rewrites[appIndex].destination).toBe("/legacy-index.html");
    const fallbackIndex = config.rewrites.findIndex((rule: any) => !rule.has && rule.destination === "/index.html");
    expect(fallbackIndex).toBeGreaterThan(appIndex);
    // Legacy login remains on the app host, rather than redirecting to the new portal.
    expect(config.redirects.find((rule: any) => rule.source === "/" && isAppHost(rule)).destination)
      .toBe("https://app.goldenluxuryauto.com/login");
  });

  it("keeps legacy API and image routes ahead of the HTML fallback", () => {
    const appIndex = config.rewrites.findIndex((rule: any) => rule.source === "/:path*" && isAppHost(rule));
    for (const source of ["/rest/:path*", "/api/:path*", "/img/:path*", "/portal/rest/:path*", "/portal/img/:path*", "/carrental/:path*"]) {
      const index = config.rewrites.findIndex((rule: any) => rule.source === source);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(appIndex);
    }
    expect(config.rewrites.find((rule: any) => rule.source === "/rest/:path*").destination)
      .toBe("https://luxuryautoportal-replit-1.onrender.com/rest/:path*");
    expect(config.rewrites.find((rule: any) => rule.source === "/img/:path*" && isAppHost(rule)).destination)
      .toBe("https://legacy-origin.goldenluxuryauto.com/portal/img/:path*");
  });

  it("sends old-portal authentication and data requests to the original legacy API", () => {
    const legacyIndex = config.rewrites.findIndex((rule: any) =>
      rule.source === "/rest/gla/:path*" && isAppHost(rule),
    );
    const genericRestIndex = config.rewrites.findIndex((rule: any) =>
      rule.source === "/rest/:path*" && !rule.has,
    );
    expect(legacyIndex).toBeGreaterThanOrEqual(0);
    expect(legacyIndex).toBeLessThan(genericRestIndex);
    const legacy = config.rewrites[legacyIndex];
    expect(legacy.has).toEqual([{ type: "host", value: "app.goldenluxuryauto.com" }]);
    expect(legacy.destination).toBe("https://legacy-origin.goldenluxuryauto.com/portal/rest/v1/:path*");
    // Both credential checks and token restoration must use the same backend
    // as the legacy data routes, without requiring a new-portal session first.
    for (const path of [
      "user-other/login", "user-other/token", "user-system/login", "user-system/token",
      "car/page/1", "car/read-by-id", "car-history/read-by-date-and-year",
    ]) {
      expect(apiDestination("app.goldenluxuryauto.com", `/portal/rest/v1/${path}`))
        .toBe(`https://legacy-origin.goldenluxuryauto.com/portal/rest/v1/${path}`);
      expect(apiDestination("app.goldenluxuryauto.com", `/rest/gla/${path}`))
        .toBe(`https://legacy-origin.goldenluxuryauto.com/portal/rest/v1/${path}`);
      expect(apiDestination("goldenluxuryauto.com", `/rest/gla/${path}`))
        .toBe(`https://luxuryautoportal-replit-1.onrender.com/rest/gla/${path}`);
    }
    for (const path of ["/portal/img/receipt.jpg", "/img/car.jpg", "/carrental/rest/v1/user-other/token"]) {
      const upstreamPath = path.startsWith("/img/") ? `/portal${path}` : path;
      expect(apiDestination("app.goldenluxuryauto.com", path))
        .toBe(`https://legacy-origin.goldenluxuryauto.com${upstreamPath}`);
      expect(apiDestination("goldenluxuryauto.com", path))
        .toBeUndefined();
    }
    // The new site keeps its existing backend routing and authentication.
    expect(config.rewrites[genericRestIndex].destination)
      .toBe("https://luxuryautoportal-replit-1.onrender.com/rest/:path*");
    expect(config.rewrites.find((rule: any) => rule.source === "/api/:path*").destination)
      .toBe("https://luxuryautoportal-replit-1.onrender.com/api/:path*");
    for (const host of ["app.goldenluxuryauto.com", "goldenluxuryauto.com"]) {
      expect(apiDestination(host, "/api/auth/login"))
        .toBe("https://luxuryautoportal-replit-1.onrender.com/api/auth/login");
    }
  });

  it("ships the legacy entry point and every referenced legacy bundle", () => {
    const html = readFileSync(new URL("public/legacy-index.html", root), "utf8");
    const assets = [...html.matchAll(/(?:src|href)="(\/legacy-assets\/[^\"]+)"/g)];
    expect(assets.length).toBeGreaterThanOrEqual(3);
    for (const [, asset] of assets) {
      expect(existsSync(new URL(`public${asset}`, root)), asset).toBe(true);
    }
  });
});
