# LifeOS TODO

## Current Progress

### Completed Foundation
- Initialized the repository and created a clean Git history for the frontend and backend scaffold.
- Built a React + Vite + TypeScript frontend based on `docs/sample.html`.
- Added responsive dashboard views for `Overview`, `Finance`, `Journal`, `Health`, and `Vault`.
- Added a production-ready frontend data layer.

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
- Added API routes for session, logout, and Google OAuth.
- Added API Key support for CLI and external integration.

### Completed Google OAuth Flow
- Implemented Google OAuth start redirect with signed `state`.
- Implemented Google OAuth callback token exchange against Google token endpoint.
- Implemented Google userinfo fetch and LifeOS session cookie issuance after successful login.
- Added direct Google Login entry in the frontend sidebar.

### Verified
- `npm run build`
- `npm run check:worker`

## In Progress / Next Priority

### Auth Hardening
- Add CSRF/state validation for OAuth callback.
- Add session expiration/refresh strategy.

## Remaining Major Work

### OpenAI Agent Integration
- Replace heuristic parser-only flow with real OpenAI function/tool calling.
- Add structured tool definitions for finance/journal/health/vault writes.
- Add server-side validation and error handling for AI-produced actions.

### Vault Improvements
- Add create/edit/delete flows beyond current natural-language create and copy secret.
- Add support for per-user encryption key strategy instead of one worker-level master key.

### Data Model / Persistence Improvements
- Add migrations strategy instead of single `schema.sql` only.
- Add pagination / query filters for larger datasets.

### Frontend Product Work
- Add explicit forms/modals for each module, not only AI input.
- Add loading/error states for API requests.
- Add empty states and better success/error feedback.

### CLI Work
- Implement `lifeos auth`
- Implement `lifeos log "<text>"`
- Implement `lifeos ls <module>`

### Testing
- Add unit tests for:
  - agent parsing
  - auth token signing/verification
  - vault encryption/decryption
- Add integration tests for worker API routes.
- Add end-to-end UI tests for core dashboard flows.
