# Golden Luxury Auto: product direction

Recorded from the owner's instructions on October 21, 2026.

## Durable owner direction

- Golden Luxury Auto is more than a rental operation. The business is putting funds toward building advanced, up-to-date software for rental companies.
- The product should help operate the business in one centralized place, building on the current software's existing capabilities.
- AI should help with useful parts of the business, including opportunities involving GoHighLevel and other integrations.
- The long-term goal is a version that other rental companies can buy or access.
- **Do not build that commercial or multi-company version yet.** Keep this goal in mind when discussing future decisions, without treating it as authorization to implement it.
- The present request is to retain this direction and propose AI ideas, not to start implementing the ideas.

This file is persistent repository context, not a claim that a chat system's separate memory feature has been enabled. A matching copy is maintained in the frontend and backend repositories.

## Current product context

The software already brings together fleet and trip records, employee day schedules, maintenance and service history, receipts, income and expenses, owner/client access, and integrations such as Bouncie and Google Sheets. Recommendations should fit these workflows and the current software, rather than the legacy portal.

Existing owner preferences include a mobile-friendly light interface with GLA's gold branding, preservation of original reports and receipts, and accurate figures with missing or uncertain data identified clearly. Routine airport and fuel receipt reading was specifically requested to run without AI credits; AI proposals should respect that existing requirement.

## AI opportunities for discussion — not approved work

| Opportunity | Proposed behavior | Useful measure |
| --- | --- | --- |
| GoHighLevel booking assistant | Answer inquiries, gather trip requirements, follow up on missed calls and quotes, and offer vehicles using verified availability and approved pricing from GLA. Route exceptions to staff. | Response time and inquiry-to-booking conversion |
| Daily operations assistant | Turn late returns, vehicle readiness, missing receipts, and staffing conflicts into a prioritized action list. Let staff ask which vehicles need attention before their next trip. | Staff time saved and on-time handoffs |
| Vehicle profitability assistant | Explain profit per vehicle using calculated revenue, maintenance, fees, owner payments, and downtime; suggest pricing or fleet decisions with supporting records. | Contribution margin and avoidable downtime |
| Inspection and claims assistant | Compare dated before/after vehicle photos, flag possible new damage, and draft a package of photos, trip details, and receipts for human review. | Review time and evidence completeness |
| Maintenance intelligence | Combine verified Bouncie mileage, service history, and recurring reports to suggest attention or maintenance. Distinguish predictions from confirmed appointments and preserve as-needed service rules. | Repeat failures and unplanned downtime |
| Owner/client reporting assistant | Draft weekly or monthly updates explaining completed work, upcoming needs, and financial results, linked to source records and accessible receipts. | Report preparation time and clarification requests |
| Employee knowledge and voice assistant | Answer questions from approved procedures and turn spoken observations into draft reports with the selected vehicle and trip attached. | Report completion time and training effort |
| Data quality assistant | Use rules to find duplicates and missing or contradictory facts; use AI to help interpret free-text descriptions and propose corrections while preserving history. | Unresolved discrepancies and correction time |

## Recommended approach — not a new implementation mandate

1. Start with a booking assistant, a daily operations assistant, and vehicle profitability explanations. Agree on a measurable outcome for each before building.
2. Keep GLA's verified operational records as the source of truth. GoHighLevel can handle customer communication and follow-up, with relevant activity returned to the software.
3. Use ordinary code for exact totals, permissions, availability checks, and duplicate-submission protection. Use AI for language, interpretation, drafting, and recommendations.
4. Give recommendations source links and preserve uncertainty. Do not fill gaps with invented mileage, availability, financial figures, or service dates.
5. Choose an appropriate level of human review for consequential actions such as charges, refunds, claims, and fleet changes; measure AI cost against actual business value.
6. Revisit the commercial product only when the owner requests it. At that point, discuss company data isolation, configurable workflows, billing, onboarding, and support without assuming today's GLA-specific settings fit every operator.
