# dquery

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
