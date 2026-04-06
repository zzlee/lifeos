# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture Overview

LifeOS is a personal digital dashboard consisting of a React frontend and a Cloudflare Workers backend.

### High-Level Structure
- `src/`: React + Vite frontend application.
- `worker/`: Cloudflare Worker using Hono for routing, containing auth, crypto (AES-GCM), and D1 repository logic.
- `shared/`: TypeScript domain models and API contracts shared between frontend and worker.
- `schema.sql`: D1 database schema definition.

### Key Systems
- **Auth**: Cookie-based session management with support for Demo Login and Google OAuth.
- **Vault**: Encrypted storage using Web Crypto API (AES-GCM) in the worker; secrets are encrypted at rest in D1.
- **Agent**: A natural-language input surface that currently uses heuristic parsing to route data to Finance, Journal, Health, and Vault modules.
- **Database**: Powered by Cloudflare D1.

### Data Flow
Frontend $\rightarrow$ Worker (Hono API) $\rightarrow$ D1 Database
Vault secrets are decrypted in the Worker before being sent to the frontend via `GET /api/vault/:id/secret`.
