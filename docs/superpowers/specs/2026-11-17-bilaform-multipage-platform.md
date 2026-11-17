# BilaForm Multi-page Platform Restructure

## Intent

Make BilaForm feel like a focused SaaS platform: public visitors get a short introduction and clear routes to product pages; signed-in users get their planning, saved data, and account controls in a protected dashboard.

## Goals

- Reduce Home to navigation, a concise hero, primary account actions, a brief feature overview, short process section, and useful footer links.
- Use the current dark navy, purple, and blue identity consistently with responsive layouts.
- Use existing About, Services, How It Works, Contact, Articles, Auth, and Account pages instead of duplicating them.
- Move the working daily budget calculator and purchase simulator from Home to the existing PangaSiku service page while preserving calculation and save behavior.
- Route every existing supported dashboard view to an addressable `account.html?view=...` location that survives refresh and remains protected by the existing JWT/API checks.
- Organize the account sidebar into Dashboard, Planning, Account, and Support links. Include only existing supported features.
- Make the dashboard sidebar collapsible on mobile, preserve active route indication, account data, API requests, login/register redirect, logout, and saved plans.
- Keep public navigation separate from account navigation and announcements visible only in the authenticated account area.

## Non-goals

- Adding unsupported forms, submissions, client activity tracking, unread counts, or fake notification data.
- Replacing authentication, server APIs, local account keys, existing service calculations, or the contact backend.
- Adding React, routing dependencies, backend changes, or publishing to GitHub Pages.

## Page map

- `index.html`: short public Home.
- `about.html`: existing About Us, mission, and values.
- `services.html`: existing feature and service directory; each tool links to its own existing service page.
- `how-it-works.html`: existing process guide plus the FAQ content moved from Home.
- `contact.html`: existing API-backed contact form.
- `auth.html?auth=login|register`: existing authentication interface.
- `account.html?view=overview|plans|settings|security`: protected dashboard views within the existing account template; each sidebar item has a distinct refresh-safe URL.
- `services/pangasiku.html`: PangaSiku description and transferred calculator/purchase simulator.

## Visual and interaction decisions

- Use #10172A, #7957FF, #398BFF, #FFFFFF, and #F5F7FB as the platform palette; retain a lighter content canvas with navy navigation and dark dashboard surfaces.
- Keep public navigation to Home, About, Features, How it works, Contact, plus Login and Register actions.
- Use standard static page links and query routes supported by GitHub Pages. Do not introduce client-side route fallback requirements.
- Keep the dashboard’s statistics based on `/budgets` and `/plans`; populate recent activity only from actual saved records.
- Use an accessible mobile sidebar toggle with Escape-to-close and route navigation; preserve the existing server-backed API contracts.

## Constraints

- Project uses static HTML/CSS/JavaScript, Express API, SQLite, and localStorage JWT/profile keys. Keep these contracts.
- Do not change account records or API schemas.
- Update service-worker precache/cache version for changed/new files.
- Verify local links and flows; do not claim visual/browser verification if local preview cannot be opened.

## Approach

- **Restructure the existing static pages and extend the current account template with query-addressable views (selected):** reuses current content and auth/API behavior with the fewest duplicated templates and remains compatible with GitHub Pages. Cost: account subviews share one HTML template rather than separate physical files.
- **Create new pages for every dashboard panel:** gives distinct physical files, but duplicates protected dashboard markup and increases the chance of inconsistent auth/data behavior.
- **Add a React/router app:** unnecessary because the project is static today and would add build/deployment complexity.
