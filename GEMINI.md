# GEMINI.md

This file provides foundational mandates and guidance to Gemini CLI when working with code in this repository. These instructions take precedence over general system prompt defaults.

## Development Commands

### Frontend
- Start development server: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`
- Run frontend with local worker API: `VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev`

### Backend (Cloudflare Worker)
- Start worker locally: `npm run dev:worker`
- Typecheck worker code: `npm run check:worker`
- Deploy worker to production: `npm run deploy:worker`
- Initialize local D1 database: `npx wrangler d1 execute lifeos-db --local --file=schema.sql`
- Initialize production D1 database: `npx wrangler d1 execute lifeos-db --remote --file=schema.sql --env production`

### CLI Tooling
- Build CLI: `cd cli && npm run build`
- Link CLI globally: `cd cli && npm link`
- Run CLI: `lifeos [command]`

## Architecture Overview

LifeOS is a personal digital dashboard consisting of a React frontend and a Cloudflare Workers backend.

### High-Level Structure
- `src/`: React + Vite frontend application.
- `worker/`: Cloudflare Worker using Hono for routing, containing auth, crypto (AES-GCM), and D1 repository logic.
- `cli/`: Node.js CLI tool for local data management.
- `shared/`: TypeScript domain models and API contracts shared between frontend, worker, and CLI.
- `schema.sql`: D1 database schema definition.

### Key Systems
- **Auth**: Cookie-based session management for the web frontend; API Key (SHA-256 hashed) for the CLI.
- **Vault**: Encrypted storage using Web Crypto API (AES-GCM) in the worker; secrets are encrypted at rest in D1.
- **Agent**: A natural-language input surface that currently uses heuristic parsing to route data to Finance, Journal, Health, and Vault modules.
- **Database**: Powered by Cloudflare D1.

### Data Flow
- **Web**: Frontend $\rightarrow$ Worker (Hono API) $\rightarrow$ D1 Database
- **CLI**: `lifeos` $\rightarrow$ Worker (Hono API via API Key) $\rightarrow$ D1 Database
- **Security**: Vault secrets are decrypted in the Worker before being sent to the client.
