# Development Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Caching |
| Git | 2.30+ | Version control |

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/trading-platform.git
cd trading-platform
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### 3. Frontend Setup
```bash
cd trading-platform-frontend
cp .env.example .env.local
npm install
npm run dev
```

### 4. Database Setup
```bash
# Create the database
createdb trading_platform

# Run migrations
psql -d trading_platform -f database/schema/000_migration_system.sql
psql -d trading_platform -f database/schema/001_initial_schema.sql
psql -d trading_platform -f database/schema/002_indexes.sql

# Seed data (optional)
psql -d trading_platform -f database/seeds/seed.sql
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/trading_platform
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=15m
REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG....
POLYGON_API_KEY=...
AWS_S3_BUCKET=trading-platform-dev
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

## Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## Common Issues

| Problem | Solution |
|---------|----------|
| Prisma generate fails | Run `npm install @prisma/client` |
| DB connection refused | Ensure PostgreSQL is running on port 5432 |
| Port 3000 in use | Set `PORT=3001` in .env |
| TimescaleDB not found | Install the TimescaleDB extension for PostgreSQL |

---

# Contributing Guide

## Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the code style guide
4. Write tests for new functionality
5. Run the full test suite: `npm test`
6. Commit with conventional commit messages
7. Push and open a Pull Request

## Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add playbook versioning
fix: correct P&L calculation for short trades
docs: update API authentication guide
test: add backtesting session unit tests
refactor: extract trade validation logic
chore: update dependencies
```

## Pull Request Process
1. Fill in the PR template with description and testing notes
2. Link related issues
3. Ensure CI passes (lint, tests, build)
4. Request review from at least one team member
5. Address review feedback
6. Squash and merge after approval

## Branch Naming
- `feature/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation
- `refactor/` — Code refactoring
- `test/` — Test additions

## Code Review Checklist
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] API docs updated if endpoints changed
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Error handling is comprehensive
- [ ] Database migrations are reversible

---

# Code Style Guide

## TypeScript / NestJS

### General Rules
- Use **TypeScript strict mode**
- Prefer `const` over `let`, never use `var`
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces
- Use **UPPER_SNAKE_CASE** for constants
- Maximum line length: **100 characters**
- Use **single quotes** for strings
- Always use **trailing commas**
- Use **async/await** over raw Promises

### NestJS Conventions
```typescript
// Controllers: thin, delegate to services
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: ListTradesDto) {
    return this.tradesService.findAll(query);
  }
}

// Services: business logic lives here
@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListTradesDto) {
    // Implementation
  }
}

// DTOs: validate all input
export class CreateTradeDto {
  @IsString()
  @IsNotEmpty()
  instrument: string;

  @IsEnum(TradeDirection)
  direction: TradeDirection;

  @IsNumber()
  @Min(0)
  entryPrice: number;
}
```

### File Naming
- `kebab-case` for file names: `trade-journal.service.ts`
- One class per file
- Suffix files with type: `.controller.ts`, `.service.ts`, `.module.ts`, `.dto.ts`, `.guard.ts`

### Error Handling
```typescript
// Use NestJS built-in exceptions
throw new NotFoundException('Trade not found');
throw new ForbiddenException('Credentials incorrect');
throw new BadRequestException('Invalid date range');
```

## Frontend (React / Next.js)

### Component Structure
```tsx
// Functional components with TypeScript props
interface TradeCardProps {
  trade: Trade;
  onDelete: (id: string) => void;
}

export function TradeCard({ trade, onDelete }: TradeCardProps) {
  return (
    <div className="trade-card">
      {/* Component content */}
    </div>
  );
}
```

### Naming Conventions
- **PascalCase** for components: `TradeCard.tsx`
- **camelCase** for hooks: `useTradeData.ts`
- **camelCase** for utilities: `formatCurrency.ts`

## Formatting
- Use **Prettier** with the project `.prettierrc` config
- Run `npm run lint` before committing
- ESLint config is in `eslint.config.mjs`
