# LifeOS

LifeOS is a personal digital life dashboard that consolidates finance logs, journal entries, health records, and a lightweight vault behind a single AI-style input surface.

The current repository contains:
- a React + Vite frontend
- a Cloudflare Workers + Hono backend
- a Node.js CLI tool for local data management
- a D1 schema and repository layer
- cookie-based session/auth with Google OAuth
- API Key (SHA-256 hashed) for CLI/External integrations
- encrypted vault storage using Web Crypto AES-GCM in the worker

## Status

Implemented now:
- **Responsive Dashboard UI**: Overview, Finance, Journal, Health, and Vault modules.
- **Natural-Language Agent**: Heuristic parsing (with OpenAI fallback) for finance, journal, health, and vault creation.
- **API Key Management**: Full CRUD for API keys in the Settings view for CLI access.
- **Global CLI Tool**: `lifeos` command-line tool for data listing and advanced vault management.
- **Advanced Vault CRUD**: Support for retrieval, raw file export/import, revocation, and updates via CLI.
- **Encryption**: AES-GCM encryption at rest in the worker with record-specific IVs.
- **Google OAuth**: Complete start + callback code exchange flow for secure authentication.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Vanilla CSS
- **Backend**: Cloudflare Workers, Hono
- **CLI**: Node.js, Commander.js, Axios, Chalk
- **Database**: Cloudflare D1
- **Security**: Web Crypto API (AES-GCM), SHA-256 Hashing for API Keys
- **Shared Contracts**: TypeScript models under `shared/`

## Project Structure

```text
cli/         Node.js CLI tool
src/         Frontend React app
worker/      Cloudflare Worker routes, auth, crypto, repository
shared/      Shared domain models and API contracts
docs/        Planning spec and UI reference
schema.sql   D1 schema
wrangler.toml Worker config
GEMINI.md    Gemini CLI foundational mandates
TODO.md      Progress and remaining work
```

## Local Development

### 1. General Setup
Install dependencies in the root:
```bash
npm install
```

### 2. Frontend & Backend
Start the worker locally:
```bash
npm run dev:worker
```

Start the frontend (pointing to the local worker):
```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

### 3. CLI Tooling
Build and link the `lifeos` command globally:
```bash
cd cli
npm install
npm run build
npm link
```

Configure your CLI with an API Key and Base URL:
```bash
lifeos config set key <your-api-key>
lifeos config set url http://127.0.0.1:8787
```

## CLI Usage

### Data Listing
```bash
lifeos ls finance
lifeos ls journals
lifeos ls health
lifeos ls vault
```

### Vault Management
```bash
lifeos vault get <id>                          # View a secret
lifeos vault export <id> <filename>            # Save secret to raw text file
lifeos vault import <site> <user> <filename>   # Create new entry from file
lifeos vault update <id> <site> <user> <file>  # Update existing entry
lifeos vault revoke <id>                       # Delete a secret
```

## D1 Setup

Initialize the database locally:
```bash
npx wrangler d1 execute lifeos-db --local --file=schema.sql
```

Initialize the production schema:
```bash
npx wrangler d1 execute lifeos-db --remote --file=schema.sql --env production
```

## Cloudflare Deployment

### 1. Deploy the Worker
Update [wrangler.toml](wrangler.toml) with your `database_id`, then set secrets:
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

### 2. Deploy Frontend
Set the `VITE_API_BASE_URL` environment variable in the Cloudflare Pages Dashboard.

## Environment Variables

Worker (`.dev.vars` for local):
```bash
SESSION_SECRET=...
VAULT_MASTER_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```
