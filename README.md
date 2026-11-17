# Hawkeye Engagement — Cloudflare edition

This is a complete replacement project, based on your uploaded files. It keeps the React design and replaces Supabase/browser-only storage with Cloudflare Workers + D1. Cloudflare Access controls who can open the site. All authorized people share one database with read/add/import/export permissions. Editing/deleting records and individual staff permission levels are not included.

## 1. Prepare the folder

Extract the ZIP. Open the `hawkeye-cloudflare` folder in VS Code. Choose Terminal > New Terminal. Install Node.js LTS if needed (Node 22 or newer recommended), then run:

```sh
npm install
npx wrangler login
```

Sign in to the Cloudflare account where you want to host this app. You do not need Supabase, its SQL schema, or VITE_SUPABASE environment variables. This is a **Worker project**, not a Pages drag-and-drop upload. Keep the folder structure intact.

## 2. Create the D1 database

In the same terminal:

```sh
npx wrangler d1 create hawkeye-engagement
```

Copy the `database_id` from the command output. Open `wrangler.jsonc` and replace only `REPLACE_WITH_YOUR_D1_DATABASE_ID` with that ID. Keep the binding name `DB`. If a database with this name already exists, use its ID instead of creating another one.

Apply the included tables to your cloud database:

```sh
npm run db:remote
```

Confirm the migration when prompted. This creates empty tables; it does not upload the old browser records or demo contacts.

## 3. Deploy the app

```sh
npm run deploy
```

Open the `https://hawkeye-engagement.<your-subdomain>.workers.dev` URL printed by Wrangler. At this point, a “Sign-in required” response is expected: the app intentionally waits for Access configuration.

## 4. Set up Cloudflare Access

1. In Cloudflare, go to **Workers & Pages > hawkeye-engagement > Settings**. Find the workers.dev URL's **Access** / **Enable Cloudflare Access** option. Enable it. If you use the Zero Trust dashboard instead, create an **Access > Applications > Add application > Self-hosted** application for the exact Worker hostname. Protect the entire hostname, not just `/api`.
2. Complete Zero Trust setup if prompted and choose a team name. Your team domain looks like `https://your-team.cloudflareaccess.com`.
3. Set an **Allow** policy for your own exact email and any specific coworkers who should have access. Do not use “Everyone.” Configure an identity provider or enable One-time PIN so those addresses can sign in. An email code is a Cloudflare login; it is not automatically University of Iowa SSO.
4. Open that Access application's overview/settings and copy its **Application Audience (AUD) Tag**. Use the application AUD, not an account ID or API token.
5. In `wrangler.jsonc`, replace `https://YOUR-TEAM.cloudflareaccess.com` with your team domain and replace `REPLACE_WITH_ACCESS_APPLICATION_AUD` with the AUD tag. These values are identifiers, not passwords. They stay in the Worker configuration; no browser database key is needed.
6. Redeploy:

```sh
npm run deploy
```

Open the Worker URL again and sign in. The dashboard should say **Cloudflare connected** and start with zero contacts. If you add a custom hostname later, add it to the same Access application so the AUD stays consistent. Keep preview URLs protected or disabled; the Worker also rejects requests without a valid Access token.

## 5. Confirm shared saving

1. Add a clearly labeled test contact and log a test interaction.
2. Reload the page. The records should remain.
3. Open the URL in another browser, sign in with an allowed email, and verify the same records appear.
4. Test Import / Export with a small CSV. Refresh data to see changes added by others. There is no live push synchronization.

## Existing data

The earlier app saved browser data under `he-contacts` and `he-interactions`. Before replacing your old site, use its Export contacts and Export interactions buttons and keep those files as backups. Import the contacts CSV into this app (up to 100 rows per batch). Duplicate email addresses are skipped; existing contacts are not overwritten. Invalid rows reject the entire batch and report the CSV row number. Quoted commas and multiline quoted cells are supported.

Historical interaction CSV import is not included. Keep the old interaction export and re-enter those records using Log Interaction, or arrange a separate migration. The included empty D1 database does not automatically read Supabase or local storage. No demo records are copied into the shared database.

## Local preview (optional)

```sh
npm run db:local
npm run dev
```

Open the localhost URL shown by Wrangler. Local preview uses a separate local D1 database. Its command enables a localhost-only authentication bypass; do not add `LOCAL_DEV` to deployed configuration. `npm run dev:ui` runs Vite alone and does not provide the API. Restart `npm run dev` after changing frontend code to rebuild it.

## Later updates

Replace the changed source files, keep your real D1 ID and Access settings in `wrangler.jsonc`, then run `npm install` and `npm run deploy`. Use `npm run db:remote` only when there are new migration files. Never delete/recreate the database for a routine update. Keep `package-lock.json` in your repository. Do not upload `node_modules`, `.wrangler`, `.env` or `.dev.vars` files.

For Cloudflare Git-connected Worker builds, use this folder as the root, `npm run build` as build command and `npx wrangler deploy` as deploy command. Complete D1 creation, configuration, migrations, and Access setup first. This package is for Hawkeye Engagement, not Santa HQ; use a separate repository/project.

## Troubleshooting

- **Sign-in required / 401:** Enable Access for this exact hostname, verify the team domain and application AUD in `wrangler.jsonc`, redeploy, then sign out/in. Direct unprotected URLs cannot bypass the Worker checks.
- **Cloudflare disconnected / database request failed:** Verify the database ID and `DB` binding, and run `npm run db:remote`.
- **Only HTML loads / API 404:** Deploy the whole Worker using `npm run deploy`, not only the `dist` folder to Pages or GitHub Pages.
- **Site does not show latest coworker changes:** Click Refresh data. Exports reflect the records currently loaded.
- **CSV errors:** Paste CSV including headers `name,email,title,department,college`; name, email and department are required. Save Excel files as CSV first.

University hosting/data approval still applies before using real institutional records. Cloudflare Access is authentication for this app, not a statement that Cloudflare has institutional approval.

## Official references

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/
