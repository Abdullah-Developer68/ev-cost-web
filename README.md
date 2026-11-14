# EV-COST Web

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
```

The end-to-end script never downloads a browser. It uses `CHROMIUM_PATH` if set, otherwise the newest Chromium cached by Playwright under `~/.cache/ms-playwright`.

## Build and deploy

```bash
npm run build       # type-checks, then writes dist/
npm run preview     # serve dist/ locally
```

`dist/` is plain static files with relative paths (`base: './'`) and hash routing. Upload it to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, a university web folder), at the root or in a sub-folder. No rewrites or server config are needed.

The page sets its own Content-Security-Policy in `index.html` (`script-src 'self'`). If your host adds a CSP header, keep it at least that permissive for `'self'`, plus `style-src 'unsafe-inline'`, `img-src data: blob:` and `font-src data:`.

## Project layout

- `src/`: the interface, shared file for file with the desktop's `src/renderer/src/`.
- `src/platform/`: everything browser-specific (data layer, routing, shortcuts, responsive layout). See `agent.md`, section 6.
- `PRODUCT.md`: who it is for. `DESIGN.md`: the design system, including the responsive rules. `agent.md`: architecture and EVM rules.
