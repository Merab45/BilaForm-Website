# BilaForm Multi-page Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten BilaForm Home and organize the existing public and authenticated pages without losing tools, saved data, or auth behavior.

**Architecture:** Keep the static HTML/CSS/JavaScript and Express API. Reuse existing public pages, move the existing PangaSiku calculator into its service page with a focused script, and make the account template show query-addressable protected views.

**Tech Stack:** HTML, CSS, browser JavaScript, Node `node:test`, existing Express API.

**Spec:** [2026-11-17-bilaform-multipage-platform.md](../specs/2026-11-17-bilaform-multipage-platform.md)

## Global Constraints

- Preserve JWT auth, API contracts, account data keys, PangaSiku/VukaMonth saved plans, contact form behavior, and PWA behavior.
- Keep GitHub Pages compatible static routes and query-view URLs.
- Never expose user-specific data without a valid signed-in account.
- Do not add unsupported fake forms, submissions, notifications, or activity records.
- Use the requested dark navy/purple/blue palette and keep every view responsive.

## Review Focus

- A no-token visitor to any `account.html?view=...` redirects to login; invalid tokens still clear and redirect.
- Successful login/register returns to the requested PangaSiku save continuation only for the fixed supported return target; default auth still returns to account.
- A pending PangaSiku save survives auth navigation only in session storage and is removed after save/failure handling.
- Query view survives browser refresh, selects the correct panel, and marks the correct sidebar link active.
- At mobile widths, sidebar collapse, logout, public navigation, forms, and calculator controls remain reachable without horizontal scrolling.

---

### Task 1: Lock down page map and preservation checks

**Files:**
- Test: `tests/platform.test.js`
- Modify: `docs/superpowers/specs/2026-11-17-bilaform-multipage-platform.md`

- [ ] Add failing structural tests for short Home sections, existing public destinations, protected account view keys, and the existing auth redirect behavior.
- [ ] Run `node --test tests/platform.test.js` and confirm the new page-map assertions fail against the current long Home/dashboard tabs.

### Task 2: Shorten Home and simplify its public navigation

**Files:**
- Modify: `public/index.html`
- Modify: `public/CSS/premium.css`
- Modify: `public/JS/portal.js`
- Test: `tests/platform.test.js`

- [ ] Keep the hero, concise product description, Get Started/Login actions, four-feature overview, short three-step process, and footer.
- [ ] Remove the landing-only calculator, FAQ, article preview, mission block, full benefits list, contact form, and embedded account dialog; their content/actions remain on dedicated pages.
- [ ] Use public links to `about.html`, `services.html`, `how-it-works.html`, `contact.html`, and `auth.html` and keep the mobile menu accessible.
- [ ] Route the hero tool finder to `services/pangasiku.html` for payday/daily planning instead of the removed `#calculator` anchor.
- [ ] Replace the landing script entry with the focused portal menu/finder/PWA behavior; retain service-worker registration and install prompt.

### Task 3: Move the existing calculator and save flow to PangaSiku

**Files:**
- Modify: `public/services/pangasiku.html`
- Create: `public/JS/pangasiku.js`
- Modify: `public/auth.html`
- Modify: `public/JS/auth.js`
- Modify: `public/how-it-works.html`
- Modify: `public/JS/account.js`
- Test: `tests/platform.test.js`

- [ ] Move the existing PangaSiku calculator and purchase simulator markup without changing input IDs, validation copy, result semantics, or KES defaults.
- [ ] Implement local calculation plus `/runway` confirmation in `pangasiku.js`; preserve the `/budgets` save endpoint.
- [ ] If a guest saves, store only the pending calculation in session storage, send them through login/register with a fixed `return=pangasiku` mode, and resume/save after authentication.
- [ ] Change How It Works and service links from `index.html#calculator` to `services/pangasiku.html#calculator`.
- [ ] Move the four existing FAQ answers to How It Works.
- [ ] Test validation, route, authenticated save, and guest continuation behavior at helper/contract level.

### Task 4: Make existing dashboard views direct routes

**Files:**
- Modify: `public/account.html`
- Modify: `public/JS/account.js`
- Modify: `public/CSS/account.css`
- Test: `tests/platform.test.js`

- [ ] Replace tab buttons with grouped sidebar links for Overview, Saved Budgets, Settings/Profile, Security, Help Center, Contact Support, and Logout.
- [ ] Resolve `?view=overview|plans|settings|security`, update active link and panel, and handle popstate/back/forward.
- [ ] Add a collapsible mobile sidebar control, Escape behavior, and a notification/updates link only to the existing announcements page/card.
- [ ] Add a recent activity list from real saved budgets and VukaMonth plans; add no fabricated statistics or activity events.
- [ ] Preserve immediate auth guard, existing overview stats, profile/settings forms, saved plan creation/deletion, and logout.

### Task 5: Update navigation, PWA assets, and run verification

**Files:**
- Modify: `public/about.html`, `public/services.html`, `public/contact.html`, `public/how-it-works.html` as needed for current public navigation
- Modify: `public/service-worker.js`
- Modify: `public/manifest.webmanifest`
- Test: `tests/platform.test.js`

- [ ] Use one consistent public navigation pattern on existing public pages; keep the dashboard navigation separate.
- [ ] Update PWA theme/cache version and precache `pangasiku.js` plus changed assets.
- [ ] Run platform tests, JS syntax checks, local-link checks, manifest parsing, and `git diff --check`.
- [ ] Verify auth, dashboard views, logout, calculator, and mobile rendering in a browser where preview access is available; report any unavailable visual verification accurately.
