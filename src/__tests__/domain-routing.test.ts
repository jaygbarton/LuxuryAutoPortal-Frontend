import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
const isAppHost = (rule: any) => rule.has?.some(
  (condition: any) => condition.type === "host" && condition.value === "app.goldenluxuryauto.com",
);

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
    for (const source of ["/rest/:path*", "/api/:path*", "/img/:path*"]) {
      const index = config.rewrites.findIndex((rule: any) => rule.source === source);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(appIndex);
    }
    expect(config.rewrites.find((rule: any) => rule.source === "/rest/:path*").destination)
      .toBe("https://luxuryautoportal-replit-1.onrender.com/rest/:path*");
    expect(config.rewrites.find((rule: any) => rule.source === "/img/:path*" && isAppHost(rule)).destination)
      .toBe("/legacy-img/:path*");
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
