# AGENTS.md

## Fast start (verified commands)
- Install deps at repo root: `npm install`
- Run frontend: `npm run dev`
- Run worker locally: `npm run dev:worker`
- Build frontend + typecheck app TS project refs: `npm run build`
- Typecheck worker only: `npm run check:worker`
- Deploy worker (production env): `npm run deploy`

## Command gotchas
- There is no root `test`, `lint`, or `deploy:worker` script in `package.json`; use the scripts above.
- CLI build/link is available from root as `npm run cli:build` (runs `cli` build and `npm link`).
- `opencode.json` expects a global `lifeos` command for MCP (`lifeos mcp`), so CLI must be built/linked before MCP works.

## Environment and local data
- Worker uses D1 binding `DB`; initialize local DB with: `npx wrangler d1 execute lifeos-db --local --file=schema.sql`.
- Frontend API base is read from `VITE_API_BASE_URL` in `src/lib/api.ts`.
- `isApiConfigured()` currently accepts only empty or `https` base URLs; `http://127.0.0.1:8787` will trigger the config error screen in `src/App.tsx`.

## Repo map (where to edit)
- `src/`: React frontend (single-page dashboard UI).
- `worker/index.ts`: Hono API entrypoint; all major REST routes are defined here.
- `worker/repository.ts`: D1 read/write logic used by route handlers.
- `worker/auth.ts` + `worker/crypto.ts`: session/OAuth flow and vault AES-GCM encryption.
- `shared/`: shared TS contracts/domain types used across frontend + worker + CLI.
- `cli/src/index.ts`: `lifeos` CLI commands (including `mcp`, auth, finance/journal/health/vault operations).

## Runtime behavior worth knowing
- Worker serves SPA assets via Wrangler `assets = { directory = "./dist" }` and falls back to `index.html` in `app.notFound` for non-API paths.
- API routes require session auth for dashboard and CRUD endpoints; API keys are managed via `/api/auth/keys` and hashed before storage.
- Vault secrets are encrypted at rest in D1 (`vault_items.secret_ciphertext` + IV) and decrypted only in worker endpoints.
