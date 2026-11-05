import { describe, expect, it } from "vitest";
import {
  EMPTY_SIGNATURE,
  isContractorPolicyRequired,
  signatureComplete,
  signatureErrorFor,
  signaturePayload,
} from "../ContractorPolicy";

describe("employee waiver signature", () => {
  it("needs a full name, and a drawing when Draw is chosen", () => {
    expect(signatureComplete(EMPTY_SIGNATURE)).toBe(false);
    expect(signatureComplete({ name: "  ", type: "typed", image: null })).toBe(false);
    expect(signatureComplete({ name: "Jane Doe", type: "typed", image: null })).toBe(true);
    expect(signatureComplete({ name: "Jane Doe", type: "drawn", image: null })).toBe(false);
    expect(signatureComplete({ name: "Jane Doe", type: "drawn", image: "data:image/png;base64,AA==" })).toBe(true);
    expect(signatureErrorFor({ name: "Jane Doe", type: "drawn", image: null })).toMatch(/Draw your signature/);
    expect(signatureErrorFor({ name: "Jane Doe", type: "typed", image: null })).toBeUndefined();
  });

  it("sends the drawing only for a drawn signature", () => {
    expect(signaturePayload({ name: " Jane ", type: "typed", image: "stale" })).toEqual({
      signatureName: "Jane",
      signatureType: "typed",
    });
    expect(signaturePayload({ name: "Jane", type: "drawn", image: "data:image/png;base64,AA==" })).toEqual({
      signatureName: "Jane",
      signatureType: "drawn",
      signatureImage: "data:image/png;base64,AA==",
    });
  });

  it("recognises the clock-in refusal code", () => {
    expect(isContractorPolicyRequired({ code: "CONTRACTOR_POLICY_REQUIRED" })).toBe(true);
    expect(isContractorPolicyRequired({ code: "CLOCK_IN_LOCATION_REQUIRED" })).toBe(false);
    expect(isContractorPolicyRequired(null)).toBe(false);
  });
});
