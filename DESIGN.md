---
name: EV-COST
description: Earned value workbook in a calm developer-tool style, light and dark.
colors:
  ink: '#111111'
  ink-secondary: '#4a4a4f'
  ink-muted: '#6e6e73'
  canvas: '#f6f6f5'
  surface: '#ffffff'
  sunken: '#fafaf9'
  subtle: '#f1f1f0'
  subtle-2: '#e9e9e7'
  hairline: '#e6e6e3'
  hairline-strong: '#d4d4d0'
  primary: '#111111'
  primary-hover: '#2a2a2a'
  primary-fg: '#ffffff'
  accent: '#2f6feb'
  accent-ink: '#1f5bd1'
  accent-soft: '#eaf1fe'
  answer-bg: '#f1f1f0'
  good: '#1a7f37'
  good-bg: '#e8f5ec'
  watch: '#8a5a00'
  watch-bg: '#fbf3df'
  risk: '#b2470d'
  risk-bg: '#fdeee4'
  bad: '#cf222e'
  bad-bg: '#fdecec'
  series-pv: '#2f6feb'
  series-ev: '#17a17a'
  series-ac: '#e5683a'
  series-bac: '#dcdcd8'
  series-favourable: '#3a7fd0'
  series-unfavourable: '#d03b3b'
  dark-ink: '#ededee'
  dark-ink-secondary: '#b4b4b9'
  dark-ink-muted: '#8d8d93'
  dark-canvas: '#0c0c0d'
  dark-surface: '#161618'
  dark-subtle: '#1f1f22'
  dark-hairline: '#26262a'
  dark-primary: '#f2f2f3'
  dark-primary-fg: '#111111'
  dark-accent: '#5b93ff'
  dark-good: '#48c26a'
  dark-bad: '#ff6b6b'
  dark-series-pv: '#3f80f5'
  dark-series-ev: '#1f9e78'
  dark-series-ac: '#d9683c'
typography:
  hero:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '2.5rem'
    fontWeight: 600
    lineHeight: '2.75rem'
    letterSpacing: '-0.022em'
  headline:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '1.625rem'
    fontWeight: 600
    lineHeight: '2rem'
    letterSpacing: '-0.022em'
  title:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: '1.75rem'
    letterSpacing: '-0.022em'
  figure:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 600
    lineHeight: '2.125rem'
  body:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.3125rem'
  small:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: '1.125rem'
  caption:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: '1rem'
  touch-field:
    fontFamily: 'Geist Variable, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: '1.5rem'
  mono:
    fontFamily: 'Geist Mono Variable, ui-monospace, monospace'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.3125rem'
    fontFeature: 'tnum'
rounded:
  sm: '4px'
  default: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  panel: '20px'
  section: '24px'
  gutter: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-fg}'
    rounded: '{rounded.full}'
    height: '36px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.full}'
    height: '36px'
    padding: '0 16px'
  button-secondary-hover:
    backgroundColor: '{colors.subtle}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.default}'
    height: '36px'
    padding: '0 12px'
  nav-item-active:
    backgroundColor: '{colors.subtle-2}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    height: '32px'
  sidebar:
    backgroundColor: '{colors.sunken}'
    width: '248px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.xl}'
    padding: '{spacing.panel}'
  answer-chip:
    backgroundColor: '{colors.answer-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    typography: '{typography.figure}'
  command-menu:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.xl}'
    width: '576px'
  command-option-active:
    backgroundColor: '{colors.subtle-2}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    height: '36px'
  slider-thumb:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.full}'
    size: '16px'
  preset-chip:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.full}'
    height: '28px'
    padding: '0 10px'
---

# Design System: EV-COST

## Overview

**Creative North Star: "The Quiet Dev Tool"**

EV-COST takes its look from the Devin product site and app, a reference the user pinned on 2026-11-10. It has a soft off-white canvas, white cards defined by hairlines rather than heavy shadows, a calm grotesk with tight headlines, solid ink pill buttons, and git-diff style figures. The reference's one indulgence, soft blurred imagery behind floating panels, appears exactly once: the forecast card in the Overview hero.

The content idea from the earlier build survives unchanged: every derived number shows its working. Formulas now read like code lines in Geist Mono (`CPI = EV ÷ AC`, then `= 31,000 ÷ 33,200`), and each result sits in a soft chip like a value in a dev tool. Light is the default; dark is a full, separately tuned theme, not an inversion.

**Key Characteristics:**

- Off-white canvas, white cards with 14px corners and 1px hairlines, very soft depth.
- Solid ink pill for the one primary action; outline pills for the rest.
- Geist for the UI, Geist Mono for formulas, diffs and keyboard hints.
- Signed figures look like code diffs: `+$1,250` in green, `−$500` in red.
- Status is always icon + word + colour, in rounded tags.
- Light, dark and follow-the-system themes, switched from the sidebar.
- One design from a 360px phone to a 1440px desktop: at 1440 the web app looks exactly like the desktop app.

## Colors

Neutral ink and surfaces carry the screen. One blue accent handles focus and markers; green and red are kept for meaning.

### Primary

- **Ink Pill** (#111111 light / #f2f2f3 dark): primary buttons and the brand mark. Text on it is #ffffff in light and #111111 in dark.
- **Accent Blue** (#2f6feb / dark #5b93ff): focus rings, the caret, the active-project dot and the loading bar. It is never used as a fill for large areas.

### Neutral

- **Canvas** (#f6f6f5 / #0c0c0d): the app background.
- **Surface** (#ffffff / #161618): cards, dialogs, the drawer.
- **Sunken** (#fafaf9 / #121214): the sidebar and the report header.
- **Subtle and Subtle-2** (#f1f1f0, #e9e9e7 / #1f1f22, #2a2a2e): hover fills, the active nav item, segmented-control tracks and sub-head bands.
- **Hairline and Hairline Strong** (#e6e6e3, #d4d4d0 / #26262a, #35353a): borders, rules, input strokes.
- **Ink, Secondary, Muted** (#111111, #4a4a4f, #6e6e73 / #ededee, #b4b4b9, #8d8d93): text tiers.

### Status (always paired with an icon and a word)

- **Good** (#1a7f37 / #48c26a), **Watch** (#8a5a00 / #e0b04a), **Risk** (#b2470d / #f08a4b), **Bad** (#cf222e / #ff6b6b). Each has a tinted background for its tag.

### Chart series (validated with the dataviz checker, in each theme against its own surface)

- **Light:** PV #2f6feb, EV #17a17a, AC #e5683a, BAC track #dcdcd8; variance #3a7fd0 (favourable) and #d03b3b (unfavourable).
- **Dark:** PV #3f80f5, EV #1f9e78, AC #d9683c, BAC track #303035; variance #4a8ae8 and #e25553.

**The One Ink Pill Rule.** Each view has at most one solid pill: its primary action. Everything else is an outline pill, a ghost button or a link.

**The Diff Rule.** Signed money is set in Geist Mono with an explicit + or −, green or red, like a code diff. Unsigned totals stay in the sans.

## Typography

**UI Font:** Geist Variable (fallback: system-ui)
**Mono Font:** Geist Mono Variable (fallback: ui-monospace)

**Character:** a single quiet grotesk with tight headlines (−0.022em). The mono is functional, not decorative: formulas, substitutions, diffs and keyboard hints.

### Hierarchy

- **Hero** (600, 2.5rem, −0.022em): the Overview verdict headline only.
- **Headline** (600, 1.625rem): the project title in the workspace header.
- **Title** (600, 1.25rem): card, dialog and drawer titles.
- **Figure** (600, 1.75rem): answers and given values.
- **Body** (400, 0.875rem): default UI text; prose capped at 75ch.
- **Small and Caption** (0.8125rem / 0.75rem): table figures, metadata, labels. Nothing goes below 12px.
- **Mono** (Geist Mono 0.875rem, tabular): formula lines and diffs.
- **Touch field** (400, 1.0625rem): text inside form fields on touch screens (web edition only). iOS Safari zooms into any field under 16px, so fields step up to the h3 size on a coarse pointer.

**The Sentence-Case Rule.** Section labels are small, sentence case and muted ("Projects", "Given"), never uppercase tracked eyebrows.

## Layout

A fixed 248px sidebar on the sunken surface sits beside a scrolling workspace with a 32px gutter (16px on phones; see Responsive below). The header holds the project title (with its metadata) on the left and the actions (Import, Export CSV, + Work package) on the right.

- **Overview:** the hero card (verdict, actions, floating forecast card; the card shows from 1180px); then the worked sheet beside a 340px "What to do next" column from 1360px; then charts two-up from 1280px.
- **Work packages:** a filter row (search, category select, health segmented control), the sortable table with a totals row, then the category roll-up.
- **Next actions:** the ranked list beside a 440px column with the forecast range and the rules.
- **Report:** a 260px controls card beside the report preview.
- Below 1360px, side columns stack under the main content.

### Responsive (web edition)

The desktop app assumes a window of at least 1100px. The web edition is usable from 360px up, with the same tokens and nothing new: no extra colours, sizes only from the type and radius scales.

| Width         | Layout                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1024px and up | The persistent 248px sidebar, exactly as on the desktop.                                                                                                                                                                                                                                                                                         |
| Below 1024px  | The sidebar becomes an off-canvas drawer (scrim, focus trap, Esc and scrim tap close it, it closes on navigation). A 56px **app bar** on the canvas colour holds the menu button, the Sigma mark, the page title and the page's primary action (+ Work package). The header's own primary button hides, so there is still one ink pill per view. |
| Below 640px   | 16px page gutters. Header actions wrap under the title. The project description takes its own line.                                                                                                                                                                                                                                              |
| Below 1180px  | The hero's forecast card stacks under the verdict instead of floating beside it; the figures always show.                                                                                                                                                                                                                                        |

- **Wide tables** (work packages, categories, report preview) scroll sideways inside their card, never the page. The first column is pinned with a 1px rule on its edge; the totals row stays pinned to the bottom of the table card.
- **Worked sheet:** four cells across from 768px, two across below.
- **Charts:** bar-row charts (forecast, variance) put each package name on its own line above its bars below 640px, so the plot keeps its width and the axis labels stay legible.
- **Modals** become full-height sheets below 640px with the footer pinned to the bottom (respecting the safe-area inset). Small confirm dialogs rise from the bottom instead. The package drawer becomes full width.
- **Touch:** on a coarse pointer every control has a 44px hit area (`src/platform/web.css`).
- **Motion:** `prefers-reduced-motion` turns transitions and animations off, including the drawer slide.
- **No horizontal page scroll** at 360px on any page; the end-to-end test checks this.

### Keyboard (web edition)

`1` to `4` switch pages (only when focus is not in a field and no modifier is held; the desktop's Alt+1 to Alt+4 are browser shortcuts on Linux and Windows), `N` adds a work package, `/` jumps to search, Ctrl/Cmd+K opens the command menu, `Esc` closes the top overlay. Key hints show the bare key.

## Elevation & Depth

Hairlines first, shadow second. Cards rest on a barely-there shadow; only floating layers get real depth. In dark mode, depth comes from stepping surfaces up (canvas, then surface, then subtle) with deeper, darker shadows.

### Shadow Vocabulary

- **Card** (`0 1px 2px rgb(17 17 17 / 0.04), 0 0 0 1px rgb(17 17 17 / 0.02)`; dark: `0 1px 2px rgb(0 0 0 / 0.4)`): resting cards, the raised segment in segmented controls.
- **Float** (`0 12px 32px -8px rgb(17 17 17 / 0.16), 0 2px 6px rgb(17 17 17 / 0.06)`; dark: `0 16px 40px -8px rgb(0 0 0 / 0.6), …`): dialogs, the drawer, toasts, tooltips, the hero's forecast card.

**The One Backdrop Rule.** The soft blurred backdrop appears once, behind the hero's forecast card. It is never used as a page background or behind data.

## Shapes

- 14px corners on cards, dialogs and the drawer.
- 8px on nav items and answer chips; 6px on inputs; 4px on small marks.
- Fully round pills for every button, segmented control, tag and count badge.
- Chart bars have a 4px rounded data end and stay square at the baseline.

## Components

### Buttons

- **Primary:** an ink pill (#111 or #f2f2f3), 36px tall, 16px padding, Geist 500; hover lightens or darkens one step.
- **Secondary:** a surface pill with a strong hairline and a card shadow; hover fills with subtle.
- **Ghost / Danger ghost:** text only; hover gets a subtle (or bad-bg) fill. Disabled is 45% opacity; loading shows a spinner.

### Segmented controls

A subtle-2 pill track; the active segment is a raised surface pill with the card shadow. Used for health filters, severity filters and the theme switch.

### Inputs

Surface fill, strong hairline, 6px corners, 36px tall. On focus the border turns accent blue with a soft accent ring. Errors show a red border plus a message below.

### Navigation

32px items in the body size with muted icons; hover fills subtle; the active item is subtle-2 with ink text. A "Search or jump to" row styled as a quiet input opens the command menu and shows its shortcut (hidden on touch screens). A "New work package" row with an `N` key hint sits under it, like the reference's "New session". A blue dot marks the active project. Below 1024px the app bar carries a search icon button that opens the same menu.

### Command menu

A surface card (14px corners, float shadow) dropped from the top third over the scrim, 576px wide. A 48px search row with a hairline under it, then results in sentence-case groups. Options are 36px rows with a muted icon; the selected one is subtle-2 with ink text, exactly like an active nav item. Key hints sit on the right in Mono. The footer strip (canvas fill) names the keys and counts the results. It opens with Ctrl/Cmd+K and is keyboard-first: arrows move, Enter runs, Esc closes.

On phones it sits 12px from the top and sides. On a touch screen the key hints and the footer's key legend hide, options grow to 44px, and a close button replaces the Esc hint.

### Sliders and presets

A 4px track filled in ink up to a 16px surface thumb with an ink ring; the value reads out in Mono on the label row. Under each slider sit 28px outline preset chips; the chip matching the current value takes the ink border and a subtle-2 fill. Used only in the what-if forecast. On a touch screen the slider's hit area is 44px tall with a 24px thumb, and the chips get 44px targets like every other control.

### Worked solution (signature content)

Name (Small, secondary), formula (Mono, variables bold), substitution (Mono, muted), answer chip (Figure on the answer background with a hairline ring), verdict (Small, status colour, direction icon). Cells sit in one ruled card under sentence-case sub-head bands.

### Hero forecast card

A surface card at 95% opacity with backdrop blur and the float shadow, over the blurred backdrop. It holds the forecast EAC as a figure, a diff of VAC against BAC, two progress tracks (earned vs a planned marker; spent), and three small stats.

## Do's and Don'ts

### Do:

- **Do** keep one ink pill per view, for the primary action.
- **Do** set signed money in Geist Mono with + or −, coloured like a diff.
- **Do** pair every status colour with its icon and word.
- **Do** test every new surface in both themes; tokens swap through `data-theme` on `<html>`.
- **Do** use the validated series colours for each theme.
- **Do** make every new action reachable from the command menu as well as from its button.

### Don't:

- **Don't** use uppercase tracked eyebrows or kickers above headings.
- **Don't** add the blurred backdrop anywhere except the hero forecast card.
- **Don't** hard-code colours in components; use the tokens, or dark mode breaks.
- **Don't** use text below 12px, or monospace for anything other than formulas, diffs and key hints.
- **Don't** add coloured side stripes, gradient text, or heavy drop shadows on resting cards.
