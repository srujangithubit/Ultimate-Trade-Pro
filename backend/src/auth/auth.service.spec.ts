import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
const mockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
});

const mockJwtService = () => ({
  signAsync: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
    };
    return config[key];
  }),
});

type MockPrisma = ReturnType<typeof mockPrismaService>;
type MockJwt = ReturnType<typeof mockJwtService>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwt: MockJwt;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
    };

    it('should register a new user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid',
        email: registerDto.email,
        displayName: registerDto.displayName,
      });
      prisma.userSession.create.mockResolvedValue({});
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            displayName: registerDto.displayName,
          }),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should hash the password before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid',
        email: registerDto.email,
      });
      prisma.userSession.create.mockResolvedValue({});
      jwt.signAsync.mockResolvedValueOnce('at').mockResolvedValueOnce('rt');

      await service.register(registerDto);

      const createdData = prisma.user.create.mock.calls[0][0].data;
      expect(createdData.passwordHash).not.toBe(registerDto.password);
      // bcrypt hashes start with $2b$
      expect(createdData.passwordHash).toMatch(/^\$2[aby]\$/);
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };
    let passwordHash: string;

    beforeEach(async () => {
      passwordHash = await bcrypt.hash(loginDto.password, 10);
    });

    it('should return tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        email: loginDto.email,
        passwordHash,
      });
      prisma.userSession.create.mockResolvedValue({});
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw ForbiddenException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        email: loginDto.email,
        passwordHash: await bcrypt.hash('different-password', 10),
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------
  describe('refreshToken', () => {
    it('should issue new tokens for a valid refresh token', async () => {
      const rtPlain = 'refresh-token-plain';
      const rtHash = await bcrypt.hash(rtPlain, 10);

      prisma.userSession.findFirst.mockResolvedValue({
        refreshTokenHash: rtHash,
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        email: 'test@example.com',
      });
      prisma.userSession.create.mockResolvedValue({});
      jwt.signAsync
        .mockResolvedValueOnce('new-at')
        .mockResolvedValueOnce('new-rt');

      const result = await service.refreshToken('user-uuid', rtPlain);

      expect(result).toEqual({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      });
    });

    it('should throw ForbiddenException if no session found', async () => {
      prisma.userSession.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshToken('user-uuid', 'bad-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if refresh token does not match', async () => {
      prisma.userSession.findFirst.mockResolvedValue({
        refreshTokenHash: await bcrypt.hash('correct-token', 10),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        service.refreshToken('user-uuid', 'wrong-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if refresh token is expired', async () => {
      const rtPlain = 'refresh-token-plain';
      const rtHash = await bcrypt.hash(rtPlain, 10);

      prisma.userSession.findFirst.mockResolvedValue({
        refreshTokenHash: rtHash,
        expiresAt: new Date(Date.now() - 86400000), // yesterday — expired
      });

      await expect(service.refreshToken('user-uuid', rtPlain)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // signTokens
  // -------------------------------------------------------------------------
  describe('signTokens', () => {
    it('should call jwt.signAsync twice with correct payloads', async () => {
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.signTokens('user-uuid', 'test@example.com');

      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', email: 'test@example.com' },
        expect.objectContaining({
          secret: 'test-jwt-secret',
          expiresIn: '15m',
        }),
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', email: 'test@example.com' },
        expect.objectContaining({
          secret: 'test-jwt-refresh-secret',
          expiresIn: '7d',
        }),
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });
});
