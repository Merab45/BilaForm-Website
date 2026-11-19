# BilaForm

BilaForm is a static KES personal money planning website. The pages use the Supabase JavaScript client directly for authentication and account data; no local Node API is required for the current frontend.

## Run locally

1. Configure `public/JS/supabase-config.js` with the Supabase project URL and browser-safe publishable key. Never put a service-role key in frontend code.
2. In the Supabase Dashboard, run `supabase/migrations/20261118_bilaform_schema.sql` in the SQL Editor if the project does not have the initial BilaForm tables yet.
3. Run `supabase/migrations/20261119_pangasiku_guided_plan.sql` to add guided PangaSiku fields and private daily spending entries. It preserves existing budget rows. The daily guide works locally without this migration, but saving its new fields and tracking daily spending require it.
4. In Supabase Authentication → URL Configuration, include the local Live Server origin (commonly `http://127.0.0.1:5501`) and the deployed site URL in the allowed redirect URLs.
5. Open the project `public` folder with VS Code Live Server, or serve that folder with any static HTTP server. Do not use `file://` URLs.

The site can also be hosted on GitHub Pages. Configure Supabase Authentication redirect URLs for the deployed BilaForm pages. Contact form submissions are stored in Supabase; no email delivery is configured by this repository.

## Product notes

- Guests can calculate a PangaSiku estimate in their browser. Signing in is required to save plans and daily spending entries.
- A guest plan is held in session storage only while the sign-in redirect is completed.
- Saved budgets, daily spending, savings goals, and profile data are protected by Supabase Row Level Security policies in the migrations.
- BilaForm does not import bank or mobile wallet data. Calculations use only the amounts and dates entered by the user and are planning estimates.
- There are no fabricated testimonials or financial performance claims.

## Project structure

- `public/`: static website pages, styles, scripts, assets and service worker.
- `public/JS/supabase-config.js`: project URL and publishable key configuration.
- `public/JS/bilaform-data.js`: small data adapter that uses the Supabase client.
- `supabase/migrations/`: SQL schema and additive changes to run in the Supabase SQL Editor.
- `tests/`: repository checks; some legacy tests still target the retired local API and need migration to the browser-first architecture.

## Data migrations

Run migrations manually in Supabase SQL Editor, in filename order. The second migration is additive: it adds optional PangaSiku context fields and creates `daily_spending`; it does not rewrite or delete existing plans. Review the SQL and keep a backup/export of production data before schema changes. Never expose the Supabase secret/service-role key to the browser.
