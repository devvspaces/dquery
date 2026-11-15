# DQuery Backend API

A powerful NestJS backend for domain name generation, availability checking, and management across multiple registrars.

## Features

- 🔐 **Authentication**: OAuth integration (Google, GitHub) with JWT
- 💳 **Credits System**: Track user credits and transactions
- 🤖 **LLM-based Domain Generation**: Creative domain suggestions using OpenAI/Claude
- 🔍 **Multi-Registrar Domain Checking**: Check availability across GoDaddy, Namecheap, Cloudflare, Spaceship
- 📊 **Advanced Analytics**: Admin dashboards and usage tracking
- ⚡ **Queue System**: BullMQ for scalable domain checking
- 💰 **Payments**: Stripe integration for credit purchases
- 🔖 **User Features**: Bookmarks, saved searches, export to CSV

## Tech Stack

- **Framework**: NestJS 11+
- **Database**: PostgreSQL with Drizzle ORM
- **Cache/Queue**: Redis + BullMQ
- **Authentication**: Passport.js (JWT, OAuth)
- **Payments**: Stripe
- **LLM**: OpenAI / Anthropic Claude
- **Validation**: class-validator, Zod

## Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/                 # Authentication module
│   │   │   ├── strategies/       # JWT, Google, GitHub strategies
│   │   │   ├── dto/              # Auth DTOs
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── credits/              # Credits & transactions (TODO)
│   │   ├── domains/              # Domain generation & checking (TODO)
│   │   ├── bookmarks/            # User bookmarks (TODO)
│   │   ├── searches/             # Saved searches (TODO)
│   │   ├── payments/             # Stripe integration (TODO)
│   │   └── admin/                # Admin analytics (TODO)
│   ├── database/
│   │   ├── schema/               # Drizzle schemas
│   │   │   ├── users.schema.ts
│   │   │   ├── credits.schema.ts
│   │   │   ├── bookmarks.schema.ts
│   │   │   ├── searches.schema.ts
│   │   │   ├── domains.schema.ts
│   │   │   ├── payments.schema.ts
│   │   │   └── analytics.schema.ts
│   │   ├── migrations/           # Database migrations
│   │   ├── database.service.ts
│   │   └── database.module.ts
│   ├── redis/
│   │   ├── redis.service.ts      # Redis client wrapper
│   │   └── redis.module.ts
│   ├── common/
│   │   ├── decorators/           # Custom decorators
│   │   ├── guards/               # Auth guards
│   │   ├── filters/              # Exception filters
│   │   ├── interceptors/         # Logging, transform interceptors
│   │   └── dto/                  # Shared DTOs
│   ├── config/                   # Configuration files
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml            # PostgreSQL + Redis
├── drizzle.config.ts             # Drizzle ORM config
├── .env                          # Environment variables
└── package.json
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+
- Redis 7+
- OAuth credentials (Google, GitHub)
- API keys (OpenAI/Anthropic, Registrars, Stripe)

## Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables to configure:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `JWT_SECRET`: Secret for JWT signing
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: GitHub OAuth
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: LLM provider
- Registrar API keys (GoDaddy, Namecheap, Cloudflare, Spaceship)
- `STRIPE_SECRET_KEY`: Stripe payments

### 3. Start Database Services

#### Option A: Using Docker Compose

```bash
docker-compose up -d
```

This starts:

- PostgreSQL on port 5432
- Redis on port 6379

#### Option B: Use Existing PostgreSQL and Redis

Update your `.env` with connection details:

```env
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

### 4. Run Database Migrations

```bash
# Generate migrations from schema
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations manually
npm run db:migrate
```

### 5. Start the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3001/api`

## Database Schema

### Users

- Stores OAuth user profiles (Google, GitHub, etc.)
- Includes provider info and avatar

### Credits

- Tracks user credit balances
- Includes total purchased and used credits

### Credit Transactions

- Detailed transaction log
- Types: purchase, deduction, refund, bonus

### Bookmarks

- User-saved domains with price snapshots

### Saved Searches

- Stored search queries and parameters

### Domain Cache

- Caches domain availability and pricing
- TTL-based expiration

### Purchases

- Payment records (Stripe, crypto)

### Analytics Tables

- API usage logs
- Registrar API performance
- LLM token usage tracking

## API Endpoints

### Authentication

```
GET  /api/auth/google           # Initiate Google OAuth
GET  /api/auth/google/callback  # Google OAuth callback
GET  /api/auth/github           # Initiate GitHub OAuth
GET  /api/auth/github/callback  # GitHub OAuth callback
GET  /api/auth/me               # Get current user (requires JWT)
POST /api/auth/logout           # Logout (public)
```

### Health Check

```
GET  /api                       # Welcome message
GET  /api/health                # Health check
```

## Development

### Available Scripts

```bash
npm run start          # Start application
npm run start:dev      # Start in watch mode
npm run start:debug    # Start in debug mode
npm run build          # Build for production
npm run lint           # Lint code
npm run format         # Format code with Prettier

# Database
npm run db:generate    # Generate migrations
npm run db:migrate     # Run migrations
npm run db:push        # Push schema to DB
npm run db:studio      # Open Drizzle Studio
```

### Testing OAuth Locally

1. Set up OAuth applications:
   - **Google**: https://console.cloud.google.com/
   - **GitHub**: https://github.com/settings/developers

2. Configure callback URLs:
   - Google: `http://localhost:3001/api/auth/google/callback`
   - GitHub: `http://localhost:3001/api/auth/github/callback`

3. Update `.env` with credentials

4. Test flow:
   ```
   Browser → http://localhost:3001/api/auth/google
   → OAuth consent screen
   → Redirects to frontend with token
   ```

## Architecture Decisions

### Why Drizzle ORM?

- Type-safe SQL queries
- Lightweight and performant
- Easy migrations
- Great TypeScript support

### Why BullMQ?

- Reliable job queue system
- Built on Redis
- Job retry and prioritization
- Scales horizontally

### Why JWT + OAuth?

- Stateless authentication
- Works with mobile apps
- Industry standard
- Easy to implement

### Credits System Design

- **2 credits** per domain generation
- **0.1 credits** per domain check
- **0.05 credits** per registrar API call
- **0.5 credits** per batch load

New users get **25 free credits**.

## Roadmap

### ✅ Phase 1: Core Infrastructure (COMPLETED)

- [x] NestJS setup
- [x] Database schema with Drizzle
- [x] Redis configuration
- [x] Auth module (JWT + OAuth)
- [x] Global guards, filters, interceptors

### 🚧 Phase 2: Credits & Domain Services (IN PROGRESS)

- [ ] Credits module
- [ ] LLM integration service
- [ ] Registrar provider interfaces
- [ ] Domain generation endpoint
- [ ] Domain checking endpoint

### 📋 Phase 3: Queue System & Features

- [ ] BullMQ queue setup
- [ ] Batch processing
- [ ] Bookmarks module
- [ ] Saved searches module

### 📋 Phase 4: Payments & Admin

- [ ] Stripe integration
- [ ] Admin analytics endpoints
- [ ] Usage tracking

### 📋 Phase 5: Optimization

- [ ] Rate limiting
- [ ] Caching strategies
- [ ] Performance optimization
- [ ] Security hardening

## Environment Variables Reference

| Variable               | Description                          | Required |
| ---------------------- | ------------------------------------ | -------- |
| `NODE_ENV`             | Environment (development/production) | Yes      |
| `PORT`                 | API port (default: 3001)             | Yes      |
| `DATABASE_URL`         | PostgreSQL connection string         | Yes      |
| `REDIS_HOST`           | Redis hostname                       | Yes      |
| `REDIS_PORT`           | Redis port                           | Yes      |
| `JWT_SECRET`           | JWT signing secret                   | Yes      |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID               | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret                  | Optional |
| `GITHUB_CLIENT_ID`     | GitHub OAuth client ID               | Optional |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret                  | Optional |
| `OPENAI_API_KEY`       | OpenAI API key                       | Optional |
| `ANTHROPIC_API_KEY`    | Anthropic API key                    | Optional |
| `STRIPE_SECRET_KEY`    | Stripe secret key                    | Optional |
| `GODADDY_API_KEY`      | GoDaddy API key                      | Optional |
| `NAMECHEAP_API_KEY`    | Namecheap API key                    | Optional |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token                 | Optional |
| `SPACESHIP_API_KEY`    | Spaceship API key                    | Optional |

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Create Pull Request

## License

UNLICENSED - Private project

## Support

For issues or questions, contact the development team or create an issue in the repository.
