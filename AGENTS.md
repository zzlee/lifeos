# AGENTS.md

## Fast start (verified commands)
- Install deps at repo root: `npm install`
- Run frontend: `npm run dev`
- Run worker locally: `npm run dev:worker`
- Build frontend + typecheck app TS project refs: `npm run build`
- Typecheck worker only: `npm run check:worker`
- Deploy worker (production env): `npm run deploy` — usually unnecessary, see Deployment below.

## Command gotchas
- There is no root `test`, `lint`, or `deploy:worker` script in `package.json`; use the scripts above.
- CLI build/link is available from root as `npm run cli:build` (runs `cli` build and `npm link`).
- `opencode.json` expects a global `lifeos` command for MCP (`lifeos mcp`), so CLI must be built/linked before MCP works.

## Deployment (Cloudflare auto-deploy)
- Production deploys happen automatically on push to `master` via **Cloudflare Workers Builds** (Git integration configured in the Cloudflare dashboard, not in this repo). A push is typically live in ~1–2 minutes.
- `.github/workflows/ci.yml` only runs tests (`check:worker` + unit tests + Playwright); it does **not** deploy. There is intentionally no deploy step in CI/CD.
- Do **not** run `npm run deploy` as part of normal changes — pushing already deploys, and a manual deploy just creates a redundant version.

## MCP server
- Endpoint: `/api/mcp` (also `/api/mcp/sse`, `/api/mcp/messages`); implemented in `worker/mcp.ts`, mounted in `worker/index.ts`. Transport is Streamable HTTP (stateless).
- Auth is **required**: a session cookie or an API key (`Authorization: Bearer <key>`). Create keys in the UI (Settings → API Keys, backed by `POST /api/auth/keys`).
- For clients that cannot send headers (e.g. the Gemini web app), the same API key may be embedded in the URL as `/api/mcp?token=<key>` or `/api/mcp/<key>`; it is stripped before the MCP handler runs.
- The `X-LifeOS-User-Id/Email/Name` headers are **not** trusted unless `ALLOW_HEADER_AUTH=true` (local dev/test only) — otherwise they are a forgeable auth bypass.
- The `line_*` tools read/delete an **instance-wide** archive (`line_messages` has no `user_id`), not a per-user one.

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
