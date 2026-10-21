# AI Hub

Staff can open `/admin/ai-hub` from the sidebar, choose an active vehicle, select calendar months, and read a report prepared with code. Maintenance includes grouped original reports, service needs, mileage warnings, and paginated history/receipt references. Admins can also view recorded financial results using the existing Totals calculation. Source Totals links preserve the selected period.

The screen supports refresh, a copied text summary, and a structured JSON download for a future assistant. No AI provider is connected and preparing these reports uses no AI credits. Missing data and failed sources remain explicit. Current service needs are a present snapshot; dated history and finances follow the selected period.

See the [backend API and interpretation contract](https://github.com/jaygbarton/LuxuryAutoPortal-Replit/blob/main/docs/ai-hub.md) before integrating an assistant. Keep authorization on the server; hiding a frontend tab does not protect financial data.

Validation: `npm run lint`, `npm test`, `npm run build`, and `npx playwright test --config playwright.ai-hub.config.ts`. Browser tests use explicit API fixtures; they do not establish completeness of the private production records.
