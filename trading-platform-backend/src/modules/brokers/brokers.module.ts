import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Adapters
import { AlpacaAdapter } from './adapters/alpaca.adapter';
import { InteractiveBrokersAdapter } from './adapters/interactive-brokers.adapter';
import { TdAmeritradeAdapter } from './adapters/td-ameritrade.adapter';
import { BinanceAdapter } from './adapters/binance.adapter';
import { CoinbaseAdapter } from './adapters/coinbase.adapter';

// Services
import { BrokerOAuthService } from './services/broker-oauth.service';

// Controllers
import { BrokerWebhookController } from './controllers/broker-webhook.controller';

/**
 * Broker Integrations Module.
 * Provides adapters for 5 major brokers, OAuth flow, and webhook handling.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
  ],
  controllers: [BrokerWebhookController],
  providers: [
    AlpacaAdapter,
    InteractiveBrokersAdapter,
    TdAmeritradeAdapter,
    BinanceAdapter,
    CoinbaseAdapter,
    BrokerOAuthService,
  ],
  exports: [
    AlpacaAdapter,
    InteractiveBrokersAdapter,
    TdAmeritradeAdapter,
    BinanceAdapter,
    CoinbaseAdapter,
    BrokerOAuthService,
  ],
})
export class BrokersModule {}
