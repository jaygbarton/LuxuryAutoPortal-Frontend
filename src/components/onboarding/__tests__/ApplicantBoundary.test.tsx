import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { ApplicantBoundary } from "../ApplicantBoundary";

/**
 * ApplicantBoundary wraps the entire in-app shell. A failed background
 * re-check of /api/auth/me (ERR_NETWORK_CHANGED, a timeout while the user's
 * connection flaps) used to replace every page with "Account access could not
 * be checked" even though the user was already loaded and cached.
 */
function render(state: { data?: unknown; error?: Error | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, retryOnMount: false } } });
  client.getQueryCache().build(client, { queryKey: ["/api/auth/me"] }).setState({
    data: state.data,
    error: state.error ?? null,
    status: state.error ? "error" : "success",
    dataUpdatedAt: state.data ? Date.now() : 0,
    errorUpdatedAt: state.error ? Date.now() : 0,
    fetchStatus: "idle",
  });
  // retryOnMount:false stands in for "the check errored while the page was
  // already mounted" -- a server render cannot run the mount-time refetch.
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Router ssrPath="/staff/time">
        <ApplicantBoundary><span>page-content</span></ApplicantBoundary>
      </Router>
    </QueryClientProvider>,
  );
}

describe("ApplicantBoundary", () => {
  const staff = { user: { id: 1, isEmployee: true } };

  it("keeps rendering the page when a background re-check fails but the user is cached", () => {
    const html = render({ data: staff, error: new TypeError("Failed to fetch") });
    expect(html).toContain("page-content");
    expect(html).not.toContain("Reconnecting to the server");
  });

  it("shows the auto-retrying reconnect screen only when the very first check failed", () => {
    const html = render({ error: new TypeError("Failed to fetch") });
    expect(html).toContain("Reconnecting to the server");
    expect(html).not.toContain("page-content");
  });

  it("still keeps applicants out of the shell", () => {
    const html = render({ data: { user: { id: 2, isApplicant: true } } });
    expect(html).not.toContain("page-content");
  });
});
