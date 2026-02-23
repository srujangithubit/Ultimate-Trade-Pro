import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatCurrency(value: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

export function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

export function formatDate(dateStr: string, fmt = 'MMM dd, yyyy'): string {
    return format(parseISO(dateStr), fmt);
}

export function formatDateTime(dateStr: string): string {
    return format(parseISO(dateStr), 'MMM dd, yyyy HH:mm');
}

export function formatTimeAgo(dateStr: string): string {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
}

export function formatPnL(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
}

export function getPnLColor(value: number): string {
    if (value > 0) return 'text-profit';
    if (value < 0) return 'text-loss';
    return 'text-muted-foreground';
}

export function getPnLBgColor(value: number): string {
    if (value > 0) return 'bg-profit';
    if (value < 0) return 'bg-loss';
    return 'bg-muted';
}
