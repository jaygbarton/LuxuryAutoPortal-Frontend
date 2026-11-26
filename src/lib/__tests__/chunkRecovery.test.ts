import { describe, expect, it } from "vitest";
import { isChunkLoadError, shouldAttemptChunkReload } from "@/lib/chunkRecovery";

describe("isChunkLoadError", () => {
  it("recognises the stale page error", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://goldenluxuryauto.com/assets/my-car-tracking-DZPH5A8V.js",
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Network error"))).toBe(false);
  });
});

describe("shouldAttemptChunkReload", () => {
  it("allows a reload when nothing was tried before", () => {
    expect(shouldAttemptChunkReload(1_000_000, 0, 0)).toEqual({
      allowed: true,
      windowStart: 1_000_000,
      attempts: 1,
    });
  });

  it("still reloads after many deploys earlier in the day", () => {
    // The old counter never reset, so after a few reloads one error hitting
    // several handlers at once could make it give up.
    const result = shouldAttemptChunkReload(10_000_000, 1_000_000, 9);
    expect(result.allowed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("allows a second try inside the window", () => {
    expect(shouldAttemptChunkReload(1_010_000, 1_000_000, 1).allowed).toBe(true);
  });

  it("stops after two reloads in 30 seconds so a broken build can't loop", () => {
    expect(shouldAttemptChunkReload(1_010_000, 1_000_000, 2).allowed).toBe(false);
  });
});
