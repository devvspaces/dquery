<img src="branding/dquery-logo-512.png" width="72" alt="DQuery logo" />

# DQuery

Domain name generator and **registrar price aggregator**: generate names with an LLM, check availability once at the registry, and compare first-year, renewal and 3-year prices across registrars (Namecheap, Spaceship, Cloudflare, GoDaddy, Porkbun, …).

| Path | Stack |
|---|---|
| `backend/` | NestJS 11, Drizzle (Postgres), Redis, BullMQ |
| `frontend/` | Next.js 16, React 19, Tailwind |

## Local development

Requirements: Node 24, pnpm 12, Postgres 16, Redis 7 (`backend/docker-compose.yml` starts both).

```bash
# backend
cd backend
cp .env.example .env            # fill in registrar keys you have
pnpm install
pnpm db:migrate
pnpm command prices:sync        # fill the TLD price catalog
pnpm start:dev                  # http://localhost:3001/api

# frontend
cd frontend
pnpm install
pnpm dev                        # http://localhost:3000
```

## Tests

```bash
# backend
pnpm lint:check && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e                   # needs Postgres + Redis

# frontend
pnpm typecheck && pnpm test && pnpm build
```

CI runs all of the above on every push and pull request to `master`
(`.github/workflows/backend.yml`, `.github/workflows/frontend.yml`).

## How pricing works

Availability comes from the registry, so it is checked **once** per domain (with failover between registrars). Prices come from a daily-synced **TLD price catalog** per registrar; only premium names and registrars without a price-list API (Cloudflare, GoDaddy) are priced live. See `backend/src/modules/registrars/` — adding a registrar means one provider file plus one line in `registrars.module.ts`.

## Deployment

- **Frontend** — Vercel (Git integration, root directory `frontend`, env `NEXT_PUBLIC_API_URL=https://api.dquery.bytechain.dev`).
- **Backend** — every green push to `master` builds `ghcr.io/devvspaces/dquery-backend:sha-<commit>` and deploys it over SSH
  (see the `image` / `deploy` jobs in `.github/workflows/backend.yml`).
  On the server, `/opt/domainq` holds `docker-compose.yml` (from `deploy/docker-compose.prod.yml`) and the production `.env`
  (never committed). The API runs on `127.0.0.1:3012` behind nginx (`deploy/nginx-api.dquery.conf`) and uses the host Postgres.
- Useful server commands (in `/opt/domainq`):
  - `docker compose logs -f api`
  - `docker compose exec api node dist/cli.js prices:sync`
  - Bull Board is not exposed publicly: `ssh -L 3012:127.0.0.1:3012 root@<server>` then open `http://localhost:3012/admin/queues`.
