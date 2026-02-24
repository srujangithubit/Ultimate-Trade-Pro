import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto, RegisterDto } from './dto/auth.dto';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register a new user, hash the password, and return JWT tokens.
   */
  async register(dto: RegisterDto): Promise<Tokens> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hash,
        displayName: dto.displayName ?? null,
      },
    });

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Authenticate a user by email + password and return JWT tokens.
   */
  async login(dto: AuthDto): Promise<Tokens> {
    console.log(`[LOGIN ATTEMPT] Email: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      console.log(`[LOGIN FAILED] User not found for email: ${dto.email}`);
      throw new ForbiddenException('Invalid credentials');
    }

    if (!user.passwordHash) {
      console.log(
        `[LOGIN FAILED] No password hash found for user: ${dto.email}`,
      );
      throw new ForbiddenException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      console.log(`[LOGIN FAILED] Password mismatch for user: ${dto.email}`);
      throw new ForbiddenException('Invalid credentials');
    }

    console.log(`[LOGIN SUCCESS] Generating tokens for user: ${dto.email}`);

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Refresh the access token using a valid refresh token.
   */
  async refreshToken(userId: string, refreshToken: string): Promise<Tokens> {
    let session;
    try {
      session = await this.prisma.userSession.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      throw new ForbiddenException('Access denied');
    }

    if (!session) {
      throw new ForbiddenException('Access denied');
    }

    const rtMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!rtMatches) {
      throw new ForbiddenException('Access denied');
    }

    if (session.expiresAt < new Date()) {
      throw new ForbiddenException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ForbiddenException('Access denied');

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Sign a pair of JWT tokens (access + refresh).
   */
  async signTokens(userId: string, email: string): Promise<Tokens> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Hash and persist the refresh token as a user session.
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hash,
        expiresAt,
      },
    });
  }
}
