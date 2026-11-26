# NextGen Live (Working Title)

An all-in-one live streaming platform foundation built with React, TypeScript, Vite, Tailwind, Fastify, and Supabase. Product name/logo are configurable.

> **Status:** Active development foundation. This repository contains a real, buildable codebase scaffold with core flows implemented; some advanced production features are partially implemented or blocked by external service configuration. See `docs/STATUS_REPORT.md`.

## What is included

- **Web app** (`apps/web`): React + Vite + TS + Tailwind + Framer Motion + Lucide, premium neobrutalism design system, landing/auth/dashboard/room/settings/admin/docs pages.
- **API server** (`apps/server`): Fastify + TS modular routes for health, rooms, OBS config validation, admin overview.
- **Shared package** (`packages/shared`): shared types/constants.
- **Supabase migrations** (`supabase/migrations`): initial schema, indexes, baseline RLS policies, auth profile bootstrap trigger.
- **Docs**: status report, deployment notes, env vars.

## Product rules

- All app features are intended to be free. **No paywall, no subscription, no locked features**.
- Free app access does **not** mean unlimited infrastructure. External providers have quotas/limits.
- No paid services are activated automatically.

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons
- Backend: Node.js, TypeScript, Fastify
- Database/Auth/Realtime: Supabase (PostgreSQL, Auth, Realtime)
- Streaming: Official VDO.Ninja integration via iframe/SDK URL parameters (adapter layer in room page; extend with full SDK/postMessage controls as needed)
- OBS: Browser Source overlays concept + local OBS WebSocket validation endpoint; secure localhost-only default

## Quick start

### 1) Prerequisites

- Node.js 20+ (tested on Node 26 in Termux)
- pnpm
- Supabase project

### 2) Install

```bash
pnpm install
```

### 3) Configure environment

```bash
cp .env.example .env
# Fill in Supabase keys and URLs.
# For Vite, also expose VITE_* vars (root .env or app-specific env loading).
```

Minimum required for full auth/db functionality:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

### 4) Apply database migrations

Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor, or use Supabase CLI.

### 5) Run dev

```bash
pnpm dev
# web: http://localhost:5173
# server: http://localhost:4000
```

## Scripts

- `pnpm dev` - run web and server in parallel
- `pnpm dev:web` - web only
- `pnpm dev:server` - server only
- `pnpm build` - build all packages
- `pnpm typecheck` - TypeScript checks
- `pnpm test` - tests (Vitest; initial pass-through where not yet implemented)

## Security notes

- Never commit `.env` or service-role keys.
- Server validates Supabase JWTs for protected routes.
- Admin endpoints require admin role on server; Supabase RLS should be hardened before production.
- OBS WebSocket targets are restricted to localhost by default in validation endpoint.
- Room passwords are hashed with bcryptjs on the server.

## OBS integration

- **Browser Source**: use overlay routes/widgets (foundation present; expand with dedicated overlay routes).
- **OBS WebSocket**: configure local OBS WebSocket and connect from browser to localhost. Do not expose unauthenticated OBS websocket publicly.
- **WHIP/WHEP/RTMP**: only when compatible external media endpoint is configured.

## Testing

See `docs/STATUS_REPORT.md` for PASS/FAIL/BLOCKED/NOT IMPLEMENTED status.

## Deployment

- Frontend can deploy to static hosting (Vercel/Netlify/Cloudflare Pages) with env vars.
- Backend should deploy as a Node service (Render/Fly/Railway/etc. free tiers where available).
- Supabase handles Auth/Postgres/Realtime.
- Document and monitor external quotas (Supabase, hosting, TURN/bandwidth, VDO.Ninja/network conditions).

## Known limitations

- Full VDO.Ninja SDK postMessage control surface is not fully wrapped; room uses real VDO.Ninja iframe integration.
- Advanced studio compositing (true preview/program scene engine) requires additional browser media pipeline work.
- Cloud recording is not implemented; browser-local recording is provided where supported.
- Some admin/moderation flows require Supabase configuration and further RLS hardening.
- This Termux environment may not have run full install/build/tests during generation; verify in CI/local Node environment.
