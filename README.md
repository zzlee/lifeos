# LifeOS

LifeOS is a personal digital life dashboard that consolidates finance logs, journal entries, health records, and a lightweight vault behind a single AI-style input surface.

The current repository contains:
- a React + Vite frontend inspired by [docs/sample.html](/home/zzlee/lifeos/docs/sample.html)
- a Cloudflare Workers + Hono backend
- a D1 schema and repository layer
- session/auth scaffolding with demo login
- encrypted vault storage using Web Crypto AES-GCM in the worker

## Status

Implemented now:
- Responsive dashboard UI for `Overview`, `Finance`, `Journal`, `Health`, and `Vault`
- Natural-language style input for finance, journal, health, and vault creation
- D1-backed reads and writes for dashboard data
- Vault encryption at rest in the worker
- Secret retrieval API for copy-to-clipboard flows
- Cookie-based demo session handling
- Google OAuth route skeleton

Not finished yet:
- Real Google OAuth token exchange and callback completion
- OpenAI-backed tool calling
- CLI commands
- Comprehensive tests

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

For Cloudflare-managed environments, update `wrangler.toml` with the real `database_id` and run the corresponding Wrangler D1 commands in your target environment.

## Environment Variables

Frontend:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Worker:

```bash
SESSION_SECRET=replace-this-in-real-env
VAULT_MASTER_KEY=replace-this-in-real-env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
OPENAI_API_KEY=...
```

Notes:
- `SESSION_SECRET` currently falls back to a development default if unset. That is acceptable for local work, not for production.
- `VAULT_MASTER_KEY` should be treated as sensitive and environment-specific.
- Google OAuth routes are scaffolded, but callback token exchange is not implemented yet.

## Available Scripts

```bash
npm run dev
npm run dev:worker
npm run build
npm run check:worker
npm run preview
```

## How to Test

### 1. Build and typecheck

```bash
npm run build
npm run check:worker
```

### 2. Session and auth

- Open the app and confirm the sidebar user profile renders.
- Click `Demo Login` to create a signed cookie session.
- Click `Logout` to clear the session cookie.
- Call `GET /api/session` and verify the response contains `authenticated`, `provider`, `user`, and `googleAuthEnabled`.

### 3. Agent and dashboard flows

Try these prompts in the main input:

- `剛花150吃午餐`
- `血壓120/80`
- `今天完成了 LifeOS worker 串接`
- `新增 GitHub 帳號 dev 密碼 xyz12345`

Expected behavior:
- Finance receives a new expense
- Health receives a new reading
- Journal receives a new entry
- Vault receives a new site credential

### 4. Vault encryption flow

- Add a vault record through the agent input.
- Click the copy button in the Vault page.
- The frontend should call `GET /api/vault/:id/secret`.
- In D1, `vault_items` should store encrypted content in `secret_ciphertext` and `secret_iv`, not plain text.

### 5. Google OAuth skeleton

- `GET /api/auth/google/start` should redirect only when Google env vars are configured.
- `GET /api/auth/google/callback` currently returns `501` by design until token exchange is implemented.

## API Overview

Current worker endpoints:

- `GET /api/health`
- `GET /api/session`
- `POST /api/auth/demo-login`
- `POST /api/auth/logout`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/dashboard`
- `POST /api/agent`
- `GET /api/vault/:id/secret`

## Current Limitations

- AI behavior is still heuristic parsing, not OpenAI-backed tool use.
- Google OAuth is not fully implemented.
- Demo data seeding currently happens automatically for a new user path in local/dev usage.
- Session handling is usable for development, but still needs hardening for production.
- No automated tests are included yet.

## Next Steps

The current highest-priority remaining work is:

1. Complete Google OAuth callback token exchange and user creation/login.
2. Replace heuristic agent parsing with OpenAI tool calling.
3. Add proper test coverage.
4. Add CLI commands and deployment documentation.

For the detailed running backlog, see [TODO.md](/home/zzlee/lifeos/TODO.md).
