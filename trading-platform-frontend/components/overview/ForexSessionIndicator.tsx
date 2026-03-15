'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Forex session times in UTC
const SESSIONS = [
    {
        name: 'Sydney',
        openUTC: 22,
        closeUTC: 7,
        countryCode: 'au',
        color: '#0ea5e9', // Teal-Blue
        x: 87.5,
        y: 77,
    },
    {
        name: 'Tokyo',
        openUTC: 0,
        closeUTC: 9,
        countryCode: 'jp',
        color: '#f43f5e', // Red/Pink
        x: 84.5,
        y: 35,
    },
    {
        name: 'London',
        openUTC: 8,
        closeUTC: 17,
        countryCode: 'gb',
        color: '#0ea5e9', // Cyan/Blue
        x: 48,
        y: 25,
    },
    {
        name: 'New York',
        openUTC: 13,
        closeUTC: 22,
        countryCode: 'us',
        color: '#3b82f6', // Blue
        x: 27,
        y: 35,
    },
];

function isSessionActive(openUTC: number, closeUTC: number, currentHour: number): boolean {
    if (openUTC < closeUTC) {
        return currentHour >= openUTC && currentHour < closeUTC;
    }
    // Wraps midnight
    return currentHour >= openUTC || currentHour < closeUTC;
}

function formatTime(d: Date): string {
    return d.toISOString().slice(11, 19);
}

function formatLocalTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatLocalDate(d: Date): string {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

function ClockInfo() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground flex items-baseline gap-2">
                {formatTime(now)} <span className="text-sm font-semibold text-muted-foreground uppercase">UTC</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
                {formatLocalDate(now)}, {formatLocalTime(now)}
            </div>
        </div>
    );
}

export default function ForexSessionIndicator() {
    const [now, setNow] = useState(new Date());

    // Only update the heavy UI (map, timeline) once every minute on the minute mark
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        let interval: NodeJS.Timeout;

        const sync = () => {
            setNow(new Date());
            interval = setInterval(() => setNow(new Date()), 60000);
        };

        const msUntilNextMinute = 60000 - (new Date().getSeconds() * 1000 + new Date().getMilliseconds());
        timeout = setTimeout(sync, msUntilNextMinute);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);

    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const timeProgress = ((currentHour * 60 + currentMinute) / (24 * 60)) * 100;

    const activeSessions = SESSIONS.filter((s) =>
        isSessionActive(s.openUTC, s.closeUTC, currentHour)
    );

    return (
        <Card className="relative overflow-hidden border-border bg-card shadow-sm">
            <CardContent className="p-4 sm:p-6 pb-8">
                {/* Header row: UTC Clock + Active sessions */}
                <div className="flex items-start justify-between mb-5">
                    <ClockInfo />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground hidden sm:inline">Active:</span>
                        {activeSessions.length > 0 ? (
                            activeSessions.map((s) => (
                                <div
                                    key={s.name}
                                    className="flex items-center gap-2 text-sm font-medium text-foreground"
                                >
                                    <img src={`https://flagcdn.com/${s.countryCode}.svg`} alt={s.name} className="w-5 h-[14px] object-cover rounded-[2px]" />
                                    <span>{s.name}</span>
                                </div>
                            ))
                        ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                        )}
                    </div>
                </div>

                {/* Timeline bar */}
                <div className="mb-6 mx-2">
                    {/* Hour labels */}
                    <div className="flex justify-between text-xs font-semibold text-foreground mb-2">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>00:00</span>
                    </div>
                    {/* Timeline track */}
                    <div className="relative h-2 rounded-full bg-[#E2E8F0] dark:bg-slate-800 overflow-visible">
                        {SESSIONS.map((s) => {
                            const isActive = isSessionActive(s.openUTC, s.closeUTC, currentHour);
                            if (s.openUTC < s.closeUTC) {
                                const left = (s.openUTC / 24) * 100;
                                const width = ((s.closeUTC - s.openUTC) / 24) * 100;
                                return (
                                    <div
                                        key={s.name}
                                        className="absolute top-0 h-full rounded-full"
                                        style={{
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            backgroundColor: isActive ? '#3b82f6' : 'transparent',
                                            opacity: isActive ? 1 : 0,
                                        }}
                                    />
                                );
                            } else {
                                const leftA = (s.openUTC / 24) * 100;
                                const widthA = ((24 - s.openUTC) / 24) * 100;
                                const widthB = (s.closeUTC / 24) * 100;
                                return (
                                    <div key={s.name}>
                                        <div
                                            className="absolute top-0 h-full rounded-l-full"
                                            style={{
                                                left: `${leftA}%`,
                                                width: `${widthA}%`,
                                                backgroundColor: isActive && currentHour >= s.openUTC ? '#3b82f6' : 'transparent',
                                                opacity: isActive ? 1 : 0,
                                            }}
                                        />
                                        <div
                                            className="absolute top-0 h-full rounded-r-full"
                                            style={{
                                                left: '0%',
                                                width: `${widthB}%`,
                                                backgroundColor: isActive && currentHour < s.closeUTC ? '#3b82f6' : 'transparent',
                                                opacity: isActive ? 1 : 0,
                                            }}
                                        />
                                    </div>
                                );
                            }
                        })}

                        {/* Current time marker */}
                        <div
                            className="absolute top-1/2 -z-0 h-4 w-0.5 bg-slate-800 dark:bg-slate-200 -translate-y-1/2"
                            style={{ left: `${timeProgress}%` }}
                        />
                    </div>
                </div>

                {/* World Map Area */}
                <div className="relative w-full mt-8" style={{ aspectRatio: '2.2 / 1' }}>

                    {/* Map Background layer using standard background-image */}
                    <div
                        className="absolute inset-0 opacity-20 dark:opacity-40"
                        style={{
                            backgroundImage: "url('/world-map.svg')",
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                        }}
                    />

                    {/* Session markers overlaid on map */}
                    {SESSIONS.map((session) => {
                        const isActive = isSessionActive(session.openUTC, session.closeUTC, currentHour);
                        return (
                            <div
                                key={session.name}
                                className="absolute flex flex-col items-center"
                                style={{
                                    left: `${session.x}%`,
                                    top: `${session.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                {/* Visual marker stack */}
                                <div className="relative flex items-center justify-center">
                                    {/* Glowing ping outline if active */}
                                    {isActive && (
                                        <div
                                            className="absolute inset-0 rounded-full animate-ping opacity-60"
                                            style={{ backgroundColor: session.color }}
                                        />
                                    )}

                                    {/* Solid flag circle */}
                                    <div
                                        className="relative z-10 w-9 h-9 rounded-full bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center border-[3px]"
                                        style={{ borderColor: isActive ? session.color : 'transparent' }}
                                    >
                                        <img
                                            src={`https://flagcdn.com/${session.countryCode}.svg`}
                                            alt={session.name}
                                            className="w-full h-full object-cover scale-[1.3]"
                                        />
                                    </div>
                                </div>

                                {/* Info Speech Bubble */}
                                <div className="absolute top-full mt-2.5 z-20">
                                    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border shadow-xl rounded-xl py-2 px-4 text-center relative border-[#E2E8F0] dark:border-slate-700 min-w-[110px]">
                                        {/* Small Arrow Pointer */}
                                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 dark:bg-slate-800/95 rotate-45 border-t border-l border-[#E2E8F0] dark:border-slate-700" />

                                        {/* Text content */}
                                        <div className="relative z-10 flex flex-col items-center">
                                            <div className="font-semibold text-[14px] leading-tight text-slate-900 dark:text-white drop-shadow-sm">{session.name}</div>
                                            <div className="font-medium text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap tracking-tight flex items-center gap-1">
                                                <span>{pad(session.openUTC)}:00 - {pad(session.closeUTC)}:00</span>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">UTC</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
