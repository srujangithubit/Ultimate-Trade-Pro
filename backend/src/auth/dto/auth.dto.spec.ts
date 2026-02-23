import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthDto, RegisterDto } from './auth.dto';

describe('AuthDto validation', () => {
    describe('AuthDto', () => {
        it('should pass with valid email and password', async () => {
            const dto = plainToInstance(AuthDto, {
                email: 'test@example.com',
                password: 'password123',
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should fail with invalid email', async () => {
            const dto = plainToInstance(AuthDto, {
                email: 'not-an-email',
                password: 'password123',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('email');
        });

        it('should fail with empty email', async () => {
            const dto = plainToInstance(AuthDto, {
                email: '',
                password: 'password123',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should fail with password shorter than 6 characters', async () => {
            const dto = plainToInstance(AuthDto, {
                email: 'test@example.com',
                password: '12345',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            const passwordError = errors.find((e) => e.property === 'password');
            expect(passwordError).toBeDefined();
        });

        it('should fail with empty password', async () => {
            const dto = plainToInstance(AuthDto, {
                email: 'test@example.com',
                password: '',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should fail when email is missing', async () => {
            const dto = plainToInstance(AuthDto, {
                password: 'password123',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should fail when password is missing', async () => {
            const dto = plainToInstance(AuthDto, {
                email: 'test@example.com',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('RegisterDto', () => {
        it('should pass with valid email, password, and displayName', async () => {
            const dto = plainToInstance(RegisterDto, {
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should pass without displayName (optional)', async () => {
            const dto = plainToInstance(RegisterDto, {
                email: 'test@example.com',
                password: 'password123',
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should inherit email/password validation from AuthDto', async () => {
            const dto = plainToInstance(RegisterDto, {
                email: 'bad-email',
                password: '123',
                displayName: 'Test',
            });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThanOrEqual(2); // both email and password
        });
    });
});
