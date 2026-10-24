// This clean document is the only page address exposed to GHL attribution.
// Never read/send parent.location, document.referrer, customer data or auth state.
(() => {
  if (window.parent === window) return;
  const origin = window.location.origin;
  let started = false;
  const notify = (message) => window.parent.postMessage(message, origin);
  window.addEventListener('LC_chatWidgetLoaded', (event) => {
    const host = document.querySelector('chat-widget');
    const observedRoot = event.detail instanceof Element ? event.detail : host;
    if (!host || !observedRoot) return;
    // GHL's native numeric height setting appends its own px unit. Reserve room
    // for the launcher/footer so the native header fits shorter phone viewports.
    const fit = () => {
      if (window.innerHeight <= 100) return; // Collapsed frame, not an open panel.
      const height = String(Math.max(200, Math.min(660, window.innerHeight - 140)));
      if (host.height !== height) host.height = height;
    };
    window.addEventListener('resize', fit);
    fit();
    const report = () => notify({ type: 'gla:help:state', active: window.leadConnector?.chatWidget?.isActive() === true });
    new MutationObserver(report).observe(observedRoot, { attributes: true });
    report();
  });
  window.addEventListener('message', (event) => {
    if (started || event.source !== window.parent || event.origin !== origin || event.data?.type !== 'gla:help:config') return;
    const config = event.data.config;
    if (config?.scriptUrl !== 'https://widgets.leadconnectorhq.com/loader.js'
      || config.attributes?.['data-resources-url'] !== 'https://widgets.leadconnectorhq.com/chat-widget/loader.js'
      || !/^[a-f0-9]{24}$/i.test(config.attributes?.['data-widget-id'] || '')
      || Object.keys(config.attributes).some(key => !['data-resources-url','data-widget-id'].includes(key))) return;
    started = true;
    const script = document.createElement('script');
    script.id = 'gla-ghl-native-chat-script';
    script.src = config.scriptUrl;
    script.async = true;
    Object.entries(config.attributes).forEach(([name,value]) => script.setAttribute(name,value));
    script.addEventListener('error', () => notify({ type: 'gla:help:error' }), { once: true });
    document.body.appendChild(script);
  });
  notify({ type: 'gla:help:ready' });
})();
