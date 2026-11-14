import { describe, expect, it } from "vitest";
import { assistantInstructions, type HubIndex } from "../AssistantAccess";

describe("assistant instructions", () => {
  it("are built from the live index and never contain a key", () => {
    const index: HubIndex = {
      schemaVersion: 2,
      caller: { type: "staff", name: "admin", scopes: ["operations", "financials"] },
      rules: ["Never invent mileage."],
      startHere: ["Call fleet-attention first."],
      endpoints: [{ id: "fleet", path: "/api/ai-hub/fleet", scope: "operations", summary: "Every active vehicle.", available: true }],
    };
    const text = assistantInstructions(index, "https://goldenluxuryauto.com");
    expect(text).toContain("GET https://goldenluxuryauto.com/api/ai-hub");
    expect(text).toContain("- Never invent mileage.");
    expect(text).toContain("- GET /api/ai-hub/fleet (operations): Every active vehicle.");
    expect(text).not.toMatch(/glahub_/);
  });
});
