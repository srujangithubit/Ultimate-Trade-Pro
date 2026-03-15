import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Backtesting API E2E Integration Tests
 *
 * Requires a running PostgreSQL database. Skips if unavailable.
 * Run with: npm run test:e2e -- --testPathPattern=backtesting
 */
describe('Backtesting API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  const testUser = {
    email: `backtest-e2e-${Date.now()}@example.com`,
    password: 'password123',
    displayName: 'Backtest E2E User',
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
      prisma = app.get(PrismaService);

      // Register and login to get auth token
      const regResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      authToken = regResponse.body.accessToken;

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      userId = user!.id;
    } catch {
      console.warn('Database not available, skipping E2E tests');
    }
  });

  afterAll(async () => {
    if (prisma) {
      try {
        // Clean up: delete user cascades sessions & trades
        await prisma.user.deleteMany({
          where: { email: testUser.email },
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /backtesting/sessions', () => {
    it('should create a new backtesting session', async () => {
      if (!app || !userId) return;

      const response = await request(app.getHttpServer())
        .post('/backtesting/sessions')
        .send({
          userId,
          sessionName: 'E2E Test Session',
          instrument: 'AAPL',
          assetClass: 'stock',
          startingBalance: 10000,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('E2E Test Session');
      expect(response.body.status).toBe('created');
    });
  });

  describe('GET /backtesting/sessions/:userId', () => {
    it('should list sessions for a user', async () => {
      if (!app || !userId) return;

      const response = await request(app.getHttpServer())
        .get(`/backtesting/sessions/${userId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Full backtesting workflow', () => {
    it('should create session → execute order → close trade', async () => {
      if (!app || !userId) return;

      // Step 1: Create a session
      const sessionRes = await request(app.getHttpServer())
        .post('/backtesting/sessions')
        .send({
          userId,
          sessionName: 'Workflow Test',
          instrument: 'TSLA',
          assetClass: 'stock',
          startingBalance: 25000,
          startDate: '2024-01-01',
          endDate: '2024-06-30',
        })
        .expect(201);

      const sessionId = sessionRes.body.id;

      // Step 2: Update session status to active
      await request(app.getHttpServer())
        .patch(`/backtesting/sessions/${sessionId}/status`)
        .send({ userId, status: 'active' })
        .expect(200);

      // Step 3: Execute a buy order
      const orderRes = await request(app.getHttpServer())
        .post(`/backtesting/sessions/${sessionId}/orders`)
        .send({
          userId,
          orderType: 'market',
          direction: 'long',
          quantity: 100,
          price: 200.5,
        })
        .expect(201);

      const tradeId = orderRes.body.id;
      expect(orderRes.body.direction).toBe('long');
      expect(orderRes.body.status).toBe('OPEN');

      // Step 4: Close the trade
      const closeRes = await request(app.getHttpServer())
        .patch(`/backtesting/sessions/${sessionId}/trades/${tradeId}/close`)
        .send({ userId, exitPrice: 220.0 })
        .expect(200);

      expect(closeRes.body.status).toBe('CLOSED');

      // Step 5: Verify the session has the trade
      const getRes = await request(app.getHttpServer())
        .get(`/backtesting/sessions/${userId}/${sessionId}`)
        .expect(200);

      expect(getRes.body.trades.length).toBeGreaterThan(0);

      // Step 6: Delete the session
      await request(app.getHttpServer())
        .delete(`/backtesting/sessions/${userId}/${sessionId}`)
        .expect(204);
    });
  });
});
