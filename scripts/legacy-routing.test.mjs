import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyRouting } from './legacy-routing.mjs';
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('restored PHP and uploaded files precede the app HTML fallback', () => {
  const result = legacyRouting(config, 'https://legacy-origin.example');
  const fallback = result.rewrites.findIndex(rule => rule.destination === '/legacy-index.html');
  for (const prefix of ['/portal/rest/:path*', '/portal/img/:path*', '/carrental/:path*', '/rest/gla/:path*', '/img/:path*']) {
    const index = result.rewrites.findIndex(rule => rule.source === prefix);
    assert(index >= 0 && index < fallback);
    assert.deepEqual(result.rewrites[index].has, [{type:'host',value:'app.goldenluxuryauto.com'}]);
    assert(result.rewrites[index].destination.startsWith('https://legacy-origin.example/'));
    assert.equal(result.rewrites.filter(rule => rule.source === prefix).length, 1);
  }
  assert.deepEqual(result.redirects, config.redirects);
  assert.deepEqual(result.rewrites.filter(rule => !rule.has), config.rewrites.filter(rule => !rule.has));
  assert.deepEqual(config, JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')));
});

test('cutover rejects forwarding loops and credentials in an origin', () => {
  for (const origin of ['https://app.goldenluxuryauto.com', 'https://goldenluxuryauto.com', 'https://www.goldenluxuryauto.com', 'http://legacy-origin.example', 'https://user:password@legacy-origin.example', 'https://legacy-origin.example/portal', 'https://legacy-origin.example?token=x']) {
    assert.throws(() => legacyRouting(config, origin));
  }
});
