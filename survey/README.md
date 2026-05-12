# Reletix Team Pulse Survey

Anonymous feedback form for the Reletix team, deployed on Cloudflare Workers + D1.

## What it is
- Single-page anonymous survey at `GET /`
- 11 questions covering attendance, product, morale, vision
- Stores responses in D1 (no IPs, no user agents)
- Admin dashboard at `GET /admin?token=...` with stats + CSV export

## Stack
- **Cloudflare Worker** (single JS file, no build step)
- **D1 database** `reletix-survey` (already created, id `1036e35b-f542-4907-a547-4f7871b2b041`)
- HTML/CSS inline in the Worker — zero dependencies

## First-time deploy

```bash
cd survey
npm install
npx wrangler login                # opens browser, one-time
npx wrangler secret put ADMIN_TOKEN   # set a strong random string
npx wrangler deploy
```

Wrangler prints the URL — something like `https://reletix-survey.<your-subdomain>.workers.dev`.

## Local dev

```bash
npx wrangler dev --remote
```

`--remote` uses the real D1 database. Drop the flag to run against a local D1 emulator.

## Admin

- View: `https://<deploy-url>/admin?token=YOUR_ADMIN_TOKEN`
- CSV: `https://<deploy-url>/admin/export.csv?token=YOUR_ADMIN_TOKEN`
- Direct DB export: `npm run db:export`

## Custom domain (optional)
Point a route like `survey.reletix.com` at the Worker in the Cloudflare dashboard → Workers & Pages → your worker → Settings → Triggers → Add custom domain.

## Privacy notes
- No IP address, user agent, or cookies are stored
- The optional contact field in Q11 is the only identifying info, and only if the user chooses to fill it
- Set the page to `noindex` via meta tag so it doesn't show up in search

## Schema

See `schema.sql`. To re-apply manually:

```bash
npx wrangler d1 execute reletix-survey --remote --file=schema.sql
```
