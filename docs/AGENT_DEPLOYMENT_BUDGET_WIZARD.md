# Agent instruction — deployment budget wizard

Build this in the PR app. Do not deploy. Do not run `firebase deploy`.

Food provisioning already exists (`src/components/provisioning/ProvisioningWizard.tsx`, org catalogs in `provisioningSeedData.ts` and `provisioningSeedDataBenin.ts`). This wizard is the cash budget around a deployment. Food can be one step. Do not replace the ration calculator.

## What the teams actually file

Indexed mail barely says “deployment budget”. The sheets are in WhatsApp and in Dropbox, and many Dropbox copies are still 0-byte placeholders. Read the files below. They are real.

### Lesotho — monthly thrust budget, plus a per-diem form

WhatsApp workbook (opened):

`Email Overlord/whatsapp-data/media/1782208695_1PWR_LS___Thrust_Leads__PM_and_focal_points.xlsx`

Sheets: Monthly Summary, Detailed Budget, FUEL, FOOD, Tutorial.

- Header: thrust area, month, submission date, submitted by, justification.
- Detail columns: date, item and quantity, vendor, budget category, vehicle, project category, invoice, currency.
- Categories in the Tutorial sheet, reuse these codes: 3 Materials, 4 Vehicle, 5 Office supplies, 6 Training, 7 Communications, 8 Postage, 9 Travel (per diem and accommodation), 10 Insurance, 11 Fuel, 13 Licences, 14 Rent, 15 Salaries and wages (casuals), 16 General, 17 Equipment.
- Project category examples: 4 Minigrids, payer SMP or OnePower.
- FUEL sheet is the travel fuel estimator: km, M/L, km/L, safety factor. Lesotho’s approved factor on that sheet is 2. Control number T002V03.
- A filled 4-week site budget is `1PWR PM TEAM/DPO 2024/Finances/Team Budgets/September 2026/MAK Budget_4 weeks_11 09 2026.xlsx`: people, days, meals, food from the food calculator, HQ–site fuel, daily running fuel. Its fuel safety factor on that copy is 1. Keep the factor an org setting. Do not hard-code 1.

Per-diem form, separate from the thrust sheet, also from WhatsApp:

`Email Overlord/whatsapp-data/media/1779970624_1PWR_LS___Team_OnePower.xlsx`

F027V002 (December 2025). Deployment tab is filled by the thrust lead before the trip. Reconciliation tab after. One row per person: name, departure date and time, return date and time, days. Finance uses Payments due. The wizard’s per-diem step is this form. Reconciliation can be a later step. Do not drop it.

Mail that names the same practice (knowledge base has no attachment bytes): “Reticulation Deployment Budget” (2022-01-12), “Facilities redeployment budget for DEC 2023 (SEH KPI)”, “Facilities Ketane Redeployment Budget May 2024”. Older trip files under `1PWR PM TEAM/Budgets/` are mostly unhydrated 0-byte Dropbox placeholders. Do not treat a 0-byte file as an empty budget.

### Benin — one planning-and-budget sheet, plus chat totals

WhatsApp workbooks (opened), all the same shape:

- `1776021756_1PWR_BN___admin.xlsx`
- `1777297134_1PWR_BN___admin.xlsx`
- `1783894554_1PWR_BN___admin.xlsx`
- `1788959213_1PWR_BN___admin.xlsx`
- `1776153405_1PWR_BN___admin.xlsx`

Top block: PLANNING & BUDGET. Columns N°, day, date, departure, hour, locality. Then TAF (the work). Then Budget mission: designation, number, unit price, amount, and the people on the mission. Last line is TOTAL. Currency is XOF.

Line names that recur: carburant (gasoil / essence, litres × price), restauration, hébergement, perdiem, transport / taxi, communication, impression, imprévus. Manoeuvres show up as a day rate in the chat budgets, not always in the sheet.

The same budgets are also typed in `1PWR_BN___admin` with no file: transport, perdiem, essence, hébergement, restauration, manoeuvres, imprévus. Example, Hospice, 11 May 2026: crane-truck driver, restauration 6,500 × 3, hébergement 7,500 × 3, gasoil 450 km at 35 L/100 km. Use the chat as the same line set, not a second product.

Training budgets (Budget Formation TPE) are a different sheet: designation, nombre, PU, montant for a classroom day. Out of scope for this wizard.

## One wizard, two organisations

Same steps. Labels and currency come from the organisation.

1. Header. Organisation, site or sites, dates, purpose (the TAF), thrust or team, preparer.
2. Party. Named people, departure and return, days. This is F027. Benin uses the same list as “participants”.
3. Food. Hand off to the existing provisioning wizard for that org, or enter a lump sum when the team will shop with cash (Lesotho’s old practice). Store which one.
4. Fuel. Kilometres, price per litre, km/L, safety factor. Lesotho default factor 2 and LSL. Benin default factor 1 until an admin sets another, currency XOF. Do not invent a Benin safety factor. If Fleet Hub has already priced this mission’s fuel, accept that figure instead of retyping it.
5. The other cash lines, same five in both countries: per diem, lodging, transport that is not fleet fuel (taxi, zém, boat), materials and other, contingency (imprévus). Quantity × unit price. Casuals and manoeuvres are a day rate on the per-diem or wages line, not a new category.
6. Total in the org currency, then the same choice as the fuel calculator: raise purchase requests for the lines that need them, or mark the budget as the approved deployment envelope. Creating the PR documents is in scope here, in the PR app. Do not call Fleet Hub to do it.

Show the Lesotho category code on each line (9 travel, 11 fuel, 15 wages, 3 materials, 16 general) so finance can still drop the result into the monthly thrust workbook. Benin does not use those codes. Hide them for Benin.

## Do not

- Treat field-camp food as the whole budget.
- Require a Google Maps key. Distance is typed, or taken from the Fleet Hub fuel figure when that exists.
- Hydrate or rewrite the 0-byte Dropbox budgets.
- Deploy.

## Done when

- A Lesotho user can produce a total that matches the MAK 4-week shape: food, return fuel, running fuel, per diem, and a total in LSL, with category codes.
- A Benin user can produce a total that matches the PLANNING & BUDGET sheet: day plan, participants, carburant, restauration, hébergement, transport, imprévus, total in XOF.
- The same screen does both. Only currency, language of the line labels, category codes, and the fuel safety-factor default change with the organisation.
- F027’s per-person dates are on the party step.
- Session log entry at `SESSION_LOG.md` (newest first).
