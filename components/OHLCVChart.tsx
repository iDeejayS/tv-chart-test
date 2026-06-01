"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickSeriesOptions,
  type HistogramSeriesOptions,
} from "lightweight-charts";
import { OHLCVCandle } from "@/lib/api";

interface Props {
  candles: OHLCVCandle[];
  timeframe: string;
  loading: boolean;
  chartHeight?: number;
}

const SHORT_TF = new Set(["1s", "1m", "2m", "3m", "5m"]);

function minMoveFor(p: number): number {
  if (!p || p >= 1) return 0.0001;
  if (p >= 0.001) return 0.000001;
  if (p >= 0.00001) return 0.00000001;
  return 0.0000000001;
}

function fmtPrice(p: number): string {
  if (!p || !isFinite(p)) return "—";
  return p.toString();
}

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n).toFixed(2);
}

export default function OHLCVChart({
  candles,
  timeframe,
  loading,
  chartHeight,
}: Props) {
  const priceRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const isInitialSetRef = useRef(false);

  // Automatically resize the chart whenever container dimensions change (vertically or horizontally)
  useEffect(() => {
    if (!priceRef.current || !priceChartRef.current) return;

    const container = priceRef.current;
    const targetObserved = container.parentElement || container;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      // When observing the parent, entries[0].contentRect gives us the parent's actual bounding width/height
      const targetWidth = width || container.clientWidth || 800;
      const targetHeight =
        chartHeight || height || container.clientHeight || 400;

      priceChartRef.current?.resize(targetWidth, targetHeight);
    });

    resizeObserver.observe(targetObserved);

    return () => {
      resizeObserver.unobserve(targetObserved);
      resizeObserver.disconnect();
    };
  }, [chartHeight]);

  useEffect(() => {
    if (!priceRef.current) return;

    const initialWidth = priceRef.current.clientWidth || 800;
    const initialHeight = chartHeight || 400;

    priceChartRef.current = createChart(priceRef.current, {
      width: initialWidth,
      height: initialHeight,
      layout: { background: { color: "#0b0e11" }, textColor: "#848e9c" },
      grid: {
        vertLines: { color: "#1e2329" },
        horzLines: { color: "#1e2329" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#4a5260", // brighter, clearly visible y-axis border line
        scaleMargins: { top: 0.08, bottom: 0.08 },
        visible: true,
      },
      timeScale: {
        borderColor: "#4a5260", // brighter, clearly visible x-axis border line
        timeVisible: true,
        secondsVisible: SHORT_TF.has(timeframe),
        visible: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    candleSeriesRef.current = priceChartRef.current.addCandlestickSeries({
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    } as Partial<CandlestickSeriesOptions>);

    const tooltip = tooltipRef.current;
    priceChartRef.current.subscribeCrosshairMove((param: any) => {
      if (!tooltip) return;
      if (!param?.time || !param?.seriesData) {
        tooltip.style.display = "none";
        return;
      }
      const c = param.seriesData.get(candleSeriesRef.current);
      if (!c) {
        tooltip.style.display = "none";
        return;
      }
      const color = c.close >= c.open ? "#0ecb81" : "#f6465d";
      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <span style="color:${color};font-weight:600">
          O ${fmtPrice(c.open)} &nbsp; H ${fmtPrice(c.high)} &nbsp; L ${fmtPrice(c.low)} &nbsp; C ${fmtPrice(c.close)}
        </span>
      `;
    });

    return () => {
      priceChartRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (candles.length === 0) {
      candleSeriesRef.current.setData([]);
      isInitialSetRef.current = false;
      return;
    }

    if (!isInitialSetRef.current) {
      // 1. Initial complete dataset load (sets precision and boundaries)
      const mid = candles[Math.floor(candles.length / 2)].close;
      candleSeriesRef.current.applyOptions({
        priceFormat: {
          type: "price",
          precision: mid < 0.0001 ? 10 : mid < 0.01 ? 8 : mid < 1 ? 6 : 4,
          minMove: minMoveFor(mid),
        },
      });

      priceChartRef.current?.applyOptions({
        timeScale: { secondsVisible: SHORT_TF.has(timeframe) },
      });

      candleSeriesRef.current.setData(
        candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })),
      );

      const timeScale = priceChartRef.current?.timeScale();
      if (timeScale) {
        timeScale.applyOptions({
          barSpacing: 15, // standard, professional uniform width spacing for candles
          rightOffset: 6,
        });
      }
      isInitialSetRef.current = true;
    } else {
      // 2. Incremental real-time updates from socket (preserves zoom/scroll/pan coordinates)
      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        candleSeriesRef.current.update({
          ...lastCandle,
          time: lastCandle.time as UTCTimestamp,
        });
      }
    }
  }, [candles, timeframe]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-[rgba(11,14,17,0.75)] flex items-center justify-center z-20">
          <div className="spinner" />
        </div>
      )}
      <div
        ref={tooltipRef}
        className="absolute top-2 left-2 z-10 bg-[rgba(18,22,26,0.92)] border border-[#2a2e39] rounded-md px-2.5 py-1.5 text-[11px] pointer-events-none hidden leading-relaxed"
      />
      <div ref={priceRef} className="flex-1 w-full h-full min-w-0" />
    </div>
  );
}
