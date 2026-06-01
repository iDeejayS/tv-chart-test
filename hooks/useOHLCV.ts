"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchOHLCV, OHLCVCandle } from "@/lib/api";
import { getSocketIo, joinCoinRoom, leaveCoinRoom } from "@/lib/socket";

export function useOHLCV(
  mint: string | null,
  timeframe: string,
  source: string,
) {
  const [candles, setCandles] = useState<OHLCVCandle[]>([]);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevMintRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!mint) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOHLCV(mint, timeframe, 300, source);
      const valid = (data.candles || [])
        .map((c) => ({
          ...c,
          time: Math.floor(Number(c.time)),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume_sol: Number(c.volume_sol) || 0,
          volume_token: Number(c.volume_token) || 0,
          trades: Number(c.trades) || 0,
        }))
        .filter(
          (c) =>
            c.time > 0 &&
            isFinite(c.open) &&
            isFinite(c.high) &&
            isFinite(c.low) &&
            isFinite(c.close),
        )
        .sort((a, b) => a.time - b.time);
      setCandles(valid);
      setSolPrice(data.sol_price ?? 0);
    } catch {
      setError("Failed to load OHLCV data");
    } finally {
      setLoading(false);
    }
  }, [mint, timeframe, source]);

  useEffect(() => {
    setCandles([]);
    load();
  }, [load]);

  useEffect(() => {
    if (!mint) return;

    if (prevMintRef.current && prevMintRef.current !== mint) {
      leaveCoinRoom(prevMintRef.current);
    }
    prevMintRef.current = mint;
    joinCoinRoom(mint);

    const sio = getSocketIo();

    const handleTradeUpdated = (data: any) => {
      try {
        if (data.mint?.toLowerCase() !== mint?.toLowerCase()) return;

        // Parse ISO timestamp string to Unix Epoch ms
        const tsMs = Date.parse(data.timestamp);
        if (isNaN(tsMs)) return;

        const tfSeconds = timeframeToSeconds(timeframe);
        const bucketTime = Math.floor(tsMs / 1000 / tfSeconds) * tfSeconds;

        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];

          if (last.time === bucketTime) {
            const updated = {
              ...last,
              high: Math.max(last.high, data.currentPrice),
              low: Math.min(last.low, data.currentPrice),
              close: data.currentPrice,
              volume_sol: last.volume_sol + data.solAmount,
            };
            return [...prev.slice(0, -1), updated];
          } else if (bucketTime > last.time) {
            const newCandle: OHLCVCandle = {
              time: bucketTime,
              open: data.price == 0 ? data.currentPrice : data.price,
              high: data.currentPrice,
              low: Math.min(data.price, data.currentPrice),
              close: data.currentPrice,
              volume_sol: data.solAmount,
              volume_token: data.tokenAmount,
              trades: 1,
            };
            return [...prev, newCandle];
          }
          return prev;
        });
      } catch {}
    };

    sio.on("TradeUpdated", handleTradeUpdated);

    return () => {
      sio.off("TradeUpdated", handleTradeUpdated);
      if (prevMintRef.current) {
        leaveCoinRoom(prevMintRef.current);
        prevMintRef.current = null;
      }
    };
  }, [mint, timeframe]);

  return { candles, solPrice, loading, error, reload: load };
}

function timeframeToSeconds(tf: string): number {
  const map: Record<string, number> = {
    "1s": 1,
    "1m": 60,
    "2m": 120,
    "3m": 180,
    "5m": 300,
    "10m": 600,
    "15m": 900,
    "30m": 1800,
    "45m": 2700,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
  };
  return map[tf] ?? 60;
}
