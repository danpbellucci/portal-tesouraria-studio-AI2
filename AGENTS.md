# Elo Treasury Compass - Portal Tesouraria EloPar

## Architecture rules
- The portal lives in `src/portal/` and is rendered client-only from `src/routes/index.tsx`; its in-app module navigation is internal state, not TanStack routes — keeps the legacy single-screen app intact.
- `src/portal/backend/` holds the same Express route/service code as the local server; in the browser it runs through `backend/app.ts` (`localFetch`) and the shims in `backend/shims/` (express, fs→IndexedDB, path, crypto, multer) — so every API call keeps the exact REST path used by the local Express backend.
- To run on a local Express server, swap the `../shims/*` imports back to the Node modules and point `ApiClient` at real `fetch` — the routes need no other change.
- Pure business rules (e.g. `services/approvals.logic.ts`) stay framework-free and are covered by tests in `src/test/`.
