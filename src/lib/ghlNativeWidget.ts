/** Public native-embed settings only. No API key, access token or account data. */
export interface GhlNativeWidgetConfig {
  scriptUrl: string;
  attributes: Record<`data-${string}`, string>;
}

/** Exact public embed supplied by GLA. This contains no credentials. */
export const GHL_PUBLIC_EMBED = {
  scriptUrl: 'https://widgets.leadconnectorhq.com/loader.js',
  attributes: {
    'data-resources-url': 'https://widgets.leadconnectorhq.com/chat-widget/loader.js',
    'data-widget-id': '6adbf3186c0798678b00aa14',
  },
} as const;

// The native widget runs on a clean, referrer-free frame page. Its attribution
// requests must never receive the surrounding contract/reset/approval URL.
export const GHL_LOCAL_PREVIEW_CONFIG: GhlNativeWidgetConfig = {
  ...GHL_PUBLIC_EMBED,
};

// User-approved go-live, October 24, 2026. Use exactly the Mac-verified public
// configuration. Rollback is an explicit source change to null, never a URL flag.
export const GHL_NATIVE_WIDGET_CONFIG: GhlNativeWidgetConfig | null = GHL_LOCAL_PREVIEW_CONFIG;

export function localChatPreviewAllowed(development: boolean, hostname: string): boolean {
  return development && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

/** Explicit localhost dev opt-in; persists across SPA navigation/reloads in this
 * tab. ?glaChatPreview=0 disables it. Production always ignores this mechanism. */
export function getGhlWidgetConfig(): GhlNativeWidgetConfig | null {
  if (GHL_NATIVE_WIDGET_CONFIG) return GHL_NATIVE_WIDGET_CONFIG;
  if (typeof window === 'undefined' || !localChatPreviewAllowed(import.meta.env.DEV, window.location.hostname)) return null;
  try {
    const requested = new URLSearchParams(window.location.search).get('glaChatPreview');
    if (requested === '1' || requested === '0') window.sessionStorage.setItem('gla-ghl-local-preview', requested);
    return window.sessionStorage.getItem('gla-ghl-local-preview') === '1' ? GHL_LOCAL_PREVIEW_CONFIG : null;
  } catch { return null; }
}

const FRAME_ID = 'gla-ghl-native-chat-frame';
type State = { configKey: string; frame: HTMLIFrameElement; visible: boolean; expanded: boolean; loaded: boolean; failed: boolean };
const documents = new WeakMap<Document, State>();
function render(state: State) {
  state.frame.hidden = !state.visible || !state.loaded || state.failed;
  state.frame.style.width = state.expanded ? 'min(420px, 100vw)' : '100px';
  state.frame.style.height = state.expanded ? 'min(800px, 100dvh)' : '100px';
  if (state.frame.hidden && state.frame.ownerDocument.activeElement === state.frame) state.frame.blur();
}

/** One native frame per document, surviving SPA navigation and StrictMode.
 * Only public embed settings cross the bridge; no parent URL or account data.
 * This same-origin frame prevents automatic page-URL attribution. It is not a
 * security sandbox against a malicious third-party script. */
export function updateGhlNativeWidget(document: Document, config: GhlNativeWidgetConfig | null, visible: boolean): void {
  const existing = documents.get(document);
  if (!visible || !config) { if (existing) { existing.visible = false; render(existing); } return; }
  const valid = config.scriptUrl === GHL_PUBLIC_EMBED.scriptUrl
    && config.attributes['data-resources-url'] === GHL_PUBLIC_EMBED.attributes['data-resources-url']
    && /^[a-f0-9]{24}$/i.test(config.attributes['data-widget-id'] || '')
    && Object.keys(config.attributes).every(key => ['data-resources-url', 'data-widget-id'].includes(key));
  if (!valid) { if (existing) { existing.visible = false; render(existing); } return; }
  const configKey = JSON.stringify([config.scriptUrl, config.attributes]);
  if (existing) {
    existing.visible = existing.configKey === configKey;
    render(existing);
    return;
  }
  if (document.getElementById(FRAME_ID) || [...document.scripts].some(script => script.src === config.scriptUrl)) return;
  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.title = 'Golden Luxury Auto AI help';
  frame.referrerPolicy = 'no-referrer';
  frame.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-downloads');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;border:0;background:transparent;z-index:2147483000;color-scheme:normal;';
  const state: State = { configKey, frame, visible, expanded: false, loaded: false, failed: false };
  documents.set(document, state);
  document.defaultView?.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== document.location.origin) return;
    if (event.data?.type === 'gla:help:ready') {
      frame.contentWindow?.postMessage({ type: 'gla:help:config', config }, document.location.origin);
    } else if (event.data?.type === 'gla:help:state' && typeof event.data.active === 'boolean') {
      state.loaded = true;
      state.expanded = event.data.active;
      render(state);
    } else if (event.data?.type === 'gla:help:error') {
      state.failed = true;
      render(state);
    }
  });
  render(state);
  // A real document (not srcdoc) and no-referrer are both necessary: srcdoc can
  // inherit a sensitive parent URL as document.referrer.
  frame.src = '/gla-help/frame.html';
  document.body.appendChild(frame);
}
