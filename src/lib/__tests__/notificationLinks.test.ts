import { describe, expect, it } from "vitest";
import { normalizeNotificationLink } from "../notificationLinks";

describe("stored notification links", () => {
  const legacyLink = "https://luxury-auto-portal-frontend.vercel.app/admin/forms?section=employee-forms&item=42#receipt";

  it.each(["https://goldenluxuryauto.com", "https://www.goldenluxuryauto.com"])(
    "keeps an old production-alias link on %s with its query and fragment",
    (origin) => {
      expect(normalizeNotificationLink(legacyLink, origin))
        .toBe("/admin/forms?section=employee-forms&item=42#receipt");
    },
  );

  it("keeps a double-slash alias path root-relative on the company site", () => {
    const link = "https://luxury-auto-portal-frontend.vercel.app//attacker.example/admin/forms?item=42#receipt";
    const normalized = normalizeNotificationLink(link, "https://goldenluxuryauto.com");
    expect(normalized).toBe("/attacker.example/admin/forms?item=42#receipt");
    expect(new URL(normalized, "https://goldenluxuryauto.com").origin)
      .toBe("https://goldenluxuryauto.com");
  });

  it.each([
    "https://luxury-auto-portal-frontend.vercel.app",
    "https://luxury-auto-portal-frontend-preview.vercel.app",
    "http://localhost:5300",
    "https://app.goldenluxuryauto.com",
  ])("does not change preview, local, or legacy app navigation on %s", (origin) => {
    expect(normalizeNotificationLink(legacyLink, origin)).toBe(legacyLink);
  });

  it.each([
    "https://goldenluxuryauto.com/admin/forms?section=employee-forms#receipt",
    "/admin/forms?section=employee-forms#receipt",
    "https://turo.com/us/en/host/4325673",
    "https://luxury-auto-portal-frontend-preview.vercel.app/admin/forms",
    "https://luxury-auto-portal-frontend.vercel.app.example.com/admin/forms",
    "http://luxury-auto-portal-frontend.vercel.app/admin/forms",
    "https://luxury-auto-portal-frontend.vercel.app:8443/admin/forms",
    "not-a-url",
  ])("leaves other destinations unchanged: %s", (link) => {
    expect(normalizeNotificationLink(link, "https://goldenluxuryauto.com")).toBe(link);
  });
});
