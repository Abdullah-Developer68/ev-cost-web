# EV-COST Web (`ev-cost-web`) — Agent Engineering & Architecture Guidelines

This is the browser edition of the EV-COST desktop app (`../EV-COST`). Paths are relative to this project; the desktop keeps the same files under `src/renderer/src/`.

## 1. Strict Modularity & Zero Prop Drilling Policy

> **CRITICAL RULE:** Code **MUST** be strictly modular, and **prop drilling is strictly forbidden**.

### Zero Prop Drilling (`zustand` Required)

- **Never pass state or callbacks down through intermediate components (no prop drilling).**
- All shared state across components, views, modals, or toolbars **must** live in dedicated **Zustand** stores under `src/store/`:
  - `useAppStore.ts`: the active view (`dashboard` | `costs` | `actions` | `reports`), overlay state (add/edit modal, import, project settings, confirm dialog, inspected work package), the theme preference, and the active currency symbol.
  - `useCostStore.ts`: projects, the active project, work packages, search/category/health filters, data mode (`online` | `local`), and CRUD/import/project actions.
  - `useToastStore.ts`: transient notifications (including undo actions).
  - `src/platform/layout/useNavStore.ts` (web only): whether the mobile navigation drawer is open.
- The stores reach the platform only through `src/platform/api.ts`, and the sidebar shows storage through `src/platform/DataSourceStatus.tsx`. Everything browser-specific lives in `src/platform/` (see section 6). Every other file is shared with the desktop and is ported by diffing, so keep edits to shared files small and additive.
- Derived data (project summary, enriched rows, filtered rows, suggestions) comes from the memoised hooks in `src/hooks/useEvm.ts`, never from props.
- Leaf components (`WorkedSheet`, `NextActionsPanel`, `PackagesTable`, `PackageDrawer`, charts, modals, `Sidebar`, `WorkspaceHeader`, etc.) must subscribe directly to the slice of Zustand state they need using selector hooks (`const items = useCostStore((s) => s.items)`).
- Props are **only** permitted for reusable, pure UI primitives (`Button`, `Badge`) or a single row component receiving its own `item` object from its immediate parent list.

---

## 2. Earned Value Management (EVM) Mathematical Model

All work package items and project-level aggregations **must** implement the 4-part Earned Value Management (EVM) standard:

### 2.1 The Four Foundational Metrics (Inputs)

For each work package / module (and summed across the project):

1. **BAC — Budget at Completion:**
   $$\text{BAC} = \sum (\text{Planned Activity Costs})$$
2. **PV — Planned Value:**
   $$\text{PV} = \text{Planned } \% \text{ Complete} \times \text{BAC}$$
3. **EV — Earned Value:**
   $$\text{EV} = \text{Actual } \% \text{ Complete} \times \text{BAC}$$
4. **AC — Actual Cost:**
   $$\text{AC} = \sum (\text{Actual Incurred Expenses})$$

### 2.2 Variance Formulas (Current Deviations)

1. **CV — Cost Variance:**
   $$\text{CV} = \text{EV} - \text{AC}$$
   - $\text{CV} > 0$: Under budget
   - $\text{CV} = 0$: On budget
   - $\text{CV} < 0$: Over budget (cost overrun)
2. **SV — Schedule Variance:**
   $$\text{SV} = \text{EV} - \text{PV}$$
   - $\text{SV} > 0$: Ahead of schedule
   - $\text{SV} = 0$: On schedule
   - $\text{SV} < 0$: Behind schedule

### 2.3 Performance Indices (Current Efficiency)

1. **CPI — Cost Performance Index:**
   $$\text{CPI} = \frac{\text{EV}}{\text{AC}}$$
   - $\text{CPI} > 1.0$: Cost efficient ($> \$1$ earned per $\$1$ spent)
   - $\text{CPI} = 1.0$: On target
   - $\text{CPI} < 1.0$: Cost inefficient
2. **SPI — Schedule Performance Index:**
   $$\text{SPI} = \frac{\text{EV}}{\text{PV}}$$
   - $\text{SPI} > 1.0$: Ahead of schedule
   - $\text{SPI} = 1.0$: On schedule
   - $\text{SPI} < 1.0$: Behind schedule

### 2.4 Forecasting Formulas (Future Projections)

1. **EAC — Estimate at Completion:**
   $$\text{EAC} = \frac{\text{BAC}}{\text{CPI}}$$
2. **ETC — Estimate to Complete:**
   $$\text{ETC} = \text{EAC} - \text{AC}$$
3. **VAC — Variance at Completion:**
   $$\text{VAC} = \text{BAC} - \text{EAC}$$
   - $\text{VAC} > 0$: Projected under budget (surplus savings)
   - $\text{VAC} = 0$: Exact budget match
   - $\text{VAC} < 0$: Projected over budget (deficit)
4. **TCPI — To-Complete Performance Index:**
   $$\text{TCPI} = \frac{\text{BAC} - \text{EV}}{\text{BAC} - \text{AC}}$$
   - $\text{TCPI} > 1.0$: Harder to achieve (must improve efficiency to stay within $\text{BAC}$)
   - $\text{TCPI} = 1.0$: Maintain baseline efficiency
   - $\text{TCPI} < 1.0$: Easier to achieve (safety buffer)

---

## 3. Design System: "The Quiet Dev Tool"

The visual system is recorded in [`DESIGN.md`](./DESIGN.md) (tokens in its frontmatter, rules in its body), with product context in [`PRODUCT.md`](./PRODUCT.md). Read both before changing any UI. In short:

- It follows the Devin reference: an off-white canvas (`#F6F6F5`), white hairline cards (14px corners), Geist and Geist Mono, solid ink pill primaries, outline pill secondaries.
- Light and dark themes: every colour is a CSS variable in `src/assets/main.css` that swaps on `<html data-theme>`. Never hard-code colours in components.
- Every derived number shows its working: the formula and substitution as mono code lines, then the answer in a chip.
- Signed money looks like a code diff (mono, + or −, green or red). Status is always icon + word.
- Chart series are fixed per theme and validated for colour-blind separation.

### Storage

- Everything lives in this browser's `localStorage` under one versioned key, `ev-cost:data:v1` (`{ version, projects, items, nextProjectId, nextItemId }`). The theme preference is `ev-cost:theme`. `mode` is always `'local'`.
- `src/platform/browserApi.ts` (`createBrowserApi(storage)`) implements the whole `CostApi`. It stands in for the desktop main process, so it runs `src/platform/normalize.ts` (an exact copy of the desktop's `src/main/ipc/normalize.ts`) on every write.
- A change is written first and applied in memory only after the write succeeds: a full or blocked storage rejects the call, changes nothing, and the user gets an error toast.
- What is read back is validated. Unreadable entries are skipped and counted; an unreadable blob is kept under `ev-cost:data:unreadable:<timestamp>` and the app starts again from the demo project, saying so in a one-time `notice`. Ids are never reused, even after deletes, restores or hand edits.
- Another tab's writes arrive through the `storage` event and are merged in (`src/platform/web.ts`); each write also re-reads storage first if another tab changed it, so nothing is overwritten.
- Backup (download JSON), restore (validated, confirmed) and "Reset demo data" (confirmed) sit in the sidebar's "Saved in this browser" row.

## 4. Suggestions Engine

`src/lib/suggestions.ts` turns EVM results into ranked, traceable next actions using fixed thresholds (`SUGGESTION_RULES`, `HEALTH_THRESHOLDS`). It must stay pure and deterministic, with no network or LLM, and every rule change needs a test in `suggestions.test.ts`.

### What-if forecast

`src/lib/whatIf.ts` answers "where would we finish if the remaining work ran at this efficiency, with this budget?" using EAC = AC + (BAC − EV) ÷ CPI(future). It is pure, changes no data, and with the project's real CPI it must equal the standard EAC = BAC ÷ CPI exactly (a test guards this). The panel is `components/actions/WhatIfPanel.tsx`.

### Command menu

`src/lib/commands.ts` (pure search and ranking) plus `components/command/`, opened with Ctrl/Cmd+K, the sidebar's "Search or jump to" row, or the app bar's search button. Every action a user can take from a button should also be a command in `useCommands.ts`. Browser-only commands (backup, restore, reset) come from `platform/commands.ts`. CSV and PDF exports live in `store/exportActions.ts` so the buttons and the menu share one implementation.

## 5. Testing

- `npm test`: vitest unit tests (EVM engine, suggestions, import/export, PDF, normalisation, the browser data layer in `src/platform/browserApi.test.ts`, hash routes and page shortcuts in `src/platform/routes.test.ts`, and the `tailwind-merge` font-size guard in `lib/utils.test.ts`).
- `npm run test:e2e`: builds, serves `dist/` on a free port, drives the locally cached Chromium through `playwright-core` (no browser download; `CHROMIUM_PATH` overrides auto-detection under `~/.cache/ms-playwright`), and shuts the server down. Every browser context starts with empty storage. Screenshots go to `test-results/`.
- In end-to-end checks, read `textContent`, not `innerText` (CSS text-transform changes `innerText`), and pass injected CSV through `JSON.stringify`.
- EVM edge cases are deliberate: TCPI is `Infinity` when the budget is exhausted, CPI is 1 when AC is 0. Do not "fix" them.

## 6. Web Platform (`src/platform/`)

| File                                           | Role                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                     | `Project`, `WorkPackageItem`, `InitResult`, `CostApi`, `CustomApi` (the desktop preload contract without `revealStorage`, plus the web-only `data` backup API).                        |
| `browserApi.ts`, `demoData.ts`, `normalize.ts` | The data layer described in "Storage".                                                                                                                                                 |
| `api.ts`                                       | `api = createBrowserApi(localStorage)`, with a toast for storage failures on add, edit and import.                                                                                     |
| `DataSourceStatus.tsx`, `dataActions.ts`       | "Saved in this browser", with backup, restore and reset. The actions live in `dataActions.ts` so the command menu runs the same code.                                                  |
| `commands.ts`                                  | The browser's command-menu entries (backup, restore, reset) and `pageShortcut`, the same contract as the desktop's `platform/commands.ts`.                                             |
| `routes.ts`, `web.ts`                          | Hash routes `#/overview`, `#/packages`, `#/actions`, `#/report`, kept in sync with `activeTab` both ways; document title; `theme-color`; cross-tab sync. Started once from `main.tsx`. |
| `shortcuts.ts`                                 | Plain `1`–`4` for pages (no modifiers, not in a field) and the key-hint label.                                                                                                         |
| `layout/`                                      | `ResponsiveSidebar` (persistent from 1024px, off-canvas drawer below), `AppBar` (below 1024px), `useMediaQuery`, `useNavStore`.                                                        |
| `web.css`                                      | On coarse pointers: 44px touch targets, finger-sized sliders, and 17px text in fields so iOS does not zoom in. The page itself never scrolls sideways.                                 |
| `csp.ts`                                       | Puts zod in jitless mode so it never probes `eval` under the Content-Security-Policy. Imported first.                                                                                  |

- `index.html` carries the CSP (`script-src 'self'`: no inline scripts, no eval), `color-scheme`, `theme-color` and the Sigma SVG favicon. `public/theme-init.js` applies the saved theme before the first paint.
- `exceljs` and `jspdf`/`jspdf-autotable` are loaded with dynamic `import()` where they are used, so they stay out of the first download.
- Responsive rules are in DESIGN.md ("Responsive (web edition)"). Use Tailwind's `sm` (640), `md` (768) and `lg` (1024) prefixes and tokens only.
