/** A local invitation beside the real native launcher, never a second chatbot.
 * No route, account data or teaser state is sent to the provider. */
const SESSION_KEY = 'gla-help-teaser-seen-v1';
const TEASER_ID = 'gla-customer-help-teaser';
const DELAY_MS = 5_000;
type State = {
  eligible: boolean;
  expanded: boolean;
  used: boolean;
  timer?: number;
  element?: HTMLElement;
};
const documents = new WeakMap<Document, State>();

function remember(document: Document, state: State) {
  state.used = true;
  try { document.defaultView?.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* In-memory fallback. */ }
}

function clear(document: Document, state: State) {
  if (state.timer !== undefined) document.defaultView?.clearTimeout(state.timer);
  state.timer = undefined;
  state.element?.remove();
  state.element = undefined;
}

function reconcile(document: Document, state: State) {
  if (state.expanded) remember(document, state);
  if (!state.eligible || state.expanded || document.visibilityState !== 'visible') {
    clear(document, state);
    return;
  }
  // Keep the current invitation until dismissal/navigation, but never repeat it.
  if (state.element || state.timer !== undefined) return;
  try { state.used ||= document.defaultView?.sessionStorage.getItem(SESSION_KEY) === '1'; } catch { /* In-memory fallback. */ }
  if (state.used) return;
  state.timer = document.defaultView?.setTimeout(() => {
    state.timer = undefined;
    if (!state.eligible || state.expanded || document.visibilityState !== 'visible') return;
    remember(document, state);
    const invitation = document.createElement('aside');
    invitation.id = TEASER_ID;
    invitation.setAttribute('aria-label', 'GLA help suggestion');
    invitation.style.cssText = 'position:fixed;right:16px;bottom:104px;box-sizing:border-box;width:min(310px,calc(100vw - 32px));padding:16px 52px 16px 16px;border:1px solid #d3bc8d;border-radius:16px;background:#fffdf8;color:#24211b;box-shadow:0 6px 24px #0002;font:500 15px/1.5 system-ui,sans-serif;z-index:2147482999;';
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.style.margin = '0';
    message.textContent = 'Have questions? I can answer them.';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Dismiss help message');
    dismiss.textContent = '×';
    dismiss.style.cssText = 'position:absolute;right:4px;top:4px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:#514737;font:24px/1 system-ui,sans-serif;cursor:pointer;';
    dismiss.addEventListener('click', () => clear(document, state), { once: true });
    invitation.append(message, dismiss);
    state.element = invitation;
    document.body.appendChild(invitation);
  }, DELAY_MS);
}

/** SessionStorage survives reloads in this tab, and expires with the tab session.
 * If storage is blocked, still show at most once in the current document. */
export function updateCustomerHelpTeaser(document: Document, eligible: boolean, expanded: boolean): void {
  let state = documents.get(document);
  if (!state) {
    state = { eligible, expanded, used: false };
    documents.set(document, state);
    const current = state;
    document.addEventListener('visibilitychange', () => reconcile(document, current));
  }
  state.eligible = eligible;
  state.expanded = expanded;
  reconcile(document, state);
}
