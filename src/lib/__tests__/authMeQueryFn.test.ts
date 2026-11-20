import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_ME_TIMEOUT_MS, authMeQueryFn } from "../queryClient";

/**
 * Staff on iPhones sat on "Loading your account…" forever: a /api/auth/me
 * request made as the app resumed never answered and never failed, so the
 * first auth check never settled. It must time out as a TypeError (how the
 * browser reports "no response"), which the reconnect screen retries.
 */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
  );
}

describe("authMeQueryFn", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up on a request that never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const result = authMeQueryFn();
    const assertion = expect(result).rejects.toThrow(new TypeError("No response from the server"));
    await vi.advanceTimersByTimeAsync(AUTH_ME_TIMEOUT_MS);
    await assertion;
  });

  it("passes a React Query cancellation through unchanged", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const result = authMeQueryFn({ signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("still treats only a 401 as signed out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(authMeQueryFn()).resolves.toEqual({ user: undefined });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 502 })));
    await expect(authMeQueryFn()).rejects.toThrow("auth/me failed: 502");
  });
});
