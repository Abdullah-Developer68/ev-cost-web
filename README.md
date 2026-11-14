# EV-COST Web

**Live:** https://ev-cost-web.vercel.app

EV-COST is an Earned Value Management (EVM) workbook for software projects. This is its browser edition. It tracks budget, planned and actual progress, and actual cost per work package, and works out all 12 EVM metrics (BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, VAC, TCPI) with the formula and inputs shown for each. It turns the results into ranked, rule-based next actions, lets you test a recovery plan with a what-if forecast, and exports a CSV or a PDF report. A command menu (Ctrl/Cmd+K, or the search button on phones) reaches every page, action and work package.

It is the same app as the Electron desktop edition in `../EV-COST`, with the same interface and design system. It runs as a static single-page app with no server and no secrets, and it works on phones, tablets and desktops (360px and up).

## Where your data lives

Everything is saved in **this browser's `localStorage` on this device**, under the key `ev-cost:data:v1`. Nothing is sent anywhere.

- On first run the app seeds a demo project with five work packages.
- Clearing site data, or using another browser or device, starts from the demo again. To move or keep your data, open **Saved in this browser** at the bottom of the sidebar and use **Download backup**, then **Restore from backup** elsewhere. **Reset demo data** starts over.
- If the browser's storage is full or blocked (some private modes), a change is refused with an error and nothing is half-saved.
- If the saved data cannot be read, the app keeps it under `ev-cost:data:unreadable:<time>`, starts from the demo and tells you.
- Two tabs stay in sync.

## Run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Keyboard

| Key                | Action                                                          |
| ------------------ | --------------------------------------------------------------- |
| `1` `2` `3` `4`    | Overview, Work packages, Next actions, Report                   |
| `N`                | New work package                                                |
| `/`                | Search work packages                                            |
| `Ctrl+K` / `Cmd+K` | Command menu: search pages, actions, projects and work packages |
| `Esc`              | Close the top dialog, drawer or menu                            |

Pages have their own URLs (`#/overview`, `#/packages`, `#/actions`, `#/report`), so refresh, links and the back and forward buttons work.

## Test

```bash
npm run typecheck
npm run lint
npm run format:check
npm test            # vitest unit tests
npm run test:e2e    # build, serve, drive Chromium, screenshots in test-results/
npm run test:security                                   # security tests on the local build
TARGET_URL=https://ev-cost-web.vercel.app node tests/e2e/security.mjs   # ...or on the live site
```

`test:security` serves `dist/` with the same headers as `vercel.json` and checks, with inert test data only: malicious uploads (renamed executables, zip bomb, macro workbook, zip-slip, formula injection), stored XSS and CSP, forged or tampered storage, cross-origin reads and clickjacking, a request burst and an oversized import, and the security headers.

The end-to-end script never downloads a browser. It uses `CHROMIUM_PATH` if set, otherwise the newest Chromium cached by Playwright under `~/.cache/ms-playwright`.

## Cost analysis features

- **Calculations:** BAC (estimated cost), AC (actual cost), the variances CV, SV and VAC, and the **percentage variances** CV% = CV ÷ EV, SV% = SV ÷ PV and VAC% = VAC ÷ BAC, per package and for the project.
- **Charts:** budget/plan/earned/spent bars, a CPI × SPI performance map, a forecast-against-budget bullet chart, variance bars, the EAC range and the unusual-spend bars.
- **AI feature, unusual spend detection** (`src/lib/anomalies.ts`): an unsupervised outlier detector. It scores each package's cost per unit of earned value (AC ÷ EV) against the rest of the project with the robust modified z-score (median and MAD, Iglewicz and Hoaglin). It flags unusually high or low spend, and spend with no progress, and writes a plain-language summary. It runs entirely in the browser.
- **Report:** PDF (worked solution, percentage variances, breakdown, actions, unusual spend, forecast range) and CSV export.

## Security

- Uploads are checked by content before parsing (`src/lib/uploadGuard.ts`): extension allow-list, 10 MB cap, magic bytes, binary detection, ZIP central-directory checks against zip bombs, ZIP64, macros and zip-slip paths, plus a 5,000-row cap.
- Text is stripped of spreadsheet formula prefixes on import and neutralised on CSV export.
- Stored data is validated and normalised on every read (ids, project links, numeric ranges).
- `vercel.json` sends CSP (with `frame-ancestors 'none'`), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP and HSTS.
- `uuid` is pinned to 11.1.1 via `overrides` (GHSA-w5hq-g745-h8pq through exceljs); `npm audit` reports 0 vulnerabilities.

## Build and deploy

```bash
npm run build       # type-checks, then writes dist/
npm run preview     # serve dist/ locally
```

Deployed to Vercel with the CLI (`vercel deploy --prod`); `vercel.json` sets the build and the security headers.

`dist/` is plain static files with relative paths (`base: './'`) and hash routing. Upload it to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, a university web folder), at the root or in a sub-folder. No rewrites or server config are needed.

The page sets its own Content-Security-Policy in `index.html` (`script-src 'self'`). If your host adds a CSP header, keep it at least that permissive for `'self'`, plus `style-src 'unsafe-inline'`, `img-src data: blob:` and `font-src data:`.

## Project layout

- `src/`: the interface, shared file for file with the desktop's `src/renderer/src/`.
- `src/platform/`: everything browser-specific (data layer, routing, shortcuts, responsive layout). See `agent.md`, section 6.
- `PRODUCT.md`: who it is for. `DESIGN.md`: the design system, including the responsive rules. `agent.md`: architecture and EVM rules.
