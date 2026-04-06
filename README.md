# LifeOS

LifeOS is a personal digital life dashboard that consolidates finance logs, journal entries, health records, and a lightweight vault behind a single AI-style input surface.

The current repository contains:
- a React + Vite frontend
- a Cloudflare Workers + Hono backend
- a D1 schema and repository layer
- cookie-based session/auth with Google OAuth
- encrypted vault storage using Web Crypto AES-GCM in the worker

## Status

Implemented now:
- Responsive dashboard UI for `Overview`, `Finance`, `Journal`, `Health`, and `Vault`
- Natural-language style input for finance, journal, health, and vault creation
- D1-backed reads and writes for dashboard data
- Vault encryption at rest in the worker
- Secret retrieval API for copy-to-clipboard flows
- Google OAuth start + callback code exchange flow
- API Key support for CLI/External integrations

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: Cloudflare Workers, Hono
- Database: Cloudflare D1
- Security: Web Crypto API with AES-GCM for vault secrets
- Shared contracts: TypeScript models under `shared/`

## Project Structure

```text
src/         Frontend app
worker/      Cloudflare Worker routes, auth, crypto, repository
shared/      Shared domain models and API contracts
docs/        Planning spec and UI reference
schema.sql   D1 schema
wrangler.toml Worker config
TODO.md      Progress and remaining work
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Start the worker locally:

```bash
npm run dev:worker
```

To point the frontend at the local worker:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

## D1 Setup

Create and initialize the database in local/dev flow:

```bash
npx wrangler d1 execute lifeos-db --local --file=schema.sql
```

## Cloudflare Deployment

### 1. Deploy the Worker

Create the production D1 database:

```bash
npx wrangler d1 create lifeos-db
```

Update [wrangler.toml](/home/zzlee/lifeos/wrangler.toml) with the real `database_id`.

Initialize the production schema:

```bash
npx wrangler d1 execute lifeos-db --remote --file=schema.sql --env production
```

Set required Worker secrets:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put VAULT_MASTER_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI
```

Deploy:

```bash
npx wrangler deploy --env production
```

### 2. Deploy the Frontend to Pages

Set the Pages environment variable in the Cloudflare Dashboard:
- `VITE_API_BASE_URL`: Your Worker URL

### 3. Troubleshooting 404 Errors

See the troubleshooting section in the dashboard if API calls fail. Ensure `VITE_API_BASE_URL` is correct.

## Environment Variables

Worker:

```bash
SESSION_SECRET=...
VAULT_MASTER_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

## Available Scripts

```bash
npm run dev
npm run dev:worker
npm run build
npm run check:worker
npm run deploy
```
