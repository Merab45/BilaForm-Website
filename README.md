# BilaForm Website

BilaForm is a responsive, static FinTech concept website for planning day-to-day spending between income days. It includes an interactive daily runway calculator, a local-only product demo, explanatory feature cards, product and VukaMonth illustrations, an FAQ accordion, and installable/offline-capable Progressive Web App support.

The calculator and dashboard are examples only. The linked demo runs in the browser and resets its sample entries when reloaded. This project does not connect to a bank, process payments, create user accounts, or provide live prices.

## Project structure

```text
.
├── index.html                 Main landing page
├── CSS/styles.css             Responsive design system and page styles
├── JS/site.js                 Calculator, navigation, FAQ, and install behavior
├── manifest.webmanifest       PWA metadata and application icons
├── service-worker.js          Offline shell and static asset caching
├── server.cjs                 Dependency-free local preview server
├── contact.html               Contact-channel status
├── privacy.html               Current prototype privacy notice
├── terms.html                 Prototype terms and usage notice
├── BilaForm-Android-Prototype/
│   ├── index.html              Interactive, local-only product demo
│   ├── demo.css                Demo dashboard and responsive layout
│   └── demo.js                 Sample expense log and runway calculation
├── Assets/
│   ├── Assets/                Existing brand, photography, and feature artwork
│   ├── Illustrations/         Product, calculator, FAQ, and planning illustrations
│   ├── icons/                 192px and 512px PWA icons
│   └── images/                Reserved for optimized standalone images
└── Assets/Assets/benefits/    Benefit card icons
```

The “Small moves. Big difference.” section explains the BilaForm features without linking to separate tool pages. The interactive PangaSiku calculator remains on the landing page; the separate product demo runs locally in the browser and resets its sample entries when reloaded.

The original hero image and background remain at their existing paths so the protected hero markup, links, images, and styling remain unchanged.

## Run locally

The site has no build step or package dependencies. With Node.js installed, start the included local HTTP server:

```sh
node server.cjs
```

Then open <http://localhost:8000>. You can also use another static HTTP server. Use HTTPS or `localhost` to test service workers and installation; opening `index.html` directly as a `file://` URL does not enable those browser features.

## Assets

- Existing brand images and feature graphics: `Assets/Assets/`
- Benefit icons: `Assets/Assets/benefits/`
- Named product illustrations: `Assets/Illustrations/`
- PWA application icons: `Assets/icons/`
- Optimized standalone images can be added under `Assets/images/`. The source hero photography remains in its existing location.

All illustrations and photographs currently referenced by the page are local project assets. The site does request DM Sans and Space Grotesk from Google Fonts when online; system font fallbacks are configured for offline use.

## Install BilaForm

Deploy the folder on HTTPS, visit the site in a browser that supports PWA installation, and use the browser's install prompt. The in-page **Install BilaForm** control appears only when the browser fires its install-available event. The service worker caches the page and local assets and serves the cached landing page if a later navigation is offline.

## Deployment

Upload the project folder to a static host with HTTPS, preserving file names and directory capitalization. The manifest, service worker, policy pages, and assets must be served from the same origin. No server runtime is needed for the current prototype.

Before a public production launch, configure a monitored support contact and review the privacy and terms pages against the final hosting/analytics setup and applicable requirements. The interactive demo link expects the site to be hosted at the domain root, where its `../BilaForm-Android-Prototype/index.html` destination resolves to the included demo folder. If you deploy under a nested path, configure the host to serve that sibling route.

## Validation notes

JavaScript source can be syntax-checked with `node --check JS/site.js`, `node --check service-worker.js`, `node --check server.cjs`, and `node --check BilaForm-Android-Prototype/demo.js`. The static site does not include an automated test suite.
