# BilaForm Pastel Glass Redesign

## Intent

Adapt the supplied light glassmorphism and bubble-menu brief to BilaForm’s existing personal money planning product. The landing page should feel airy, tactile, and memorable while remaining truthful to the current tools and functional site.

## Goals

- Use an off-white canvas with peach, sky, and mint mesh accents, frosted glass surfaces, near-black ink, and Inter typography.
- Turn the existing header into a floating bubble menu using native HTML/CSS/JavaScript; preserve every existing navigation destination and current auth/PWA controls.
- Create a centered, responsive hero with BilaForm copy, the existing tool finder, and abstract glass planning interface cards that do not suggest real saved user data.
- Carry the visual system through the existing services, benefits, process, calculator, journal, purpose, FAQ, contact, and footer sections.
- Retain existing BilaForm illustrations, tool descriptions, calculations, account actions, article loading, FAQ behavior, contact submission, and PWA behavior.
- Keep announcements off the public landing page; show them on the account page to all signed-in users, as previously requested.
- Keep the page usable without JavaScript and under reduced-motion settings.

## Non-goals

- Turning BilaForm into a design agency, adding agency clients/logos, inventing testimonials or performance metrics, or implying financial outcomes.
- Adding React, GSAP, Tailwind, icon libraries, other dependencies, or a build pipeline; the supplied BubbleMenu interaction is adapted to the current static app.
- Replacing backend/auth behavior, changing account data, or publishing/deploying the site.

## Adapted structure

1. Rounded translucent navigation with the BilaForm logo, an animated menu toggle, all current navigation destinations, and the existing sign-in/account/PWA actions.
2. Pastel mesh hero with original BilaForm headline and copy, tool finder, registration/login calls to action, and three abstract planning UI cards using no invented facts.
3. Existing product statement and four services, restyled as glass surfaces while retaining their current wording, assets, and links.
4. Existing benefits, real three-step flow, journal, mission/vision/values, working KES calculator and purchase simulator, FAQ, contact form, and footer restyled in the same visual system.

## Visual and motion decisions

- Canvas: #FBFCFF. Accent clouds: peach #FFD8C2, sky #CFE3FF, mint #D3F5E3. Primary ink: #15161B; secondary slate: #5C606E. Use translucent white glass with soft white borders, restrained shadows, and `backdrop-filter` fallbacks.
- Use Inter with sensible system fallbacks. Reuse existing project artwork and CSS/SVG icons; do not load Iconify or other external asset libraries.
- Use near-black surfaces for primary actions and occasional emphasis. Do not add placeholder client logos, testimonials, conversion lifts, fake plan details, or unsupported savings claims.
- The menu remains an actual navigation landmark with real links and `aria-expanded`; CSS/JS may animate the link pills but must preserve focus, escape-to-close, click-to-close, and a no-JS visible navigation fallback.
- Hero planning cards are decorative, hidden from assistive technology, responsive, and contain abstract interface shapes only.
- Add reveal and menu motion only where reduced motion is not requested; all core content stays visible with JavaScript disabled or reduced motion enabled.

## Constraints and implementation calls

- The app is static HTML/CSS/JavaScript with server-backed auth and saved account data. Keep the stack and API contracts; adapt the supplied React component behavior rather than installing its dependencies.
- Keep landing styles scoped to `body.landing-page`; do not alter separate account, auth, article, or tool page themes except for the already approved account announcement work.
- Preserve existing navigation, tool routes, KES calculator, save-plan flow, contact form, article loading, FAQ controls, and service worker behavior.
- Update the PWA theme/cache for the changed landing assets and verify internal links and responsive states.
- Browser-based visual verification at desktop and mobile is required before claiming completion; report any local preview access limitation clearly.

## Approaches

- **Adapt the supplied pastel glass visual system and bubble-menu interaction to BilaForm (selected):** keep the current product meaning and static stack, using the reference’s layout/materials without its agency placeholders or React dependency requirement.
- **Keep the approved dark editorial portal:** would preserve the earlier direction, but conflicts with the newly selected light/pastel attachment.
- **Apply pastel colors only:** simpler, but would omit the supplied rounded bubble navigation, hero composition, and frosted surface system.
