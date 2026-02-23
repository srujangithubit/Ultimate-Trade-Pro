import { Test, TestingModule } from '@nestjs/testing';
import { BacktestingController } from './backtesting.controller';
import { BacktestingService } from './backtesting.service';

describe('BacktestingController', () => {
    let controller: BacktestingController;
    let service: BacktestingService;

    const mockService = {
        createSession: jest.fn(),
        getSession: jest.fn(),
        listSessions: jest.fn(),
        executeOrder: jest.fn(),
        closeTrade: jest.fn(),
        updateSessionStatus: jest.fn(),
        deleteSession: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BacktestingController],
            providers: [
                { provide: BacktestingService, useValue: mockService },
            ],
        }).compile();

        controller = module.get<BacktestingController>(BacktestingController);
        service = module.get<BacktestingService>(BacktestingService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ─── createSession ─────────────────────────────────────────────────

    describe('createSession', () => {
        it('should call service.createSession', async () => {
            const dto = {
                sessionName: 'Test',
                instrument: 'AAPL',
                assetClass: 'stock' as const,
                startingBalance: 10000,
                startDate: '2024-01-01',
                endDate: '2024-12-31',
            };
            const expected = { id: 'session-1', name: 'Test' };

            mockService.createSession.mockResolvedValue(expected);

            const result = await controller.createSession('user-1', dto);
            expect(result).toEqual(expected);
            expect(mockService.createSession).toHaveBeenCalledWith('user-1', dto);
        });
    });

    // ─── listSessions ──────────────────────────────────────────────────

    describe('listSessions', () => {
        it('should call service.listSessions', async () => {
            const expected = [{ id: 'session-1' }, { id: 'session-2' }];
            mockService.listSessions.mockResolvedValue(expected);

            const result = await controller.listSessions('user-1');
            expect(result).toEqual(expected);
            expect(mockService.listSessions).toHaveBeenCalledWith('user-1');
        });
    });

    // ─── getSession ────────────────────────────────────────────────────

    describe('getSession', () => {
        it('should call service.getSession', async () => {
            const expected = { id: 'session-1', trades: [], snapshots: [] };
            mockService.getSession.mockResolvedValue(expected);

            const result = await controller.getSession('user-1', 'session-1');
            expect(result).toEqual(expected);
            expect(mockService.getSession).toHaveBeenCalledWith('user-1', 'session-1');
        });
    });

    // ─── executeOrder ──────────────────────────────────────────────────

    describe('executeOrder', () => {
        it('should call service.executeOrder', async () => {
            const dto = {
                orderType: 'market' as const,
                direction: 'long' as const,
                quantity: 10,
                price: 150,
            };
            const expected = { id: 'trade-1', status: 'OPEN' };

            mockService.executeOrder.mockResolvedValue(expected);

            const result = await controller.executeOrder('user-1', 'session-1', dto);
            expect(result).toEqual(expected);
            expect(mockService.executeOrder).toHaveBeenCalledWith('user-1', 'session-1', dto);
        });
    });

    // ─── closeTrade ────────────────────────────────────────────────────

    describe('closeTrade', () => {
        it('should call service.closeTrade', async () => {
            const expected = { id: 'trade-1', status: 'CLOSED', pnlNet: 95 };
            mockService.closeTrade.mockResolvedValue(expected);

            const result = await controller.closeTrade('user-1', 'session-1', 'trade-1', 110);
            expect(result).toEqual(expected);
            expect(mockService.closeTrade).toHaveBeenCalledWith(
                'user-1',
                'session-1',
                'trade-1',
                110,
            );
        });
    });

    // ─── updateStatus ──────────────────────────────────────────────────

    describe('updateStatus', () => {
        it('should call service.updateSessionStatus', async () => {
            const expected = { id: 'session-1', status: 'active' };
            mockService.updateSessionStatus.mockResolvedValue(expected);

            const result = await controller.updateStatus('user-1', 'session-1', 'active');
            expect(result).toEqual(expected);
            expect(mockService.updateSessionStatus).toHaveBeenCalledWith(
                'user-1',
                'session-1',
                'active',
            );
        });
    });

    // ─── deleteSession ─────────────────────────────────────────────────

    describe('deleteSession', () => {
        it('should call service.deleteSession', async () => {
            mockService.deleteSession.mockResolvedValue(undefined);

            const result = await controller.deleteSession('user-1', 'session-1');
            expect(result).toBeUndefined();
            expect(mockService.deleteSession).toHaveBeenCalledWith('user-1', 'session-1');
        });
    });
});
