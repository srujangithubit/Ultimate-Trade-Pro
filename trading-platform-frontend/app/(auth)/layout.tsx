import { TrendingUp } from 'lucide-react';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            {/* Left side — branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 -left-20 h-64 w-64 rounded-full bg-white blur-3xl" />
                    <div className="absolute bottom-20 -right-20 h-96 w-96 rounded-full bg-white blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold">TradePro</span>
                    </div>
                </div>

                <div className="relative z-10 space-y-6">
                    <h1 className="text-4xl font-bold leading-tight">
                        Master Your Trading
                        <br />
                        With Data-Driven Insights
                    </h1>
                    <p className="text-lg opacity-80 max-w-md">
                        Backtest strategies, journal your trades, and analyze performance with
                        professional-grade tools designed for serious traders.
                    </p>
                    <div className="flex gap-8 pt-4">
                        <div>
                            <div className="text-3xl font-bold">10K+</div>
                            <div className="text-sm opacity-70">Active Traders</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold">2M+</div>
                            <div className="text-sm opacity-70">Trades Logged</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold">98%</div>
                            <div className="text-sm opacity-70">Satisfaction</div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm opacity-60">
                    © 2025 TradePro. All rights reserved.
                </div>
            </div>

            {/* Right side — form */}
            <div className="flex flex-1 items-center justify-center p-6 lg:p-12 bg-background">
                <div className="w-full max-w-md">
                    {children}
                </div>
            </div>
        </div>
    );
}
