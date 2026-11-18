# BilaForm Full Stack

BilaForm is a KES-focused personal finance planner for everyday choices between paydays. The responsive static frontend is served by a small Express API. The API creates a local SQLite database automatically for accounts, saved PangaSiku plans and contact messages.

## Project structure

```text
.
├── package.json
├── server.js
├── bilaform.db                 # created automatically when the server starts
└── public/
    ├── index.html
    ├── about.html
    ├── services.html
    ├── services/                # Dedicated BilaForm tool pages
    ├── how-it-works.html
    ├── articles.html
    ├── announcements.html
    ├── resources.html
    ├── contact.html
    ├── account.html             # Signed-in client portal
    ├── CSS/styles.css
    ├── CSS/account.css
    ├── JS/site.js
    ├── JS/account.js
    ├── JS/contact.js
    ├── JS/navigation.js
    ├── Assets/                 # BilaForm images, illustrations and icons
    ├── blog/                   # Journal directory and article pages
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── privacy.html
    └── terms.html
```

## Run locally

Install Node.js 18 or newer, then from the project root run:

```sh
npm install
npm start
```

Open `http://127.0.0.1:8000`. Change the port with `PORT=3000` (PowerShell: `$env:PORT=3000; npm start`). SQLite creates `bilaform.db` and the required tables on first startup; no manual database setup is needed.

For production, set a long random `JWT_SECRET` environment variable before starting the server. The development fallback secret is only for local use. Set `CORS_ORIGIN` only if a separate trusted frontend origin needs API access. Do not commit production secrets or the database file.

## Backend endpoints

- `GET /api/health` — service health.
- `POST /api/runway` — validate and calculate a PangaSiku daily allowance.
- `POST /api/auth/register` and `POST /api/auth/login` — create an account or sign in; passwords are hashed with bcrypt and the response includes a seven-day JWT.
- `GET /api/auth/me` and `PATCH /api/auth/profile` — read and update the signed-in user profile.
- `POST /api/budgets`, `GET /api/budgets`, `GET /api/budgets/latest`, and `DELETE /api/budgets/:id` — save, list, retrieve and remove PangaSiku budgets.
- `GET /api/plans`, `POST /api/plans`, and `DELETE /api/plans/:id` — save, list and remove VukaMonth plans.
- `POST /api/contact` — validate and store a contact message.
- `GET/POST /api/savings-goals`, `PUT/DELETE /api/savings-goals/:id`, and `POST /api/savings-goals/:id/contributions` — manage signed-in users’ savings goals and contribution history. These routes return `503` until the additive schema migration has been applied.

Money inputs are whole KES amounts. The daily guide is `floor(max(0, cash - essentials - buffer) / days)`. The browser calculates immediately and uses the API when it is reachable, so the planner remains available offline. Account and contact features need the Node server.

## Privacy and production notes

JWT and display name are stored in browser local storage as requested. Treat an account session as active on that browser until the user logs out or the seven-day token expires. Saved budgets and submitted messages are stored in the local SQLite database; protect database backups and use HTTPS in production. Contact messages are stored but are not emailed or forwarded automatically. Account verification, password reset, account deletion, message retention controls, backups, and operational monitoring need production configuration before launch.

This app does not connect to banks or mobile money, move funds, or provide regulated financial advice. Example dashboard numbers are illustrative. Calculations are planning estimates.

## Assets and Journal

Place website images and illustrations in `public/Assets/`. Journal content and curated `popular` / `featured` flags are in `public/blog/blog-data.js`; individual static article pages are in `public/blog/articles/`.

## Website pages

The public site uses a shared navigation hierarchy for About, Services, Get Started, News & Articles, Resources, Contact, and the Client Portal. Service pages describe PangaSiku, Can I afford this?, Micro-leak finder, and VukaMonth. The announcements page displays an empty state until there is an actual update to publish. Resource links point to the Journal, privacy policy, and terms; unsupported downloads and testimonials are not fabricated.

The account portal reads and updates profile details, lists/removes saved PangaSiku calculations, and saves/lists/removes VukaMonth allocations. Display preferences are stored locally in the browser.

### Savings goals schema

Savings goals use two additive SQLite tables. Existing databases are not changed automatically at server startup. Before enabling the feature on an existing installation, stop writes to the database and make a verified backup, then run `npm run db:migrate:savings-goals` with `BILAFORM_DB_PATH` set to that database file. The command first creates a timestamped SQLite backup beside the database, then adds the tables, indexes and triggers in a transaction. It refuses to proceed if the schema is partial or the backup path already exists. No migration is run as part of deployment by this repository. Keep a separate post-migration backup before accepting goal data; restoring the pre-migration backup later would also discard goals created after it.

If GitHub Pages hosts the frontend, configure a separate HTTPS Node API host with persistent SQLite storage. Set `window.BILAFORM_API_BASE_URL` to that host before `JS/api-config.js` executes (for example, from a small configuration script loaded before `api-config.js`); the frontend appends `/api`. Configure the backend `CORS_ORIGIN` to the exact frontend origin, `https://merab45.github.io`, and set a production `JWT_SECRET`. Without that host setting, the sign-in page now explains the missing backend instead of displaying the browser’s generic “Failed to fetch” message. The API host, credentials, persistence and CORS settings must be supplied by the site owner; this repository does not create or verify external hosting.

## Deployment

Deploy the Node application to a host that supports persistent disk storage for SQLite. Set `NODE_ENV=production`, `JWT_SECRET`, and `PORT` through the host’s environment settings. Ensure the database path is on persistent storage, configure HTTPS and backups, and update canonical / Open Graph URLs if the domain changes. GitHub Pages can host the static pages only; its static hosting cannot run this API or persist accounts and contact messages.
