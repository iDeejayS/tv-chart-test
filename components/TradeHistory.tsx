"use client";

import { useState, useEffect } from "react";
import { fetchTrades, TradeInfo } from "@/lib/api";
import { getSocketIo, joinCoinRoom, leaveCoinRoom } from "@/lib/socket";

interface Props {
  mint: string | null;
  symbol: string | null;
}

function truncateAddress(addr: string): string {
  if (!addr) return "";
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function formatTime(timestamp: number | string, now: number): string {
  try {
    let t = typeof timestamp === "number" ? timestamp : Number(timestamp);
    if (isNaN(t)) {
      t = Date.parse(timestamp as string);
      if (isNaN(t)) return "—";
    }
    // If epoch is in seconds, convert to ms
    if (t < 9999999999) {
      t = t * 1000;
    }
    const d = new Date(t);
    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const diffSeconds = Math.max(0, Math.floor((now - t) / 1000));
    if (diffSeconds < 60) return `${timeStr} (${diffSeconds}s ago)`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${timeStr} (${diffMinutes}m ago)`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${timeStr} (${diffHours}h ago)`;
    const diffDays = Math.floor(diffHours / 24);
    return `${timeStr} (${diffDays}d ago)`;
  } catch {
    return "—";
  }
}

function renderCryptoPrice(p: number, isSol: boolean = true) {
  if (!p || !isFinite(p) || p <= 0) return "—";

  // Use up to 15 decimal places and trim redundant trailing zeros
  const rawStr = p.toFixed(15);

  // Regex to match consecutive zeros after the decimal point
  const match = rawStr.match(/^0\.(0+)([1-9]\d*)/);
  if (match) {
    const zeros = match[1];
    const remaining = match[2];
    const zeroCount = zeros.length;

    // Use subscript styling for 4 or more leading zeros
    if (zeroCount >= 4) {
      const significantDigits = remaining.slice(0, 4);
      return (
        <span className="font-mono">
          {isSol ? "" : "$"}0.0
          <sub className="text-[10px]  mx-0.5 align-baseline relative -bottom-[0.15em]">
            {zeroCount}
          </sub>
          {significantDigits}
        </span>
      );
    }
  }

  // Fallback for larger numbers (standard display)
  const formattedPrice =
    p >= 1
      ? p.toFixed(4)
      : p < 0.0001
        ? p.toFixed(8).replace(/\.?0+$/, "")
        : p.toFixed(6);

  return (
    <span className="font-mono">
      {isSol ? "" : "$"}
      {formattedPrice}
    </span>
  );
}

function formatTokenAmount(n: number): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function TradeHistory({ mint, symbol }: Props) {
  const [trades, setTrades] = useState<TradeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000); // tick every 5 seconds to keep "ago" time ticking
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mint) {
      setTrades([]);
      return;
    }

    setLoading(true);
    fetchTrades(mint, 50)
      .then((data: TradeInfo[]) => {
        setTrades(data);
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch trades", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Subscribe to standard room
    joinCoinRoom(mint);

    const socket = getSocketIo();

    const handleTradeUpdated = (data: any) => {
      try {
        if (data.mint?.toLowerCase() !== mint?.toLowerCase()) return;

        // Parse incoming real-time socket payload to match standard TradeInfo structure
        const tsMs = Date.parse(data.timestamp);
        const incomingTrade: TradeInfo = {
          trader: data.wallet || "",
          direction: data.direction || "BUY",
          timestamp: isNaN(tsMs) ? Date.now() : tsMs,
          token_amount: data.tokenAmount || 0,
          sol: data.solAmount || 0,
          usd: data.usdAmount || 0,
          price: data.price || 0,
          tx: data.tx || "",
        };

        setTrades((prev) => [incomingTrade, ...prev.slice(0, 49)]);
      } catch (err) {
        console.error("Error handling live trade update", err);
      }
    };

    socket.on("TradeUpdated", handleTradeUpdated);

    return () => {
      socket.off("TradeUpdated", handleTradeUpdated);
      leaveCoinRoom(mint);
    };
  }, [mint]);

  if (!mint) {
    return null;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#12161a] border-t border-[#2a2e39] h-full overflow-hidden">
      <div className="h-8 bg-[#1e2329] border-b border-[#2a2e39] flex items-center px-3 justify-between shrink-0">
        <span className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">
          TRADES
        </span>
        {loading && (
          <span className="text-[10px] text-[#848e9c] animate-pulse">
            Loading...
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="text-[#848e9c] sticky top-0 bg-[#12161a] border-b border-[#2a2e39]  uppercase">
            <tr>
              <th className="px-3 py-1.5 font-medium">Time</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="px-3 py-1.5 font-medium text-right">
                Tokens ({symbol}){" "}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">SOL</th>
              <th className="px-3 py-1.5 font-medium text-right">USD</th>
              <th className="px-3 py-1.5 font-medium text-right">
                Price (SOL)
              </th>
              <th className="px-3 py-1.5 font-medium">Trader</th>
              <th className="px-3 py-1.5 font-medium text-center">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2329] font-mono">
            {trades.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-xs text-[#5e6673]"
                >
                  No trades found for this token
                </td>
              </tr>
            ) : (
              trades.map((t, idx) => {
                const isBuy = t.direction.toUpperCase() === "BUY";
                const directionColor = isBuy
                  ? "text-[#0ecb81]"
                  : "text-[#f6465d]";
                const typeText = isBuy ? "BUY" : "SELL";

                return (
                  <tr
                    key={t.tx + t.timestamp}
                    className={`hover:bg-[#1e2329]/50 transition-colors ${directionColor}`}
                  >
                    <td className="px-3 py-1.5 ">
                      {formatTime(t.timestamp, now)}
                    </td>
                    <td className="px-3 py-1.5 font-bold font-medium">
                      {typeText}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {typeof t.token_amount === "number"
                        ? formatTokenAmount(t.token_amount)
                        : formatTokenAmount(Number(t.token_amount) || 0)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {t.sol.toFixed(4)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {t.usd.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {renderCryptoPrice(t.price, true)}
                    </td>
                    <td className="px-3 py-1.5">{truncateAddress(t.trader)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {t.tx ? (
                        <a
                          href={`https://solscan.io/tx/${t.tx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline  hover:opacity-100 transition-opacity"
                          title="View on Solscan"
                        >
                          <span>{t.tx.slice(0, 6)}</span>
                          <svg
                            className="w-3 h-3 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
