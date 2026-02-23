import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

/**
 * Credentials stored per user per broker connection.
 */
export interface StoredOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string;
}

/**
 * OAuth2 configuration for a broker.
 */
export interface OAuthConfig {
  brokerId: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Generic OAuth2 service for broker integrations.
 * Handles authorization URL generation, code exchange, and token refresh.
 */
@Injectable()
export class BrokerOAuthService {
  private readonly logger = new Logger(BrokerOAuthService.name);

  // In production, replace with database-backed storage
  private readonly tokenStore = new Map<string, StoredOAuthTokens>();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Generate the OAuth2 authorization URL for the user to visit.
   */
  getAuthorizationUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for access and refresh tokens.
   */
  async exchangeCodeForTokens(
    config: OAuthConfig,
    code: string,
  ): Promise<StoredOAuthTokens> {
    try {
      const response = await this.httpService.axiosRef.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokens: StoredOAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      return tokens;
    } catch (error: any) {
      this.logger.error(
        `OAuth code exchange failed for ${config.brokerId}`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Refresh an expired access token using the refresh token.
   */
  async refreshTokens(
    config: OAuthConfig,
    refreshToken: string,
  ): Promise<StoredOAuthTokens> {
    try {
      const response = await this.httpService.axiosRef.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokens: StoredOAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      return tokens;
    } catch (error: any) {
      this.logger.error(
        `OAuth token refresh failed for ${config.brokerId}`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Store tokens for a user+broker combination.
   */
  storeTokens(
    userId: string,
    brokerId: string,
    tokens: StoredOAuthTokens,
  ): void {
    const key = `${userId}:${brokerId}`;
    this.tokenStore.set(key, tokens);
  }

  /**
   * Retrieve tokens for a user+broker combination.
   */
  getTokens(userId: string, brokerId: string): StoredOAuthTokens | undefined {
    const key = `${userId}:${brokerId}`;
    return this.tokenStore.get(key);
  }

  /**
   * Check if tokens are expired and refresh if needed.
   */
  async ensureValidTokens(
    userId: string,
    config: OAuthConfig,
  ): Promise<StoredOAuthTokens | null> {
    const tokens = this.getTokens(userId, config.brokerId);
    if (!tokens) return null;

    // Refresh if expires within 5 minutes
    if (tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      if (!tokens.refreshToken) return null;

      const refreshed = await this.refreshTokens(config, tokens.refreshToken);
      this.storeTokens(userId, config.brokerId, refreshed);
      return refreshed;
    }

    return tokens;
  }

  /**
   * Remove stored tokens (logout/disconnect).
   */
  revokeTokens(userId: string, brokerId: string): void {
    const key = `${userId}:${brokerId}`;
    this.tokenStore.delete(key);
  }
}
