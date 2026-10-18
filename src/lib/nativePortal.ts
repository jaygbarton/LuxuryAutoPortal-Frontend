const PORTAL_HOSTS = new Set(["goldenluxuryauto.com", "www.goldenluxuryauto.com"]);
const HISTORY_KEY = "__glaNativeNavigation";

// Authentication and role redirects can add history entries; never bounce between them on Back.
export function isNativeRootPath(path: string): boolean {
  return ["/dashboard", "/staff/dashboard", "/client/dashboard", "/admin/login"].includes(path.replace(/\/$/, ""));
}

/** Accept only first-party HTTPS pages. Native links never carry session/role authority. */
export function nativePortalPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !PORTAL_HOSTS.has(url.hostname) || url.port || url.username || url.password) return null;
    if (url.pathname.startsWith("//") || /%2f|%5c|%00|%0a|%0d/i.test(url.pathname)) return null;
    if (/^\/(?:api|uploads|contracts|signed-contracts|car-photos|income-expense-images|assets)(?:\/|$)/i.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Only traverse entries created by this app session, never an older WebView document. */
export function installNativeHistory(target: Pick<Window, "history">) {
  const history = target.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const session = `${Date.now()}-${Math.random()}`;
  const index = () => {
    const marker = history.state?.[HISTORY_KEY];
    return marker?.session === session && Number.isSafeInteger(marker.index) ? marker.index : 0;
  };
  const stateWithIndex = (state: unknown, position: number) => ({
    ...(state && typeof state === "object" ? state : {}),
    [HISTORY_KEY]: { session, index: position },
  });
  originalReplace.call(history, stateWithIndex(history.state, 0), "");
  const push: History["pushState"] = function (state, unused, url) {
    originalPush.call(history, stateWithIndex(state, index() + 1), unused, url);
  };
  const replace: History["replaceState"] = function (state, unused, url) {
    originalReplace.call(history, stateWithIndex(state, index()), unused, url);
  };
  history.pushState = push;
  history.replaceState = replace;
  return {
    canGoBack: () => index() > 0,
    dispose: () => {
      // Do not undo a later integration's history wrapper.
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    },
  };
}

/** Android back dismisses the top UI layer first, including unsaved-form dialogs. */
export function dismissNativeOverlay(document: Document): boolean {
  const layers = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [role="alertdialog"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
  );
  if (!Array.from(layers).some(layer => layer.getClientRects().length > 0)) return false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  return true;
}

/** Refresh operational reads on resume; do not reload a page or replay a form submission. */
export function shouldRefreshNativeQuery(key: readonly unknown[]): boolean {
  const endpoint = key[0];
  return typeof endpoint === "string" && /^\/api\/(?:auth\/me$|operations\/|internal-calendar\/|turo-trips\/|notifications(?:\/|$)|me\/time-sheet\/|staff\/task-management(?:\/|$))/.test(endpoint);
}
