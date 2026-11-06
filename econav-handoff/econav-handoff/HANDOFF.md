# EcoNav — design handoff for Claude Code

This folder is the source of the EcoNav design canvas. Each screen is one
self-contained HTML file in `design/` (`*.dc.html`). Open any of them in a
browser to read the markup; the inline styles are the exact spec (colors,
sizes, radii, spacing). The `<script type="text/x-dc">` block at the bottom
of each file holds the sample data and any interaction logic.

Suggested prompt for Claude Code:

> Build the EcoNav mobile app from the designs in `design/`. Read HANDOFF.md
> first. Match the colors, type, spacing and radii exactly. Use the sample
> data in each file's script block as seed/mock data. Start with Home,
> Route comparison, Garage and Savings.

## Screens → files

| # | Screen | File | Tab |
|---|--------|------|-----|
| 01 | Welcome | Main.dc.html | — |
| 02–04 | Onboarding (vehicle, compare, track) | Onboarding-*.dc.html | — |
| 05 | Sign up (with validation error) | SignUp.dc.html | — |
| 06 | Log in (with error banner) | Login.dc.html | — |
| 07 | Home dashboard | Home.dc.html (`dark` prop = dark mode) | Home |
| 08 | Destination search | DestinationSearch.dc.html | flow |
| 09 | Route comparison (core) | RouteCompare.dc.html | flow |
| 10 | Trip summary / confirm | TripSummary.dc.html | flow |
| 11 | Garage | Garage.dc.html | Garage |
| 12 | Add / edit vehicle (3 steps) | AddVehicle.dc.html | flow |
| 13 | Route preferences | RoutePrefs.dc.html | Profile |
| 14 | Profile & settings | Profile.dc.html | Profile |
| 15 | Savings dashboard | Savings.dc.html | Savings |
| 16 | Trip history | TripHistory.dc.html | Home |
| 17 | Trip detail | TripDetail.dc.html | — |
| 18 | Home, dark mode | HomeDark.dc.html | Home |
| 19 | Loading / error / empty / success states | States.dc.html | — |
| 20 | Design system sheet | DesignSystem.dc.html | — |
| — | Shared map illustration | Map.dc.html | component |
| — | Bottom tab bar | TabBar.dc.html | component |

`canvas.json` lists every screen with its size and title.

## Navigation

Bottom tabs: Home · Garage · Savings · Profile. Destination search → route
comparison → trip summary is a focused stack flow, not a tab. Prototype links
in the files (`<a href="X.dc.html">`) show every transition:

- Welcome → Onboarding → Sign up → Add vehicle → Home
- Home → Destination search → Compare routes → Open in Maps → Trip summary → Confirm → Savings
- Home → Garage → Edit vehicle
- Home/Savings → Trip history → Trip detail
- Profile → Route preferences → Save → Compare routes

## Design tokens

Colors (light): forest `#14532D` (primary, buttons, recommended), accent
`#22C55E` (fills/charts only), green text `#15803D`, background `#F8FAFC`,
card `#FFFFFF`, text `#0F172A`, secondary `#64748B`, border `#E2E8F0`,
warning `#F59E0B` (amber text `#B45309`), error `#B91C1C` / border `#DC2626`.

Colors (dark): bg `#0A110E`, card `#121C18`, border `#22312B`, text `#F1F5F9`,
secondary `#94A3B8`, green `#4ADE80`, primary fill `#22C55E` with `#052E16` text.

Map route colors: Balanced `#14532D`, Cheapest `#2563EB`, Fastest `#F59E0B`.

Type: Inter. Money XL 46/800 (−0.035em), Display 34/800, Title 28/800,
Heading 18/700, Body 15/500, Supporting 13/400, Overline 12/700 uppercase
+0.06em. Tabular figures for all numbers.

Spacing: 4 · 8 · 12 · 16 · 20 · 24 · 32. Screen side padding 20.
Radii: inputs 12, buttons 14–16, cards 18–22, sheets 26.
Touch targets ≥ 44 px. Primary button 56 px tall.

## Cost model (keep the math transparent)

- Fuel = miles ÷ MPG × fuel price per gallon
- Depreciation = miles × depreciation per mile
- Trip cost = fuel + depreciation + tolls (tolls optional via preference)
- Time value (ranking only, never shown as money spent) = minutes ÷ 60 × $/hr
- Recommendation (Balanced mode) = route with the lowest trip cost + time value
- Savings = baseline (fastest route) cost − chosen route cost; counts only
  when the user confirms the trip. Always labeled "estimated".

Sample trip (2021 RAV4, 30 MPG, $3.29/gal, $0.18/mi, $18/hr):

| Route | Time | Miles | Fuel | Depr. | Tolls | Total | Score |
|-------|------|-------|------|-------|-------|-------|-------|
| Balanced (rec.) | 33 min | 25.9 | $2.84 | $4.66 | $0.00 | $7.50 | $17.40 |
| Cheapest | 41 min | 24.6 | $2.70 | $4.43 | $0.00 | $7.13 | $19.43 |
| Fastest | 29 min | 27.8 | $3.05 | $5.00 | $3.50 | $11.55 | $20.25 |

## Placeholders to replace

- Apple / Google sign-in buttons: dashed squares mark where the official
  brand marks go (use each provider's sign-in button guidelines).
- Vehicle photos are hatched placeholders.
- The map is an illustration; swap in a real map SDK (Mapbox, Google Maps,
  Apple MapKit) with route polylines in the colors above.
- Place names and the user (Maya Chen) are invented sample data.
