# Supabase setup for BilaForm

BilaForm's browser app now uses Supabase Auth and the Supabase JavaScript client for account data. The pages do not need the local BilaForm Node API.

## 1. Add the browser connection values

In `public/JS/supabase-config.js`, set:

```js
window.BILAFORM_SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
window.BILAFORM_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

You can use the project's legacy `anon` key if it has not been migrated to publishable keys. These are browser keys, and access must be restricted by the RLS policies in the SQL below. Never put a `service_role` or secret key in this file, HTML, GitHub Pages, or browser developer tools.

Find the URL and publishable key in your Supabase project's API settings.

## 2. Create the BilaForm tables and policies

Open the Supabase SQL Editor and run `supabase/migrations/20261118_bilaform_schema.sql`. It creates profiles, budgets, VukaMonth plans, savings goals, contribution history, contact messages, RLS policies and the atomic savings contribution function. The contact form only inserts messages; it does not send email.

This setup intentionally starts with empty Supabase tables. It leaves the old SQLite database and backups untouched. Existing BilaForm users will need to register in Supabase; SQLite password hashes cannot be used as Supabase Auth accounts. Existing saved data remains in the local database and is not automatically copied.

## 3. Set Supabase Auth options

In Authentication settings:

- Enable Email provider and email/password sign-in.
- Set the site URL to your deployed BilaForm base URL.
- Add redirect URLs for the deployed site and local preview, including `http://127.0.0.1:5501/**`, `http://localhost:5501/**`, and your GitHub Pages URL such as `https://merab45.github.io/BilaForm-Website/**`.
- Configure SMTP/email templates before relying on confirmation and password recovery links in production. Supabase's default email service is intended for testing and has delivery limits.

## 4. Run locally

Start VS Code Live Server from the project root and open `http://127.0.0.1:5501/`. You do not need `npm start` for login or saved data. The Supabase project must be online and the URL/key plus SQL/Auth settings must be configured.

After entering the values, hard-refresh the site (Ctrl+Shift+R). Register a new test account, confirm its email if confirmation is enabled, then sign in and try saving a PangaSiku plan, VukaMonth plan and savings goal.
