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
    ├── account.html             # Signed-in profile and saved budget page
    ├── CSS/styles.css
    ├── JS/site.js
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

Money inputs are whole KES amounts. The daily guide is `floor(max(0, cash - essentials - buffer) / days)`. The browser calculates immediately and uses the API when it is reachable, so the planner remains available offline. Account and contact features need the Node server.

## Privacy and production notes

JWT and display name are stored in browser local storage as requested. Treat an account session as active on that browser until the user logs out or the seven-day token expires. Saved budgets and submitted messages are stored in the local SQLite database; protect database backups and use HTTPS in production. Contact messages are stored but are not emailed or forwarded automatically. Account verification, password reset, account deletion, message retention controls, backups, and operational monitoring need production configuration before launch.

This app does not connect to banks or mobile money, move funds, or provide regulated financial advice. Example dashboard numbers are illustrative. Calculations are planning estimates.

## Assets and Journal

Place website images and illustrations in `public/Assets/`. Journal content and curated `popular` / `featured` flags are in `public/blog/blog-data.js`; individual static article pages are in `public/blog/articles/`.

## Deployment

Deploy the Node application to a host that supports persistent disk storage for SQLite. Set `NODE_ENV=production`, `JWT_SECRET`, and `PORT` through the host’s environment settings. Ensure the database path is on persistent storage, configure HTTPS and backups, and update canonical / Open Graph URLs if the domain changes. GitHub Pages can host the static pages only; its static hosting cannot run this API or persist accounts and contact messages.
