"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
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

export interface OHLCVChartRef {
  zoomIn: () => void;
  zoomOut: () => void;
  scrollLeft: () => void;
  scrollRight: () => void;
  resetView: () => void;
}

interface Props {
  candles: OHLCVCandle[];
  timeframe: string;
  loading: boolean;
  chartHeight?: number;
  onRefresh?: () => void;
  timezone: string | number;
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

const OHLCVChart = forwardRef<OHLCVChartRef, Props>(function OHLCVChart(
  { candles, timeframe, loading, chartHeight, onRefresh, timezone },
  ref,
) {
  const priceRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const isInitialSetRef = useRef(false);

  // Expose imperative handle APIs to parent ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => handleZoom(true),
    zoomOut: () => handleZoom(false),
    scrollLeft: () => handleScroll(-5),
    scrollRight: () => handleScroll(5),
    resetView: () => {
      isInitialSetRef.current = false;
    },
  }));

  // Helper to handle zooming
  const handleZoom = (zoomIn: boolean) => {
    const timeScale = priceChartRef.current?.timeScale();
    if (timeScale) {
      const currentSpacing = timeScale.options().barSpacing;
      const factor = zoomIn ? 1.25 : 1 / 1.25;
      timeScale.applyOptions({
        barSpacing: Math.max(0.5, Math.min(100, currentSpacing * factor)),
      });
    }
  };

  // Helper to handle panning / scrolling
  const handleScroll = (barCount: number) => {
    const timeScale = priceChartRef.current?.timeScale();
    if (timeScale) {
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        timeScale.setVisibleLogicalRange({
          from: range.from + barCount,
          to: range.to + barCount,
        });
      }
    }
  };

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

    isInitialSetRef.current = false; // Reset to refresh chart data completely on timezone/TF toggling

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
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          if (timezone === "local") {
            const pad = (n: number) => n.toString().padStart(2, "0");
            const hours = pad(date.getHours());
            const mins = pad(date.getMinutes());
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());
            return `${date.getFullYear()}-${month}-${day} ${hours}:${mins}`;
          } else {
            const offsetHours = Number(timezone);
            const shiftedDate = new Date((time + offsetHours * 3600) * 1000);
            const pad = (n: number) => n.toString().padStart(2, "0");
            const hours = pad(shiftedDate.getUTCHours());
            const mins = pad(shiftedDate.getUTCMinutes());
            const month = pad(shiftedDate.getUTCMonth() + 1);
            const day = pad(shiftedDate.getUTCDate());
            return `${shiftedDate.getUTCFullYear()}-${month}-${day} ${hours}:${mins}`;
          }
        },
      },
      timeScale: {
        borderColor: "#4a5260", // brighter, clearly visible x-axis border line
        timeVisible: true,
        secondsVisible: SHORT_TF.has(timeframe),
        visible: true,
        tickMarkFormatter: (time: number, tickMarkType: number) => {
          const date = new Date(time * 1000);
          if (timezone === "local") {
            const pad = (n: number) => n.toString().padStart(2, "0");
            const hours = pad(date.getHours());
            const mins = pad(date.getMinutes());
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());

            if (tickMarkType === 0) {
              return date.getFullYear().toString();
            } else if (tickMarkType === 1) {
              return `${date.getFullYear()}-${month}`;
            } else if (tickMarkType === 2) {
              return `${month}-${day}`;
            } else {
              return `${hours}:${mins}`;
            }
          } else {
            // Apply numerical offset (e.g. UTC+1, UTC+5:30)
            const offsetHours = Number(timezone);
            const shiftedDate = new Date((time + offsetHours * 3600) * 1000);

            const pad = (n: number) => n.toString().padStart(2, "0");
            const hours = pad(shiftedDate.getUTCHours());
            const mins = pad(shiftedDate.getUTCMinutes());
            const month = pad(shiftedDate.getUTCMonth() + 1);
            const day = pad(shiftedDate.getUTCDate());

            if (tickMarkType === 0) {
              return shiftedDate.getUTCFullYear().toString();
            } else if (tickMarkType === 1) {
              return `${shiftedDate.getUTCFullYear()}-${month}`;
            } else if (tickMarkType === 2) {
              return `${month}-${day}`;
            } else {
              return `${hours}:${mins}`;
            }
          }
        },
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

      const date = new Date((param.time as number) * 1000);

      if (timezone === "local") {
      } else {
        const offsetHours = Number(timezone);
        const shiftedDate = new Date(
          ((param.time as number) + offsetHours * 3600) * 1000,
        );
        const pad = (n: number) => n.toString().padStart(2, "0");
        const hours = pad(shiftedDate.getUTCHours());
        const mins = pad(shiftedDate.getUTCMinutes());
        const secs = pad(shiftedDate.getUTCSeconds());
        const month = pad(shiftedDate.getUTCMonth() + 1);
        const day = pad(shiftedDate.getUTCDate());
      }

      tooltip.innerHTML = `
        
        <span style="color:${color};font-weight:600">
          O ${fmtPrice(c.open)} &nbsp; H ${fmtPrice(c.high)} &nbsp; L ${fmtPrice(c.low)} &nbsp; C ${fmtPrice(c.close)}
        </span>
      `;
    });

    return () => {
      priceChartRef.current?.remove();
    };
  }, [timeframe, timezone]);

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
  }, [candles, timeframe, timezone]);

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
});

export default OHLCVChart;
