# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Static single-page web app, the browser edition of the EV-COST desktop app. Same interface and design system; usable from a 360px phone to a desktop browser, with tablets and phones as real targets.)

## Users

Primary: a student team building EV-COST for a Software Quality Engineering (SQE) course lab. The app is demoed to and graded by an instructor, who has to verify on screen that the Earned Value Management (EVM) math is correct and see that the tool helps someone make decisions.

The person in the demo plays a software project manager. They enter or import work packages (budget, planned %, actual %, actual cost), read project health, and decide what to do next.

## Product Purpose

EV-COST tracks the cost and schedule health of a software project using the full 12-metric EVM model: BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, VAC and TCPI. It is used per work package and for the whole project.

Success means:

- every number can be traced to its formula and inputs;
- the project's health is readable at a glance;
- the app tells the user what to do about the results.

## Positioning

Most EVM calculators stop at the numbers. EV-COST shows its work: every metric can be opened to see the formula with the real inputs substituted. It also turns the results into concrete, prioritised next actions per work package. These actions are computed by deterministic rules, so they are reproducible and testable.

## Operating Context

- A web page people open in a lab or classroom, often on a projector or shared screen during a demo, and on their own laptop, tablet or phone.
- No server and no secrets: it is a static build that any static host can serve. Data lives in this browser's `localStorage` on this device. Backups are JSON files the user downloads and restores.
- The desktop edition (`../EV-COST`, Electron) shares the same interface and stores data in Postgres or a local file.
- Work packages come from manual entry or CSV/XLSX import. A sample CSV template is provided.
- Output: an on-screen report preview and a downloadable PDF audit report.
- Reference benchmark used in tests and docs: BAC 10,000, planned 50%, actual 40%, AC 5,000. Expected results: CPI 0.80, SPI 0.80, EAC 12,500, VAC -2,500, TCPI 1.20.

## Capabilities and Constraints

- Projects: create and switch between them. Each has a currency symbol.
- Work packages: add, edit, delete, bulk import, search, filter by category, and sort.
- EVM engine: `src/lib/calculations.ts`. It is pure and unit-tested with vitest, and the formulas are fixed by agent.md section 2.
- Formula inspector: shows the step-by-step derivation for a single work package.
- Keyboard: `1` to `4` switch pages, `N` adds a work package, `/` searches, `Esc` closes.
- Command menu (Ctrl/Cmd+K, or the search button on phones): every page, action, project and work package is reachable from one search box.
- What-if forecast: lets the user try a future efficiency and a budget change and see the resulting final cost, without changing any data.
- Backup and restore: download all data as JSON, restore it (validated and confirmed), or reset to the demo project.
- Reports: on-screen preview with section toggles, plus PDF export (jspdf + autotable).
- Suggestions (new): rule-based recommendations derived from the EVM results, with no LLM. They must work offline and be covered by unit tests.
- Architecture rules (agent.md): shared state lives in Zustand stores with no prop drilling. Props are only for pure UI primitives and row components.
- Security: every write is normalised in the browser data layer (formula-injection stripping, number clamping, id checks), since there is no main process to do it. A strict Content-Security-Policy allows only the app's own scripts.
- Charts: recharts is already a dependency.

## Brand Commitments

- Name: EV-COST.
- Visual reference (binding, set by the user on 2026-11-10): the Devin product site and app UI. This means a soft off-white canvas, white hairline cards, a quiet grotesk, solid ink pill primary buttons with outline pill secondaries, git-diff style signed figures, and soft floating depth. This replaces the earlier "Worked Solution" textbook skin; the worked-formula content stays.
- Both light and dark themes are required. Light is the default; the user can pick light, dark, or follow the system.
- Favourable and unfavourable semantics must stay unambiguous. A metric that is good or bad must read that way without relying on colour alone.

## Evidence on Hand

- A seeded demo project, "Autonomous Code Patching & Telemetry Platform", with five work packages. It is synthetic demo data, not real customer data.
- There are no testimonials, customers or benchmarks, and none should be invented.

## Product Principles

1. Show the math: every derived number is one step away from its formula and inputs.
2. Health first, detail second: the overall verdict reads before the table does.
3. Advice is concrete and traceable: each suggestion names the metric that triggered it, the threshold, and the work package it applies to.
4. Correctness is tested: calculation and suggestion logic stay pure and covered by tests.

## Accessibility & Inclusion

Projector and demo use calls for strong contrast and legible type sizes in both themes. On touch screens every control has a 44px target, and reduced-motion preferences are respected. Status must never depend on colour alone: use signs, labels or icons alongside colour.
