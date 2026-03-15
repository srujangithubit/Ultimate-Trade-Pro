'use client';

import { useCallback, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';

interface ChartStateCapture {
  symbol: string;
  timeframe: string;
  indicators: Record<string, unknown>;
  drawings: Record<string, unknown>;
  visibleRangeFrom: number | null;
  visibleRangeTo: number | null;
}

/**
 * Hook to capture the current chart state for sharing in community posts.
 */
export function useChartState() {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('');

  const setChartRefs = useCallback(
    (chart: IChartApi | null, series: ISeriesApi<SeriesType> | null) => {
      chartRef.current = chart;
      seriesRef.current = series;
    },
    [],
  );

  const captureState = useCallback((): ChartStateCapture | null => {
    const chart = chartRef.current;
    if (!chart) return null;

    const range = chart.timeScale().getVisibleRange();
    return {
      symbol,
      timeframe,
      indicators: {},
      drawings: {},
      visibleRangeFrom: range ? Number(range.from) : null,
      visibleRangeTo: range ? Number(range.to) : null,
    };
  }, [symbol, timeframe]);

  const captureAsJson = useCallback((): string | null => {
    const state = captureState();
    return state ? JSON.stringify(state) : null;
  }, [captureState]);

  return {
    chartRef,
    seriesRef,
    symbol,
    timeframe,
    setSymbol,
    setTimeframe,
    setChartRefs,
    captureState,
    captureAsJson,
  };
}
