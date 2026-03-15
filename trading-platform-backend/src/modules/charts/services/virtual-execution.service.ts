import { Injectable, Logger } from '@nestjs/common';

/**
 * Virtual execution service for replay mode.
 * Simulates spread, slippage, commission, and partial fills.
 */
@Injectable()
export class VirtualExecutionService {
    private readonly logger = new Logger(VirtualExecutionService.name);

    /** Configurable parameters */
    private readonly spreadPips = 1.5;
    private readonly maxSlippagePips = 0.5;
    private readonly commissionPerLot = 3.5; // USD per lot per side
    private readonly partialFillMinRatio = 0.7;

    /**
     * Apply simulated spread to a price.
     */
    applySpread(price: number, side: 'buy' | 'sell', pipSize: number): number {
        const halfSpread = (this.spreadPips * pipSize) / 2;
        return side === 'buy' ? price + halfSpread : price - halfSpread;
    }

    /**
     * Apply simulated slippage using Box-Muller gaussian approximation.
     */
    applySlippage(price: number, pipSize: number): number {
        const u1 = Math.random();
        const u2 = Math.random();
        const gaussian = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);

        // Clamp to max slippage
        const slippagePips = Math.max(-this.maxSlippagePips, Math.min(this.maxSlippagePips, gaussian * this.maxSlippagePips));
        return price + slippagePips * pipSize;
    }

    /**
     * Calculate commission for a given volume.
     */
    calculateCommission(volume: number): number {
        return volume * this.commissionPerLot * 2; // Both open and close
    }

    /**
     * Simulate partial fill for limit orders.
     * Returns the filled volume (may be less than requested).
     */
    simulatePartialFill(requestedVolume: number): number {
        const fillRatio = this.partialFillMinRatio + Math.random() * (1 - this.partialFillMinRatio);
        // Round to 0.01 precision
        return Math.round(requestedVolume * fillRatio * 100) / 100;
    }

    /**
     * Get a simulated fill price for a market order during replay.
     */
    getSimulatedFillPrice(
        basePrice: number,
        side: 'buy' | 'sell',
        pipSize: number,
    ): SimulatedFill {
        const withSpread = this.applySpread(basePrice, side, pipSize);
        const withSlippage = this.applySlippage(withSpread, pipSize);

        return {
            fillPrice: withSlippage,
            spread: Math.abs(withSpread - basePrice),
            slippage: Math.abs(withSlippage - withSpread),
        };
    }
}

export interface SimulatedFill {
    fillPrice: number;
    spread: number;
    slippage: number;
}
