# BilaForm Website

BilaForm is a responsive financial planning website for everyday money decisions and making a plan between paydays. It includes a daily spending calculator, informational product sections, an FAQ, a curated financial insights Journal, and Progressive Web App support. The website is static and can be hosted on GitHub Pages.

The daily allowance calculator uses the available cash less planned essential expenses and a chosen buffer, divided by the days remaining. Calculations happen in the browser. BilaForm does not connect to bank or mobile money accounts, hold funds, process payments, or provide account sign-in on this site.

## Project structure

```text
.
├── index.html                     Homepage and daily planner
├── CSS/styles.css                 Main BilaForm styles
├── JS/site.js                     Calculator, navigation and FAQ behaviour
├── blog/
│   ├── index.html                 Journal directory with search and filters
│   ├── blog.css                   Homepage and Journal editorial styles
│   ├── blog-data.js               Article copy and featured/popular flags
│   ├── blog.js                    Directory rendering and controls
│   ├── blog-home.js               Homepage popular article cards
│   ├── article.js                 Shared article page renderer
│   ├── nav.js                     Blog mobile navigation
│   └── articles/                  Eight individual article URLs
├── Assets/
│   ├── Illustrations/             Original BilaForm illustrations
│   ├── Assets/                    Brand artwork and photography
│   └── icons/                     PWA icons
├── manifest.webmanifest           Installable app metadata
├── service-worker.js              Offline cache and fallback
├── privacy.html
└── terms.html
```

## Run locally

Use any static HTTP server from the project root. For example, with Node.js installed:

```sh
node server.cjs
```

Then open the local address printed by the server. A local HTTP server is required for service workers and PWA installation; opening `index.html` as a `file://` URL is not sufficient.

## Journal content

Article titles, summaries, copy, dates, images and the `popular` / `featured` selections are maintained in `blog/blog-data.js`. Edit those flags to curate the homepage and directory picks. Update an article slug carefully because it is also the corresponding static HTML filename and URL. Blog illustrations and photography are kept in `Assets/Illustrations/` and `Assets/Assets/`; article pages use relative paths so they work from GitHub Pages project subpaths.

## PWA installation

On HTTPS hosting or localhost, supported browsers can offer installation through BilaForm’s install prompt. The install control is only shown when the browser signals that installation is available. The service worker caches the homepage, Journal pages, and local assets for repeat and offline access; a previously visited page can still be opened offline.

## Deploy to GitHub Pages

Push the project to the repository and configure GitHub Pages to publish the project root (or the selected branch/folder containing `index.html`). The current canonical URL metadata targets `https://merab45.github.io/BilaForm-Website/`; update canonical and Open Graph URLs if the repository or custom domain changes. Verify the deployed subpath, HTTPS, PWA manifest and service worker after publishing.

## Contact details

The contact section currently contains sample details marked as placeholders. Replace them with monitored contact channels before using them for customer support. Privacy and terms content should also be reviewed against the final hosting, data handling and support setup.
