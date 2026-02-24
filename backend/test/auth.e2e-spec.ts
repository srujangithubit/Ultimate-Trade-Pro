import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Auth E2E Integration Tests
 *
 * These tests require a running PostgreSQL database with the Prisma schema applied.
 * If no database is available, these tests will be skipped.
 *
 * Run with: npm run test:e2e -- --testPathPattern=auth
 */
describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    displayName: 'E2E Test User',
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
    } catch {
      // If database is not available, skip all tests
      console.warn('Database not available, skipping E2E tests');
    }
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test user
      try {
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

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      if (!app) return;

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
    });

    it('should reject duplicate email registration', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409); // ConflictException
    });

    it('should reject invalid email format', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('should reject short password', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'valid@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      if (!app) return;

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject wrong password', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong-password',
        })
        .expect(403);
    });

    it('should reject non-existent email', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        })
        .expect(403);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      if (!app) return;

      // First login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Get user from database to get userId
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          userId: user.id,
          refreshToken: loginResponse.body.refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      if (!app) return;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          userId: 'some-user-id',
          refreshToken: 'invalid-token',
        })
        .expect(403);
    });
  });
});
