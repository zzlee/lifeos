# LifeOS TODO

## Current Progress

### Completed Foundation
- Initialized the repository and created a clean Git history for the frontend and backend scaffold.
- Built a React + Vite + TypeScript frontend based on `docs/sample.html`.
- Added responsive dashboard views for `Overview`, `Finance`, `Journal`, `Health`, and `Vault`.
- Added a mock-capable frontend data layer with API fallback behavior.

### Completed Backend Scaffold
- Added a Cloudflare Workers + Hono backend scaffold.
- Added shared contracts and domain models under `shared/` for frontend/worker reuse.
- Added `wrangler.toml`, `schema.sql`, and worker TypeScript config.
- Added D1-backed read/write flow for:
  - Finance records
  - Journal entries
  - Health entries
  - Vault items

### Completed Vault Security Flow
- Added AES-GCM encryption for vault secrets in Workers.
- Stored encrypted vault data in D1 using:
  - `secret_ciphertext`
  - `secret_iv`
  - `secret_preview`
- Added secret retrieval endpoint for copy-to-clipboard behavior.
- Added natural-language parsing for vault creation commands.

### Completed Session/Auth Skeleton
- Replaced hard-coded user access with session-based user resolution.
- Added cookie-based signed session handling in Workers.
- Added API routes for:
  - `GET /api/session`
  - `POST /api/auth/demo-login`
  - `POST /api/auth/logout`
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
- Updated frontend to:
  - load session user
  - send cookie credentials
  - expose Demo Login / Logout actions

### Verified
- `npm run build`
- `npm run check:worker`

## In Progress / Next Priority

### Google OAuth Completion
- Implement real Google OAuth token exchange in `/api/auth/google/callback`.
- Validate `id_token` or fetch Google user info securely.
- Create/login the real user from Google identity.
- Issue LifeOS session cookie after successful Google auth.

### Auth Hardening
- Replace development fallback secrets with environment-required secrets.
- Add CSRF/state validation for OAuth callback.
- Add session expiration/refresh strategy.
- Decide whether to keep cookie session only, or also issue JWT for CLI/mobile use.

## Remaining Major Work

### OpenAI Agent Integration
- Replace heuristic parser-only flow with real OpenAI function/tool calling.
- Add structured tool definitions for finance/journal/health/vault writes.
- Add server-side validation and error handling for AI-produced actions.

### Vault Improvements
- Add create/edit/delete flows beyond current natural-language create and copy secret.
- Add secret reveal audit/guardrails if needed.
- Add support for per-user encryption key strategy instead of one worker-level master key.

### Data Model / Persistence Improvements
- Add migrations strategy instead of single `schema.sql` only.
- Revisit `health_daily` shape if multiple measurements per day are needed.
- Add pagination / query filters for larger datasets.
- Add seed/dev bootstrap flow more explicitly instead of implicit first-read seeding.

### Frontend Product Work
- Add explicit forms/modals for each module, not only AI input.
- Add loading/error states for API requests.
- Add empty states and better success/error feedback.
- Add session/auth UI for real Google login.

### CLI Work
- Implement `lifeos auth`
- Implement `lifeos log "<text>"`
- Implement `lifeos ls <module>`

### Deployment / Ops
- Add production/development environment variable documentation.
- Add local development instructions for Vite + Wrangler + D1.
- Add deploy scripts/workflow for Cloudflare Pages + Workers.
- Add README setup instructions.

### Testing
- Add unit tests for:
  - agent parsing
  - auth token signing/verification
  - vault encryption/decryption
- Add integration tests for worker API routes.
- Add end-to-end UI tests for core dashboard flows.

## Notes
- Current Google OAuth routes are scaffolded but not fully implemented.
- Current AI behavior is still rule-based parsing, not OpenAI-backed.
- Current session flow is usable for local/demo work but not production-ready.
