'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    TrendingUp,
    Shield,
    Target,
    DollarSign,
    Coins,
    Landmark,
    ArrowDownUp,
    Sigma,
    Percent,
    AlertTriangle,
    BarChart3,
    Activity,
    PieChart,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// ─── Calculator Definitions ──────────────────────────────────────────────────

const calculators = [
    {
        id: 'montecarlo',
        name: 'Monte Carlo',
        description: 'Simulate randomized trade paths to estimate likely outcomes.',
        icon: TrendingUp,
    },
    {
        id: 'positionsize',
        name: 'Position Size',
        description: 'Calculate sizing based on risk, stop distance, and account size.',
        icon: Shield,
    },
    {
        id: 'riskreward',
        name: 'Risk/Reward',
        description: 'Measure risk, reward, and R:R from entry, stop, and target.',
        icon: Target,
    },
    {
        id: 'profit',
        name: 'Profit',
        description: 'Estimate profit or loss from price movement and pip value.',
        icon: DollarSign,
    },
    {
        id: 'pipvalue',
        name: 'Pip Value',
        description: 'Estimate pip value by symbol, lot size, and account currency.',
        icon: Coins,
    },
    {
        id: 'margin',
        name: 'Margin',
        description: 'Estimate margin requirements from price, size, and leverage.',
        icon: Landmark,
    },
    {
        id: 'drawdown',
        name: 'Drawdown',
        description: 'See the recovery % needed after a drawdown.',
        icon: ArrowDownUp,
    },
    {
        id: 'expectancy',
        name: 'Expectancy',
        description: 'Estimate expectancy from win rate and payoff.',
        icon: Sigma,
    },
    {
        id: 'winrate',
        name: 'Win Rate',
        description: 'Find the win rate needed for breakeven or target expectancy.',
        icon: Percent,
    },
    {
        id: 'riskofruin',
        name: 'Risk of Ruin',
        description: 'Estimate the probability of ruin from win rate and risk.',
        icon: AlertTriangle,
    },
    {
        id: 'kelly',
        name: 'Kelly',
        description: 'Estimate Kelly sizing and fractional Kelly.',
        icon: BarChart3,
    },
    {
        id: 'atrsize',
        name: 'ATR Size',
        description: 'Volatility-adjusted position sizing using ATR.',
        icon: Activity,
    },
    {
        id: 'portfoliorisk',
        name: 'Portfolio Risk',
        description: 'Total exposure across multiple positions.',
        icon: PieChart,
    },
];

// ─── Calculator Logic Components ─────────────────────────────────────────────

function MonteCarloCalculator() {
    const [inputs, setInputs] = useState({
        winRate: '55',
        avgWin: '200',
        avgLoss: '100',
        totalTrades: '100',
        simulations: '1000',
        startingCapital: '10000',
    });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const wr = parseFloat(inputs.winRate) / 100;
        const avgW = parseFloat(inputs.avgWin);
        const avgL = parseFloat(inputs.avgLoss);
        const trades = parseInt(inputs.totalTrades);
        const sims = parseInt(inputs.simulations);
        const capital = parseFloat(inputs.startingCapital);

        const finalEquities: number[] = [];
        let maxDrawdowns: number[] = [];

        for (let s = 0; s < sims; s++) {
            let equity = capital;
            let peak = capital;
            let maxDD = 0;

            for (let t = 0; t < trades; t++) {
                if (Math.random() < wr) {
                    equity += avgW;
                } else {
                    equity -= avgL;
                }
                if (equity > peak) peak = equity;
                const dd = ((peak - equity) / peak) * 100;
                if (dd > maxDD) maxDD = dd;
            }

            finalEquities.push(equity);
            maxDrawdowns.push(maxDD);
        }

        finalEquities.sort((a, b) => a - b);
        maxDrawdowns.sort((a, b) => a - b);

        setResults({
            median: finalEquities[Math.floor(sims / 2)],
            p10: finalEquities[Math.floor(sims * 0.1)],
            p90: finalEquities[Math.floor(sims * 0.9)],
            worst: finalEquities[0],
            best: finalEquities[sims - 1],
            avgMaxDD: (maxDrawdowns.reduce((a, b) => a + b, 0) / sims).toFixed(2),
            ruinRate: ((finalEquities.filter(e => e <= 0).length / sims) * 100).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Win Rate (%)</Label><Input type="number" value={inputs.winRate} onChange={e => setInputs({ ...inputs, winRate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Avg Win ($)</Label><Input type="number" value={inputs.avgWin} onChange={e => setInputs({ ...inputs, avgWin: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Avg Loss ($)</Label><Input type="number" value={inputs.avgLoss} onChange={e => setInputs({ ...inputs, avgLoss: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Total Trades</Label><Input type="number" value={inputs.totalTrades} onChange={e => setInputs({ ...inputs, totalTrades: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Simulations</Label><Input type="number" value={inputs.simulations} onChange={e => setInputs({ ...inputs, simulations: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Starting Capital ($)</Label><Input type="number" value={inputs.startingCapital} onChange={e => setInputs({ ...inputs, startingCapital: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Run Simulation</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Median Outcome" value={formatCurrency(results.median)} />
                    <ResultCard label="10th Percentile" value={formatCurrency(results.p10)} />
                    <ResultCard label="90th Percentile" value={formatCurrency(results.p90)} />
                    <ResultCard label="Best Case" value={formatCurrency(results.best)} />
                    <ResultCard label="Worst Case" value={formatCurrency(results.worst)} />
                    <ResultCard label="Avg Max Drawdown" value={`${results.avgMaxDD}%`} />
                    <ResultCard label="Ruin Probability" value={`${results.ruinRate}%`} />
                </div>
            )}
        </div>
    );
}

function PositionSizeCalculator() {
    const [inputs, setInputs] = useState({
        accountSize: '10000',
        riskPercent: '1',
        entryPrice: '100',
        stopLoss: '95',
    });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const account = parseFloat(inputs.accountSize);
        const riskPct = parseFloat(inputs.riskPercent) / 100;
        const entry = parseFloat(inputs.entryPrice);
        const stop = parseFloat(inputs.stopLoss);

        const riskAmount = account * riskPct;
        const stopDistance = Math.abs(entry - stop);
        const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
        const positionValue = positionSize * entry;

        setResults({
            riskAmount: riskAmount.toFixed(2),
            stopDistance: stopDistance.toFixed(4),
            positionSize: positionSize.toFixed(4),
            positionValue: positionValue.toFixed(2),
            leverageUsed: (positionValue / account).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Account Size ($)</Label><Input type="number" value={inputs.accountSize} onChange={e => setInputs({ ...inputs, accountSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk Per Trade (%)</Label><Input type="number" value={inputs.riskPercent} onChange={e => setInputs({ ...inputs, riskPercent: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Entry Price</Label><Input type="number" value={inputs.entryPrice} onChange={e => setInputs({ ...inputs, entryPrice: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Stop Loss Price</Label><Input type="number" value={inputs.stopLoss} onChange={e => setInputs({ ...inputs, stopLoss: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Risk Amount" value={`$${results.riskAmount}`} />
                    <ResultCard label="Stop Distance" value={results.stopDistance} />
                    <ResultCard label="Position Size (Units)" value={results.positionSize} />
                    <ResultCard label="Position Value" value={`$${results.positionValue}`} />
                    <ResultCard label="Leverage Used" value={`${results.leverageUsed}x`} />
                </div>
            )}
        </div>
    );
}

function RiskRewardCalculator() {
    const [inputs, setInputs] = useState({ entry: '100', stop: '95', target: '110' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const entry = parseFloat(inputs.entry);
        const stop = parseFloat(inputs.stop);
        const target = parseFloat(inputs.target);

        const risk = Math.abs(entry - stop);
        const reward = Math.abs(target - entry);
        const rr = risk > 0 ? reward / risk : 0;
        const breakeven = rr > 0 ? (1 / (1 + rr)) * 100 : 0;

        setResults({
            risk: risk.toFixed(4),
            reward: reward.toFixed(4),
            rr: rr.toFixed(2),
            breakeven: breakeven.toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Entry Price</Label><Input type="number" value={inputs.entry} onChange={e => setInputs({ ...inputs, entry: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Stop Loss</Label><Input type="number" value={inputs.stop} onChange={e => setInputs({ ...inputs, stop: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Take Profit</Label><Input type="number" value={inputs.target} onChange={e => setInputs({ ...inputs, target: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Risk (Points)" value={results.risk} />
                    <ResultCard label="Reward (Points)" value={results.reward} />
                    <ResultCard label="R:R Ratio" value={`${results.rr}:1`} />
                    <ResultCard label="Breakeven Win Rate" value={`${results.breakeven}%`} />
                </div>
            )}
        </div>
    );
}

function ProfitCalculator() {
    const [inputs, setInputs] = useState({ entryPrice: '1.1000', exitPrice: '1.1050', lotSize: '1', pipValue: '10', direction: 'long' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const entry = parseFloat(inputs.entryPrice);
        const exit = parseFloat(inputs.exitPrice);
        const lots = parseFloat(inputs.lotSize);
        const pipVal = parseFloat(inputs.pipValue);
        const isLong = inputs.direction === 'long';

        const priceDiff = isLong ? (exit - entry) : (entry - exit);
        const pips = priceDiff * 10000; // For forex (4 decimal)
        const profit = pips * pipVal * lots;

        setResults({
            priceDiff: priceDiff.toFixed(5),
            pips: pips.toFixed(1),
            profit: profit.toFixed(2),
            direction: isLong ? 'Long (Buy)' : 'Short (Sell)',
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Entry Price</Label><Input type="number" step="0.0001" value={inputs.entryPrice} onChange={e => setInputs({ ...inputs, entryPrice: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Exit Price</Label><Input type="number" step="0.0001" value={inputs.exitPrice} onChange={e => setInputs({ ...inputs, exitPrice: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Lot Size</Label><Input type="number" step="0.01" value={inputs.lotSize} onChange={e => setInputs({ ...inputs, lotSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Pip Value ($)</Label><Input type="number" value={inputs.pipValue} onChange={e => setInputs({ ...inputs, pipValue: e.target.value })} /></div>
                <div className="space-y-1.5 col-span-2">
                    <Label>Direction</Label>
                    <select
                        value={inputs.direction}
                        onChange={e => setInputs({ ...inputs, direction: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <option value="long">Long (Buy)</option>
                        <option value="short">Short (Sell)</option>
                    </select>
                </div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Direction" value={results.direction} />
                    <ResultCard label="Price Difference" value={results.priceDiff} />
                    <ResultCard label="Pips" value={results.pips} />
                    <ResultCard label="Profit / Loss" value={`$${results.profit}`} highlight={parseFloat(results.profit) >= 0 ? 'green' : 'red'} />
                </div>
            )}
        </div>
    );
}

function PipValueCalculator() {
    const [inputs, setInputs] = useState({ lotSize: '1', pipSize: '0.0001', exchangeRate: '1.1000', accountCurrency: 'USD' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const lots = parseFloat(inputs.lotSize);
        const pip = parseFloat(inputs.pipSize);
        const rate = parseFloat(inputs.exchangeRate);

        // Standard lot = 100,000 units
        const units = lots * 100000;
        const pipValueInQuote = units * pip;
        const pipValueInAccount = pipValueInQuote / rate;

        setResults({
            units: units.toFixed(0),
            pipValueQuote: pipValueInQuote.toFixed(4),
            pipValueAccount: pipValueInAccount.toFixed(2),
            tenPips: (pipValueInAccount * 10).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Lot Size</Label><Input type="number" step="0.01" value={inputs.lotSize} onChange={e => setInputs({ ...inputs, lotSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Pip Size (e.g. 0.0001)</Label><Input type="number" step="0.0001" value={inputs.pipSize} onChange={e => setInputs({ ...inputs, pipSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Exchange Rate</Label><Input type="number" step="0.0001" value={inputs.exchangeRate} onChange={e => setInputs({ ...inputs, exchangeRate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Account Currency</Label><Input value={inputs.accountCurrency} onChange={e => setInputs({ ...inputs, accountCurrency: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Units" value={results.units} />
                    <ResultCard label="Pip Value (Quote)" value={`$${results.pipValueQuote}`} />
                    <ResultCard label="Pip Value (Account)" value={`$${results.pipValueAccount}`} />
                    <ResultCard label="10 Pips Value" value={`$${results.tenPips}`} />
                </div>
            )}
        </div>
    );
}

function MarginCalculator() {
    const [inputs, setInputs] = useState({ price: '1.1000', lotSize: '1', leverage: '100' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const price = parseFloat(inputs.price);
        const lots = parseFloat(inputs.lotSize);
        const leverage = parseFloat(inputs.leverage);

        const units = lots * 100000;
        const notionalValue = units * price;
        const requiredMargin = notionalValue / leverage;
        const marginPercent = (1 / leverage) * 100;

        setResults({
            notionalValue: notionalValue.toFixed(2),
            requiredMargin: requiredMargin.toFixed(2),
            marginPercent: marginPercent.toFixed(2),
            leverage: leverage.toFixed(0),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Price</Label><Input type="number" step="0.0001" value={inputs.price} onChange={e => setInputs({ ...inputs, price: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Lot Size</Label><Input type="number" step="0.01" value={inputs.lotSize} onChange={e => setInputs({ ...inputs, lotSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Leverage</Label><Input type="number" value={inputs.leverage} onChange={e => setInputs({ ...inputs, leverage: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Notional Value" value={`$${results.notionalValue}`} />
                    <ResultCard label="Required Margin" value={`$${results.requiredMargin}`} />
                    <ResultCard label="Margin %" value={`${results.marginPercent}%`} />
                    <ResultCard label="Leverage" value={`${results.leverage}:1`} />
                </div>
            )}
        </div>
    );
}

function DrawdownCalculator() {
    const [inputs, setInputs] = useState({ drawdownPercent: '25' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const dd = parseFloat(inputs.drawdownPercent);
        const recoveryNeeded = ((1 / (1 - dd / 100)) - 1) * 100;

        // Build recovery table
        const table = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90].map(d => ({
            drawdown: d,
            recovery: (((1 / (1 - d / 100)) - 1) * 100).toFixed(1),
        }));

        setResults({
            recoveryNeeded: recoveryNeeded.toFixed(2),
            table,
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1.5"><Label>Drawdown (%)</Label><Input type="number" value={inputs.drawdownPercent} onChange={e => setInputs({ ...inputs, drawdownPercent: e.target.value })} /></div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="space-y-4 pt-2">
                    <ResultCard label="Recovery Needed" value={`${results.recoveryNeeded}%`} highlight="red" />
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="text-left px-3 py-2 font-medium">Drawdown %</th>
                                    <th className="text-right px-3 py-2 font-medium">Recovery Needed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.table.map((row: any) => (
                                    <tr key={row.drawdown} className={`border-t ${row.drawdown === parseFloat(inputs.drawdownPercent) ? 'bg-primary/10 font-semibold' : ''}`}>
                                        <td className="px-3 py-1.5">{row.drawdown}%</td>
                                        <td className="px-3 py-1.5 text-right text-red-500">{row.recovery}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function ExpectancyCalculator() {
    const [inputs, setInputs] = useState({ winRate: '55', avgWin: '200', avgLoss: '100' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const wr = parseFloat(inputs.winRate) / 100;
        const avgW = parseFloat(inputs.avgWin);
        const avgL = parseFloat(inputs.avgLoss);

        const expectancy = (wr * avgW) - ((1 - wr) * avgL);
        const payoffRatio = avgL > 0 ? avgW / avgL : 0;
        const expectancyR = wr * payoffRatio - (1 - wr);
        const per100 = expectancy * 100;

        setResults({
            expectancy: expectancy.toFixed(2),
            expectancyR: expectancyR.toFixed(4),
            payoffRatio: payoffRatio.toFixed(2),
            per100: per100.toFixed(2),
            edge: expectancy > 0 ? 'Positive Edge' : expectancy < 0 ? 'Negative Edge' : 'Breakeven',
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Win Rate (%)</Label><Input type="number" value={inputs.winRate} onChange={e => setInputs({ ...inputs, winRate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Avg Win ($)</Label><Input type="number" value={inputs.avgWin} onChange={e => setInputs({ ...inputs, avgWin: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Avg Loss ($)</Label><Input type="number" value={inputs.avgLoss} onChange={e => setInputs({ ...inputs, avgLoss: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Expectancy / Trade" value={`$${results.expectancy}`} highlight={parseFloat(results.expectancy) >= 0 ? 'green' : 'red'} />
                    <ResultCard label="Expectancy (R)" value={results.expectancyR} />
                    <ResultCard label="Payoff Ratio" value={`${results.payoffRatio}:1`} />
                    <ResultCard label="Expected per 100 Trades" value={`$${results.per100}`} />
                    <ResultCard label="Edge" value={results.edge} highlight={results.edge === 'Positive Edge' ? 'green' : 'red'} />
                </div>
            )}
        </div>
    );
}

function WinRateCalculator() {
    const [inputs, setInputs] = useState({ avgWin: '200', avgLoss: '100', targetExpectancy: '0' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const avgW = parseFloat(inputs.avgWin);
        const avgL = parseFloat(inputs.avgLoss);
        const targetExp = parseFloat(inputs.targetExpectancy);

        // Expectancy = WR * avgW - (1-WR) * avgL = target
        // WR * avgW - avgL + WR * avgL = target
        // WR * (avgW + avgL) = target + avgL
        // WR = (target + avgL) / (avgW + avgL)
        const breakevenWR = avgL / (avgW + avgL);
        const targetWR = (targetExp + avgL) / (avgW + avgL);

        setResults({
            breakevenWR: (breakevenWR * 100).toFixed(2),
            targetWR: (targetWR * 100).toFixed(2),
            payoffRatio: (avgW / avgL).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Avg Win ($)</Label><Input type="number" value={inputs.avgWin} onChange={e => setInputs({ ...inputs, avgWin: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Avg Loss ($)</Label><Input type="number" value={inputs.avgLoss} onChange={e => setInputs({ ...inputs, avgLoss: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Target Expectancy ($)</Label><Input type="number" value={inputs.targetExpectancy} onChange={e => setInputs({ ...inputs, targetExpectancy: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Breakeven Win Rate" value={`${results.breakevenWR}%`} />
                    <ResultCard label="Required Win Rate" value={`${results.targetWR}%`} highlight={parseFloat(results.targetWR) < 100 ? 'green' : 'red'} />
                    <ResultCard label="Payoff Ratio" value={`${results.payoffRatio}:1`} />
                </div>
            )}
        </div>
    );
}

function RiskOfRuinCalculator() {
    const [inputs, setInputs] = useState({ winRate: '55', payoffRatio: '2', riskPerTrade: '2', ruinThreshold: '50' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const wr = parseFloat(inputs.winRate) / 100;
        const rr = parseFloat(inputs.payoffRatio);
        const riskPct = parseFloat(inputs.riskPerTrade) / 100;
        const ruinPct = parseFloat(inputs.ruinThreshold) / 100;

        // Approximate risk of ruin using formula:
        // RoR ≈ ((1 - edge) / (1 + edge))^units
        // where edge = (wr * rr - (1-wr)) / (wr * rr + (1-wr))
        // units = ruinThreshold / riskPerTrade
        const expectancy = wr * rr - (1 - wr);
        const edge = expectancy / (wr * rr + (1 - wr));
        const units = ruinPct / riskPct;

        let ror: number;
        if (edge <= 0) {
            ror = 100;
        } else {
            ror = Math.pow((1 - edge) / (1 + edge), units) * 100;
        }

        setResults({
            ror: ror.toFixed(4),
            expectancy: expectancy.toFixed(4),
            edge: (edge * 100).toFixed(2),
            units: units.toFixed(0),
            safe: ror < 1 ? 'Low Risk' : ror < 5 ? 'Moderate' : 'High Risk',
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Win Rate (%)</Label><Input type="number" value={inputs.winRate} onChange={e => setInputs({ ...inputs, winRate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Payoff Ratio (R:R)</Label><Input type="number" value={inputs.payoffRatio} onChange={e => setInputs({ ...inputs, payoffRatio: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk Per Trade (%)</Label><Input type="number" value={inputs.riskPerTrade} onChange={e => setInputs({ ...inputs, riskPerTrade: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Ruin Threshold (%)</Label><Input type="number" value={inputs.ruinThreshold} onChange={e => setInputs({ ...inputs, ruinThreshold: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Risk of Ruin" value={`${results.ror}%`} highlight={parseFloat(results.ror) < 1 ? 'green' : 'red'} />
                    <ResultCard label="Expectancy (R)" value={results.expectancy} />
                    <ResultCard label="Edge" value={`${results.edge}%`} />
                    <ResultCard label="Risk Assessment" value={results.safe} highlight={results.safe === 'Low Risk' ? 'green' : results.safe === 'Moderate' ? 'yellow' : 'red'} />
                </div>
            )}
        </div>
    );
}

function KellyCalculator() {
    const [inputs, setInputs] = useState({ winRate: '55', payoffRatio: '2', fraction: '25' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const wr = parseFloat(inputs.winRate) / 100;
        const rr = parseFloat(inputs.payoffRatio);
        const frac = parseFloat(inputs.fraction) / 100;

        // Kelly % = W - (1-W)/R  where W=win rate, R=payoff ratio
        const kelly = wr - ((1 - wr) / rr);
        const fractionalKelly = kelly * frac;
        const halfKelly = kelly * 0.5;
        const quarterKelly = kelly * 0.25;

        setResults({
            fullKelly: (kelly * 100).toFixed(2),
            fractionalKelly: (fractionalKelly * 100).toFixed(2),
            halfKelly: (halfKelly * 100).toFixed(2),
            quarterKelly: (quarterKelly * 100).toFixed(2),
            suggestion: kelly > 0 ? 'Positive Edge — Kelly suggests sizing.' : 'No edge — Kelly suggests no bet.',
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Win Rate (%)</Label><Input type="number" value={inputs.winRate} onChange={e => setInputs({ ...inputs, winRate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Payoff Ratio (R:R)</Label><Input type="number" value={inputs.payoffRatio} onChange={e => setInputs({ ...inputs, payoffRatio: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Fraction (%)</Label><Input type="number" value={inputs.fraction} onChange={e => setInputs({ ...inputs, fraction: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Full Kelly %" value={`${results.fullKelly}%`} />
                    <ResultCard label={`Fractional Kelly (${inputs.fraction}%)`} value={`${results.fractionalKelly}%`} highlight="green" />
                    <ResultCard label="Half Kelly" value={`${results.halfKelly}%`} />
                    <ResultCard label="Quarter Kelly" value={`${results.quarterKelly}%`} />
                    <div className="col-span-2">
                        <ResultCard label="Assessment" value={results.suggestion} highlight={parseFloat(results.fullKelly) > 0 ? 'green' : 'red'} />
                    </div>
                </div>
            )}
        </div>
    );
}

function ATRSizeCalculator() {
    const [inputs, setInputs] = useState({ accountSize: '10000', riskPercent: '1', atr: '1.50', atrMultiple: '2', price: '50' });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const account = parseFloat(inputs.accountSize);
        const riskPct = parseFloat(inputs.riskPercent) / 100;
        const atr = parseFloat(inputs.atr);
        const mult = parseFloat(inputs.atrMultiple);
        const price = parseFloat(inputs.price);

        const riskAmount = account * riskPct;
        const stopDistance = atr * mult;
        const shares = stopDistance > 0 ? riskAmount / stopDistance : 0;
        const positionValue = shares * price;

        setResults({
            riskAmount: riskAmount.toFixed(2),
            stopDistance: stopDistance.toFixed(4),
            shares: shares.toFixed(2),
            positionValue: positionValue.toFixed(2),
            percentOfAccount: ((positionValue / account) * 100).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Account Size ($)</Label><Input type="number" value={inputs.accountSize} onChange={e => setInputs({ ...inputs, accountSize: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk (%)</Label><Input type="number" value={inputs.riskPercent} onChange={e => setInputs({ ...inputs, riskPercent: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>ATR Value</Label><Input type="number" step="0.01" value={inputs.atr} onChange={e => setInputs({ ...inputs, atr: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>ATR Multiple</Label><Input type="number" step="0.5" value={inputs.atrMultiple} onChange={e => setInputs({ ...inputs, atrMultiple: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Current Price</Label><Input type="number" step="0.01" value={inputs.price} onChange={e => setInputs({ ...inputs, price: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Risk Amount" value={`$${results.riskAmount}`} />
                    <ResultCard label="Stop Distance (ATR)" value={results.stopDistance} />
                    <ResultCard label="Position Size (Shares)" value={results.shares} />
                    <ResultCard label="Position Value" value={`$${results.positionValue}`} />
                    <ResultCard label="% of Account" value={`${results.percentOfAccount}%`} />
                </div>
            )}
        </div>
    );
}

function PortfolioRiskCalculator() {
    const [inputs, setInputs] = useState({
        accountSize: '50000',
        positions: '3',
        pos1Size: '5000', pos1Risk: '2',
        pos2Size: '8000', pos2Risk: '1.5',
        pos3Size: '3000', pos3Risk: '3',
    });
    const [results, setResults] = useState<any>(null);

    const calculate = () => {
        const account = parseFloat(inputs.accountSize);
        const positions = [
            { size: parseFloat(inputs.pos1Size), risk: parseFloat(inputs.pos1Risk) },
            { size: parseFloat(inputs.pos2Size), risk: parseFloat(inputs.pos2Risk) },
            { size: parseFloat(inputs.pos3Size), risk: parseFloat(inputs.pos3Risk) },
        ].filter(p => p.size > 0);

        const totalExposure = positions.reduce((sum, p) => sum + p.size, 0);
        const totalRiskDollars = positions.reduce((sum, p) => sum + (p.size * p.risk / 100), 0);
        const totalRiskPercent = (totalRiskDollars / account) * 100;
        const exposurePercent = (totalExposure / account) * 100;

        setResults({
            totalExposure: totalExposure.toFixed(2),
            exposurePercent: exposurePercent.toFixed(2),
            totalRiskDollars: totalRiskDollars.toFixed(2),
            totalRiskPercent: totalRiskPercent.toFixed(2),
            positionCount: positions.length,
            avgRiskPerPos: (totalRiskPercent / positions.length).toFixed(2),
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1.5"><Label>Account Size ($)</Label><Input type="number" value={inputs.accountSize} onChange={e => setInputs({ ...inputs, accountSize: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground font-medium">Position 1</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Size ($)</Label><Input type="number" value={inputs.pos1Size} onChange={e => setInputs({ ...inputs, pos1Size: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk (%)</Label><Input type="number" value={inputs.pos1Risk} onChange={e => setInputs({ ...inputs, pos1Risk: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Position 2</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Size ($)</Label><Input type="number" value={inputs.pos2Size} onChange={e => setInputs({ ...inputs, pos2Size: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk (%)</Label><Input type="number" value={inputs.pos2Risk} onChange={e => setInputs({ ...inputs, pos2Risk: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Position 3</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Size ($)</Label><Input type="number" value={inputs.pos3Size} onChange={e => setInputs({ ...inputs, pos3Size: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Risk (%)</Label><Input type="number" value={inputs.pos3Risk} onChange={e => setInputs({ ...inputs, pos3Risk: e.target.value })} /></div>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
            {results && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <ResultCard label="Total Exposure" value={`$${results.totalExposure}`} />
                    <ResultCard label="Exposure %" value={`${results.exposurePercent}%`} />
                    <ResultCard label="Total Risk ($)" value={`$${results.totalRiskDollars}`} />
                    <ResultCard label="Total Risk (%)" value={`${results.totalRiskPercent}%`} highlight={parseFloat(results.totalRiskPercent) > 5 ? 'red' : 'green'} />
                    <ResultCard label="Positions" value={results.positionCount} />
                    <ResultCard label="Avg Risk / Position" value={`${results.avgRiskPerPos}%`} />
                </div>
            )}
        </div>
    );
}

// ─── Shared Result Card ──────────────────────────────────────────────────────

function ResultCard({ label, value, highlight }: { label: string; value: string | number; highlight?: 'green' | 'red' | 'yellow' }) {
    const colorClass = highlight === 'green'
        ? 'text-green-500'
        : highlight === 'red'
            ? 'text-red-500'
            : highlight === 'yellow'
                ? 'text-yellow-500'
                : 'text-foreground';

    return (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
            <p className={`mt-1 text-base font-semibold font-mono ${colorClass}`}>{value}</p>
        </div>
    );
}

// ─── Calculator Renderer Map ─────────────────────────────────────────────────

const calculatorComponents: Record<string, React.ReactNode> = {
    montecarlo: <MonteCarloCalculator />,
    positionsize: <PositionSizeCalculator />,
    riskreward: <RiskRewardCalculator />,
    profit: <ProfitCalculator />,
    pipvalue: <PipValueCalculator />,
    margin: <MarginCalculator />,
    drawdown: <DrawdownCalculator />,
    expectancy: <ExpectancyCalculator />,
    winrate: <WinRateCalculator />,
    riskofruin: <RiskOfRuinCalculator />,
    kelly: <KellyCalculator />,
    atrsize: <ATRSizeCalculator />,
    portfoliorisk: <PortfolioRiskCalculator />,
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CalculatorsPage() {
    const [openCalc, setOpenCalc] = useState<string | null>(null);

    const activeCalc = calculators.find(c => c.id === openCalc);

    return (
        <div className="mx-auto w-full max-w-370 space-y-8">
            <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-[-0.01em] md:text-4xl">Tools</h1>
                <p className="mt-1.5 text-sm text-muted-foreground md:text-[15px]">
                    Professional trading calculators to help you size positions, manage risk, and estimate outcomes.
                </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {calculators.map((calc) => (
                    <Card key={calc.id} className="group h-full">
                        <CardContent className="flex min-h-47.5 flex-col p-5 md:p-6">
                            <div className="flex items-center gap-2.5">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                                    <calc.icon className="h-5 w-5 text-primary" />
                                </span>
                                <h3 className="text-lg font-semibold leading-none">{calc.name}</h3>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                {calc.description}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-auto h-9 w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => setOpenCalc(calc.id)}
                            >
                                Open
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Calculator Dialog */}
            <Dialog open={!!openCalc} onOpenChange={(open) => { if (!open) setOpenCalc(null); }}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-border/80 p-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 border-b border-border/70 px-6 py-4 text-lg">
                            {activeCalc && <activeCalc.icon className="h-5 w-5 text-primary" />}
                            {activeCalc?.name} Calculator
                        </DialogTitle>
                    </DialogHeader>
                    <div className="px-6 pb-6 pt-5">{openCalc && calculatorComponents[openCalc]}</div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
