import { describe, expect, it } from "vitest";
import {
  createDomRecoveryMarker,
  isExternalDomMutationError,
  shouldReloadAfterDomMutation,
} from "../domMutationRecovery";

describe("external DOM mutation recovery", () => {
  it("recognizes DOM ownership errors", () => {
    expect(
      isExternalDomMutationError(
        new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."),
      ),
    ).toBe(true);
    expect(isExternalDomMutationError(new Error("Failed to fetch"))).toBe(false);
  });

  it("allows one reload per URL within the recovery window", () => {
    const now = 1_000_000;
    const marker = createDomRecoveryMarker("https://example.com/admin", now);

    expect(shouldReloadAfterDomMutation(null, "https://example.com/admin", now)).toBe(true);
    expect(shouldReloadAfterDomMutation(marker, "https://example.com/admin", now + 1_000)).toBe(false);
    expect(shouldReloadAfterDomMutation(marker, "https://example.com/dashboard", now + 1_000)).toBe(true);
    expect(shouldReloadAfterDomMutation(marker, "https://example.com/admin", now + 60_001)).toBe(true);
  });

  it("recovers from an invalid stored marker", () => {
    expect(shouldReloadAfterDomMutation("not-json", "https://example.com/admin")).toBe(true);
  });
});
