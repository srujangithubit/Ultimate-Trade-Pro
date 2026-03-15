export function toFloat(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

export function toInt(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Math.floor(value);
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
}

export function candleToDto(candle: any, index: number) {
    return {
        time: Math.floor(new Date(candle.time).getTime() / 1000), // UTC unix seconds
        open: toFloat(candle.open),
        high: toFloat(candle.high),
        low: toFloat(candle.low),
        close: toFloat(candle.close),
        volume: toFloat(candle.volume),
        index,
    };
}
