# AI Hub

Staff can open `/admin/ai-hub` from the sidebar, choose an active vehicle, select calendar months, and read a report prepared with code. Maintenance includes grouped original reports, service needs, mileage warnings, and paginated history/receipt references. Admins can also view recorded financial results using the existing Totals calculation. Source Totals links preserve the selected period.

The screen supports refresh, a copied text summary, and a structured JSON download for a future assistant. No AI provider is connected and preparing these reports uses no AI credits. Missing data and failed sources remain explicit. Current service needs are a present snapshot; dated history and finances follow the selected period.

See the [backend API and interpretation contract](https://github.com/jaygbarton/LuxuryAutoPortal-Replit/blob/main/docs/ai-hub.md) before integrating an assistant. Keep authorization on the server; hiding a frontend tab does not protect financial data.

Validation: `npm run lint`, `npm test`, `npm run build`, and `npx playwright test --config playwright.ai-hub.config.ts`. Browser tests use explicit API fixtures; they do not establish completeness of the private production records.

## Assistant access (November 14, 2026)

The hub is the read interface for AI assistants. An **Assistant access** panel
on `/admin/ai-hub` lists every endpoint an assistant can call, shows admins
whether any assistant key is configured, and copies a ready-made instruction
block to paste into an assistant. The panel is built from the live index at
`GET /api/ai-hub`, so it stays in step with the backend. Keys are created and
revoked on the backend; see the backend contract linked above. The screen
never displays a key.

If the backend does not serve the index yet, the panel says so and the rest of
the screen keeps working.

