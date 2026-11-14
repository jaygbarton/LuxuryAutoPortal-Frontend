# Loading speed fixes (November 14, 2026)

Measured on the live homepage at phone width before the change, and on a
local production build after it.

| What a public visitor downloads | Before | After |
| --- | --- | --- |
| Entry JavaScript bundle | 1,419 KB (398 KB compressed) | 491 KB (149 KB compressed) |
| JavaScript for the homepage, total | about 2.0 MB | about 0.7 MB |
| "List your car" hero image | 1,685 KB PNG | 45 KB WebP |
| Call-to-action image | 1,550 KB JPEG | 108 KB WebP |
| Each fleet card photo | full original, up to 630 KB | 720 px WebP (needs the backend change of the same date) |

## What changed

- **Entry bundle.** `App.tsx` imported the signed-in shell, the dashboard
  router and four pages directly, which pulled the admin dashboard, the charts
  library and the Day Schedule into the file every visitor loads first. They
  are now loaded on demand. Each role also downloads only its own dashboard.
- **PDF library.** `main.tsx` imported the PDF configuration on every page
  (322 KB). Only the contract-signing page uses it, and that page configures
  its own worker.
- **Page changes inside the app.** Pages in the signed-in shell load under
  their own loading boundary, so the sidebar and header stay on screen while a
  page's code loads. Previously the whole screen was replaced by a spinner the
  first time each page was opened.
- **Tutorial data.** Tutorial steps were fetched for anonymous visitors, and
  staff fetched the client copy first and then their own. They are fetched
  only once the signed-in user is known.
- **Caching.** Files under `/assets/` have content-hashed names and are now
  cached as immutable for a year. Top-level images are cached for a day. A
  request for a missing `/assets/` file returns 404 instead of the HTML shell.
- **Images.** Two large hero images were converted to WebP. Public vehicle
  cards request 720 px photos. Pass a size to `getProxiedImageUrl(url, size)`
  for any thumbnail or card; omit it only where the original file is needed.
- **Crash fix.** The staff shell crashed with "Something went wrong" when the
  contractor-policy request returned a response without a `policy` object.

## Removed

`public/bmw-x6-cta-enhanced.png`, a stray screenshot in `public/` and
`golden-luxury-full.html` (3.1 MB together) were not referenced anywhere.

## Left in place

`public/legacy-assets/index-DYzATs8v.js` (5.7 MB) and `index-CJ9dcBGn.js`
(1.1 MB) are not referenced by `legacy-index.html`. `docs/LEGACY-RECOVERY.md`
says the previous legacy bundle is kept for rollback, so they were not
removed. They do not affect page speed; they add 6.8 MB to each deployment.
