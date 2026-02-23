import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = () => ({
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
});

describe('AuthController', () => {
    let controller: AuthController;
    let authService: ReturnType<typeof mockAuthService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useFactory: mockAuthService }],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get(AuthService);
    });

    describe('POST /auth/register', () => {
        it('should call authService.register and return tokens', async () => {
            const tokens = { accessToken: 'at', refreshToken: 'rt' };
            authService.register.mockResolvedValue(tokens);

            const dto = { email: 'test@test.com', password: 'pass123' };
            const result = await controller.register(dto);

            expect(authService.register).toHaveBeenCalledWith(dto);
            expect(result).toEqual(tokens);
        });
    });

    describe('POST /auth/login', () => {
        it('should call authService.login and return tokens', async () => {
            const tokens = { accessToken: 'at', refreshToken: 'rt' };
            authService.login.mockResolvedValue(tokens);

            const dto = { email: 'test@test.com', password: 'pass123' };
            const result = await controller.login(dto);

            expect(authService.login).toHaveBeenCalledWith(dto);
            expect(result).toEqual(tokens);
        });
    });

    describe('POST /auth/refresh', () => {
        it('should call authService.refreshToken and return tokens', async () => {
            const tokens = { accessToken: 'new-at', refreshToken: 'new-rt' };
            authService.refreshToken.mockResolvedValue(tokens);

            const result = await controller.refresh('user-id', 'old-rt');

            expect(authService.refreshToken).toHaveBeenCalledWith('user-id', 'old-rt');
            expect(result).toEqual(tokens);
        });
    });
});
