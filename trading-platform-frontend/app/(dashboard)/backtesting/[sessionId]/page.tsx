'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';

import { useBacktesting } from '@/lib/hooks/useBacktesting';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import TradingViewChart from '@/components/charts/TradingViewChart';
import PlaybackControls from '@/components/features/backtesting/PlaybackControls';
import OrderEntryPanel from '@/components/features/backtesting/OrderEntryPanel';
import PositionsPanel from '@/components/features/backtesting/PositionsPanel';
import AccountSummary from '@/components/features/backtesting/AccountSummary';

export default function BacktestingSessionPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    const { session, positions, isLoading } = useBacktesting(sessionId);
    const { data: wsData } = useWebSocket(sessionId);

    const { data: historicalData, isLoading: isDataLoading } = useQuery({
        queryKey: ['historical-data', session?.instrument, session?.startDate, session?.endDate, session?.timeframe],
        queryFn: async () => {
            if (!session) return [];
            console.log('Fetching historical data for:', session.instrument);
            const { data } = await api.get('/market-data/historical', {
                params: {
                    symbol: session.instrument,
                    from: session.startDate,
                    to: session.endDate,
                    timeframe: session.timeframe || '1d'
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return data.map((d: any) => ({
                time: d.timestamp.split('T')[0], // Using YYYY-MM-DD for consistency with mock, or switch to unix for intraday
                open: Number(d.open),
                high: Number(d.high),
                low: Number(d.low),
                close: Number(d.close),
                volume: Number(d.volume),
            }));
        },
        enabled: !!session
    });

    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);

    const currentPrice = wsData?.currentPrice || 5025;
    const balance = wsData?.balance || session?.currentBalance || 50000;
    const startingBalance = session?.startingBalance || 50000;
    const pnl = wsData?.pnl || session?.pnl || 0;

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Loading session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <AccountSummary
                    balance={balance}
                    startingBalance={startingBalance}
                    pnl={pnl}
                />
                <Link href={`/backtesting/${sessionId}/report`}>
                    <Button variant="outline" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Generate Report
                    </Button>
                </Link>
            </div>

            {/* Playback Controls */}
            <PlaybackControls
                sessionId={sessionId}
                isPlaying={isPlaying}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                speed={speed}
                onSpeedChange={setSpeed}
            />

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
                {/* Chart area */}
                <div className="lg:col-span-8 border rounded-xl overflow-hidden bg-card min-h-[400px] relative">
                    {isDataLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    <TradingViewChart
                        symbol={session?.instrument || 'ES'}
                        currentTime={wsData?.timestamp}
                        data={historicalData}
                    />
                </div>

                {/* Right sidebar */}
                <div className="lg:col-span-4 space-y-4 overflow-y-auto">
                    <OrderEntryPanel
                        sessionId={sessionId}
                        currentPrice={currentPrice}
                    />
                    <PositionsPanel
                        positions={positions}
                        currentPrice={currentPrice}
                    />
                </div>
            </div>
        </div>
    );

}
