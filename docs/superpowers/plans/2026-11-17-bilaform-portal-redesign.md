# BilaForm Pastel Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the supplied pastel glass and BubbleMenu interaction to BilaForm while preserving its product truth and working tools.

**Architecture:** Keep static HTML/CSS/JavaScript. Use the current header/nav links and existing `site.js` menu state, add page-scoped styles and small landing behavior in `portal.js`, and retain the existing section and service markup.

**Tech Stack:** HTML, CSS, browser JavaScript, `node:test`; no new dependencies or build step.

**Spec:** [2026-11-17-bilaform-portal-redesign.md](../specs/2026-11-17-bilaform-portal-redesign.md)

## Global Constraints

- Keep BilaForm a KES-focused personal money planning product and preserve truthful existing copy.
- Use #FBFCFF with #FFD8C2, #CFE3FF, and #D3F5E3 accents, frosted glass, and #15161B primary ink.
- Keep static HTML/CSS/JavaScript; do not add React, GSAP, Tailwind, or icon libraries.
- Preserve all current navigation routes, auth, account data, calculator/save flow, contact API, article loading, FAQ, and PWA behavior.
- No-JS and reduced-motion views remain visible and usable.
- Announcements remain only on the account page for signed-in users.

## Review Focus

- At 320px, floating navigation, hero mock cards, feature cards, calculator, and footer must not overflow horizontally.
- Without JavaScript, every navigation destination remains visible and usable; with JavaScript, menu toggle state, Escape, and link close work.
- Under reduced motion, hero and menu content remain readable without required animation.
- Tool-finder whitespace, known topics, and unknown text provide correct routes and clear status.
- Calculator values, saved-plan action, contact submission, and loaded article links remain present and unchanged.

---

### Task 1: Make the navigation a responsive bubble menu

**Files:**
- Modify: `public/index.html`
- Modify: `public/CSS/premium.css`
- Modify: `public/JS/portal.js`
- Test: `tests/portal.test.js`

**Interfaces:** Keep `#primary-navigation`, `.menu[aria-expanded]`, all current anchor destinations, and `site.js` open/close handling. `portal.js` adds only page-scoped visual state and focus handling where needed.

- [ ] Add tests for menu open/close/escape behavior if it is extracted into a pure helper; otherwise verify existing event contract with static assertions.
- [ ] Style a floating glass header and staggered pill links; retain all destinations and account/install actions.
- [ ] Add progressive enhancement so closed overlay styling activates only after JS; preserve no-JS navigation.
- [ ] Verify keyboard focus, Escape, outside/route close, and responsive menu layout.

### Task 2: Build the pastel BilaForm hero and tool finder

**Files:**
- Modify: `public/index.html`
- Modify: `public/CSS/premium.css`
- Modify: `public/JS/portal.js`
- Test: `tests/portal.test.js`

**Interfaces:** Finder remains `form[data-tool-finder]`, `input[name="query"]`, and `[data-tool-finder-status]`; preserve its existing routes to calculator, affordability, micro-leaks, VukaMonth, and service directory.

- [ ] Keep existing BilaForm headline and product copy; add three decorative, aria-hidden glass planning cards with abstract UI shapes only.
- [ ] Keep login/register calls to action and the finder visible and usable at narrow viewport widths.
- [ ] Add a gentle hero entrance and card hover motion with reduced-motion and no-JS fallbacks.
- [ ] Test all topic routes, whitespace, unknown queries, and keyboard submit.

### Task 3: Restyle existing landing sections as a glass product site

**Files:**
- Modify: `public/index.html`
- Modify: `public/CSS/premium.css`

- [ ] Restyle statement, four services, benefits, three-step flow, journal, purpose, calculator, FAQ, contact, and footer with scoped palette/type/glass tokens.
- [ ] Preserve every current service title, description, image, CTA, calculator input/result, form control, FAQ answer, article container, and footer destination.
- [ ] Keep benefits/process copy factual; do not add fabricated testimonials, brands, performance metrics, or agency language.
- [ ] Verify readability, focus visibility, and 320/768/1440px layouts.

### Task 4: Refresh PWA cache and verify preserved flows

**Files:**
- Modify: `public/service-worker.js`
- Modify: `public/manifest.webmanifest`
- Verify: `public/index.html`, `public/JS/site.js`, account/auth pages

- [ ] Update theme colors and bump the service-worker cache; precache the changed landing script and stylesheet.
- [ ] Check internal links, login/register destinations, account announcement placement, calculator/save flow, contact submission, articles, FAQ, and service routes.
- [ ] Run `node --test tests/portal.test.js`, JS syntax checks, local-link checks, and `git diff --check`.
- [ ] Verify desktop and mobile visually in a browser if local preview is available; report any access limitation rather than claiming an unobserved pass.
