# BilaForm API on Render

This repository includes a Render Blueprint for the existing Node API. It keeps
SQLite on a persistent disk, generates the production JWT secret in Render, and
applies the additive Savings Goals migration on the service's first successful
deployment. The migration creates a SQLite backup on the mounted disk before it
adds the tables.

## Deploy

1. Sign in to Render and create a Blueprint from the `Merab45/BilaForm-Website`
   GitHub repository, using the `main` branch and the root `render.yaml` file.
2. Review the paid service and 1 GB persistent disk before confirming creation.
   Render currently lists the `0.5c-512mb` service at US$7/month and persistent
   disk storage at US$0.25/GB/month. The configured minimum is therefore about
   US$7.25/month, before tax, bandwidth or other usage. Render requires a paid
   service for persistent disks; its free web services have ephemeral filesystems.
3. Wait for the first deploy and its initial migration hook to finish. Confirm
   `GET /api/health` returns `{"status":"ok","service":"bilaform-api"}`.
4. Render will assign the service a public HTTPS URL. Confirm the actual URL in
   the dashboard; the suggested service name may need changing if already taken.
5. After the API URL is known, set
   `window.BILAFORM_API_BASE_URL` in `public/JS/api-config.js` to that HTTPS
   origin (without `/api`). Commit and publish the static-site change to GitHub
   Pages, then bump the service-worker cache version so clients receive it.

## Existing accounts and data

The Blueprint does not copy `bilaform.db` or any local backup to Render. A new
deployment creates an empty database on its persistent disk, so existing local
accounts and saved plans will not be present until a verified SQLite backup is
transferred. Do not upload a database file from the Git repository: a database
backup is currently tracked in Git. Before deploying, remove that backup from
the repository's tracked files while retaining a protected local copy, and
review the repository history and access settings. Then use a separate,
verified migration and restore plan for the account data. Never place SQLite
files, backups, JWT secrets or email-provider credentials in `public/`.

## Password reset email

Password-reset requests remain unavailable until the API environment is given
`RESEND_API_KEY` and `PASSWORD_RESET_FROM` for a verified sender address. These
are intentionally not included in `render.yaml`; set them as secret environment
variables in Render. `PUBLIC_APP_URL` is configured to the existing GitHub Pages
project URL.

## Browser cookie note

The current frontend and API use credentialed HttpOnly cookies. GitHub Pages and
an `onrender.com` API are different sites, so browsers must accept the API's
cross-site cookie. Some browser privacy settings may block it. For dependable
production authentication across browsers, put the frontend and API on the same
site under a custom domain, or move the frontend to the same hosted origin. Keep
the `CORS_ORIGIN` value aligned with the production frontend origin.
