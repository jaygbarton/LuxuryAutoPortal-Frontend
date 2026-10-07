// Build the host-specific routes needed by the recovered PHP-backed portal.
// A confirmed origin is mandatory: /rest/gla on devapp is not an established
// replacement for the later /portal/rest/v1 API and its uploaded files.
export function legacyRouting(config, origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use an HTTPS server origin without credentials, paths, or query parameters.');
  }
  if (['app.goldenluxuryauto.com', 'goldenluxuryauto.com', 'www.goldenluxuryauto.com'].includes(url.hostname)) {
    throw new Error('The legacy origin must be the original PHP server, not a migrated frontend domain.');
  }
  const upstream = url.origin;
  const has = [{ type: 'host', value: 'app.goldenluxuryauto.com' }];
  const isAppRule = rule => rule.has?.some(condition => condition.type === 'host' && condition.value === 'app.goldenluxuryauto.com');
  const replacements = new Set(['/rest/gla/:path*', '/img/:path*', '/portal/rest/:path*', '/portal/img/:path*', '/carrental/:path*', '/portal/:path*', '/stagingportal/:path*']);
  return {
    ...config,
    rewrites: [
      { source: '/portal/rest/:path*', has, destination: `${upstream}/portal/rest/:path*` },
      { source: '/portal/img/:path*', has, destination: `${upstream}/portal/img/:path*` },
      // Keep cached copies of the old bundle talking to the same data source.
      { source: '/rest/gla/:path*', has, destination: `${upstream}/portal/rest/v1/:path*` },
      { source: '/img/:path*', has, destination: `${upstream}/portal/img/:path*` },
      { source: '/carrental/:path*', has, destination: `${upstream}/carrental/:path*` },
      ...config.rewrites.filter(rule => !(isAppRule(rule) && replacements.has(rule.source))),
    ],
  };
}
