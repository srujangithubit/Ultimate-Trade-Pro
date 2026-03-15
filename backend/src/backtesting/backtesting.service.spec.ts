import { Test, TestingModule } from '@nestjs/testing';
import { BacktestingService } from './backtesting.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CandleLoaderService } from './replay/candle-loader.service';
import { REDIS_CLIENT } from '../trade-sync/redis.provider';

describe('BacktestingService', () => {
  let service: BacktestingService;
  let prisma: PrismaService;

  const mockPrisma = {
    backtestingSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    trade: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketDataCandle: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockCandleLoader = {
    loadForSession: jest.fn(),
    evictSession: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CandleLoaderService, useValue: mockCandleLoader },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<BacktestingService>(BacktestingService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createSession ─────────────────────────────────────────────────

  describe('createSession', () => {
    it('should create a new session', async () => {
      const dto = {
        sessionName: 'Test Session',
        instrument: 'AAPL',
        assetClass: 'stock' as const,
        startingBalance: 10000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const expectedResult = {
        id: 'session-1',
        userId: 'user-1',
        name: dto.sessionName,
        status: 'created',
        configuration: {
          instrument: dto.instrument,
          assetClass: dto.assetClass,
          startingBalance: dto.startingBalance,
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.backtestingSession.create.mockResolvedValue(expectedResult);

      const result = await service.createSession('user-1', dto);
      expect(result).toEqual(expectedResult);
      expect(mockPrisma.backtestingSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: dto.sessionName,
          accountId: null,
          status: 'created',
          configuration: {
            instrument: dto.instrument,
            assetClass: dto.assetClass,
            timeframe: '1h',
            timezone: 'UTC',
            startingBalance: dto.startingBalance,
            startDate: dto.startDate,
            endDate: dto.endDate,
          },
        },
      });
    });
  });

  // ─── getSession ────────────────────────────────────────────────────

  describe('getSession', () => {
    it('should return a session for the correct user', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        name: 'Test',
        status: 'created',
        trades: [],
        snapshots: [],
      };

      mockPrisma.backtestingSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.getSession('user-1', 'session-1');
      expect(result).toEqual(mockSession);
    });

    it('should throw NotFoundException if session not found', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if session belongs to another user', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
      });

      await expect(service.getSession('user-1', 'session-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── listSessions ──────────────────────────────────────────────────

  describe('listSessions', () => {
    it('should return sessions for a user', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', name: 'Session 1' },
        { id: 'session-2', userId: 'user-1', name: 'Session 2' },
      ];

      mockPrisma.backtestingSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.listSessions('user-1');
      expect(result).toEqual(mockSessions);
      expect(mockPrisma.backtestingSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: { trades: true },
      });
    });
  });

  // ─── executeOrder ──────────────────────────────────────────────────

  describe('executeOrder', () => {
    it('should create a trade for an active session', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        accountId: null,
        currentTime: new Date('2024-06-15'),
        configuration: { instrument: 'AAPL' },
        trades: [],
        snapshots: [],
      };

      const dto = {
        orderType: 'market' as const,
        direction: 'long' as const,
        quantity: 10,
        price: 150.5,
      };

      const expectedTrade = {
        id: 'trade-1',
        userId: 'user-1',
        symbol: 'AAPL',
        direction: 'long',
        status: 'OPEN',
      };

      mockPrisma.backtestingSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.trade.create.mockResolvedValue(expectedTrade);

      const result = await service.executeOrder('user-1', 'session-1', dto);
      expect(result).toEqual(expectedTrade);
    });

    it('should throw BadRequestException for completed session', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'completed',
        trades: [],
        snapshots: [],
      });

      await expect(
        service.executeOrder('user-1', 'session-1', {
          orderType: 'market',
          direction: 'long',
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-positive entry prices', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        accountId: null,
        configuration: { instrument: 'AAPL' },
        trades: [],
        snapshots: [],
      });

      await expect(
        service.executeOrder('user-1', 'session-1', {
          orderType: 'market',
          direction: 'long',
          quantity: 10,
          price: 0,
        }),
      ).rejects.toThrow(new BadRequestException('Invalid entry price'));
    });
  });

  // ─── closeTrade ────────────────────────────────────────────────────

  describe('closeTrade', () => {
    it('should close an open trade with PnL calculation', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        trades: [],
        snapshots: [],
      };

      const mockTrade = {
        id: 'trade-1',
        backtestSessionId: 'session-1',
        status: 'OPEN',
        direction: 'long',
        entryPrice: 100,
        quantity: 10,
        fees: 5,
      };

      const updatedTrade = {
        ...mockTrade,
        exitPrice: 110,
        pnlGross: 100,
        pnlNet: 95,
        status: 'CLOSED',
      };

      mockPrisma.backtestingSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.trade.findUnique.mockResolvedValue(mockTrade);
      mockPrisma.trade.update.mockResolvedValue(updatedTrade);

      const result = await service.closeTrade(
        'user-1',
        'session-1',
        'trade-1',
        110,
      );
      expect(result.status).toBe('CLOSED');
      expect(result.pnlGross).toBe(100);
      expect(result.pnlNet).toBe(95);
    });

    it('should throw NotFoundException if trade not in session', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        trades: [],
        snapshots: [],
      });

      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        backtestSessionId: 'other-session',
      });

      await expect(
        service.closeTrade('user-1', 'session-1', 'trade-1', 110),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if trade is not open', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        trades: [],
        snapshots: [],
      });

      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        backtestSessionId: 'session-1',
        status: 'CLOSED',
      });

      await expect(
        service.closeTrade('user-1', 'session-1', 'trade-1', 110),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-positive exit prices', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        trades: [],
        snapshots: [],
      });

      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        backtestSessionId: 'session-1',
        status: 'OPEN',
      });

      await expect(
        service.closeTrade('user-1', 'session-1', 'trade-1', 0),
      ).rejects.toThrow(new BadRequestException('Invalid exit price'));
    });
  });

  // ─── loadCandlesForSession ───────────────────────────────────────

  describe('loadCandlesForSession', () => {
    it('should paginate beyond 20k candles without truncation', async () => {
      const session = {
        configuration: {
          instrument: 'EURUSD',
          timeframe: '1h',
          timezone: 'UTC',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-12-31T23:59:59.000Z',
          startingBalance: 10000,
        },
      };

      const firstPage = Array.from({ length: 20000 }, (_v, i) => ({
        id: `candle-${i + 1}`,
        time: new Date(`2024-01-01T00:${String(i % 60).padStart(2, '0')}:00.000Z`),
        open: 1.1,
        high: 1.2,
        low: 1.0,
        close: 1.15,
        volume: 100,
      }));

      const secondPage = [
        {
          id: 'candle-20001',
          time: new Date('2024-01-02T00:00:00.000Z'),
          open: 1.1,
          high: 1.2,
          low: 1.0,
          close: 1.15,
          volume: 100,
        },
      ];

      mockPrisma.marketDataCandle.findMany
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      const result = await service.loadCandlesForSession(session);

      expect(result).toHaveLength(20001);
      expect(mockPrisma.marketDataCandle.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.marketDataCandle.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cursor: { id: 'candle-20000' },
          skip: 1,
          take: 20000,
        }),
      );
    });
  });

  // ─── updateSessionStatus ───────────────────────────────────────────

  describe('updateSessionStatus', () => {
    it('should update session status', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        trades: [],
        snapshots: [],
      });

      const updated = { id: 'session-1', status: 'active' };
      mockPrisma.backtestingSession.update.mockResolvedValue(updated);

      const result = await service.updateSessionStatus(
        'user-1',
        'session-1',
        'active',
      );
      expect(result.status).toBe('active');
    });
  });

  // ─── deleteSession ─────────────────────────────────────────────────

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      mockPrisma.backtestingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        trades: [],
        snapshots: [],
      });

      mockPrisma.backtestingSession.delete.mockResolvedValue({
        id: 'session-1',
      });

      const result = await service.deleteSession('user-1', 'session-1');
      expect(result).toEqual({ id: 'session-1' });
      expect(mockPrisma.backtestingSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });
});
