"use client";

import { OHLCVCandle } from "@/lib/api";
import { TokenInfo } from "@/lib/api";

interface Props {
  mint: string | null;
  token: TokenInfo | null;
  candles: OHLCVCandle[];
  solPrice: number;
  isSocketConnected?: boolean;
}

function fmtPrice(p: number): string {
  if (!p || !isFinite(p)) return "—";
  return "$" + p;
}

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n).toFixed(2);
}

function renderCryptoPrice(p: number, isSol: boolean = false) {
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
        <span className="font-mono font-bold">
          {isSol ? "" : "$"}0.0
          <sub className="text-[11px] font-bold mx-0.5 align-baseline relative -bottom-[0.2em]">
            {zeroCount}
          </sub>
          {significantDigits}
          {isSol ? " SOL" : ""}
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
    <span className="font-mono font-bold">
      {isSol ? "" : "$"}
      {formattedPrice}
      {isSol ? " SOL" : ""}
    </span>
  );
}

async function copyMint(mint: string) {
  try {
    await navigator.clipboard.writeText(mint);
  } catch {}
}

export default function TokenInfoBar({
  mint,
  token,
  candles,
  solPrice,
  isSocketConnected = false,
}: Props) {
  if (!mint) {
    return (
      <div className="h-14 bg-[#12161a] border-b border-[#2a2e39] flex items-center px-4 shrink-0">
        <div className="text-sm text-[#5e6673]">
          Select a token to view chart
        </div>
      </div>
    );
  }
  const name = token?.name || mint.slice(0, 8) + "...";
  const symbol = token?.symbol || "?";
  const supply = Number(token?.supply || 0);

  const last = candles.length ? candles[candles.length - 1] : null;
  const first = candles.length ? candles[0] : null;
  const price = last?.close ?? 0;
  const change = last && first ? last.close - first.open : 0;
  const changePct = first?.open
    ? ((change / first.open) * 100).toFixed(2)
    : "0.00";
  const changeColor = change >= 0 ? "#0ecb81" : "#f6465d";
  const changeSign = change >= 0 ? "+" : "";
  const mcap = supply && price ? supply * price : 0;
  const totalVolSol = candles.reduce((s, c) => s + c.volume_sol, 0);
  const totalTrades = candles.reduce((s, c) => s + c.trades, 0);
  const volUsd = totalVolSol * solPrice;

  return (
    <div className="h-14 bg-[#12161a] border-b border-[#2a2e39] flex items-center px-4 gap-6 shrink-0">
      <div className="leading-tight">
        <div className="font-semibold text-sm flex items-center gap-1.5">
          {name} <span className="text-[#5e6673] font-normal">{symbol}</span>
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isSocketConnected ? "bg-[#0ecb81] animate-pulse" : "bg-[#f6465d]"
            }`}
            title={
              isSocketConnected
                ? "Live trade updates connected"
                : "Websocket disconnected. Reconnecting..."
            }
          />
        </div>
        <div className="text-[12px] text-[#5e6673] font-mono flex items-center gap-1">
          {mint.slice(0, 6)}…{mint.slice(-4)}
          <button
            onClick={() => copyMint(mint)}
            className="text-[#5e6673] hover:text-[#0ecb81]  leading-none"
            title="Copy mint"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 448 512"
              focusable="false"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Copy token address</title>
              <path d="M433.941 65.941l-51.882-51.882A48 48 0 0 0 348.118 0H176c-26.51 0-48 21.49-48 48v48H48c-26.51 0-48 21.49-48 48v320c0 26.51 21.49 48 48 48h224c26.51 0 48-21.49 48-48v-48h80c26.51 0 48-21.49 48-48V99.882a48 48 0 0 0-14.059-33.941zM266 464H54a6 6 0 0 1-6-6V150a6 6 0 0 1 6-6h74v224c0 26.51 21.49 48 48 48h96v42a6 6 0 0 1-6 6zm128-96H182a6 6 0 0 1-6-6V54a6 6 0 0 1 6-6h106v88c0 13.255 10.745 24 24 24h88v202a6 6 0 0 1-6 6zm6-256h-64V48h9.632c1.591 0 3.117.632 4.243 1.757l48.368 48.368a6 6 0 0 1 1.757 4.243V112z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="border-l border-[#2a2e39] h-8 mx-1 shrink-0" />
      <div className="leading-tight shrink-0">
        <div className="text-[10px] text-[#5e6673] uppercase font-semibold tracking-wider">
          Price USD
        </div>
        <div className="text-sm">
          {renderCryptoPrice(price * (solPrice || 1), false)}
        </div>
      </div>

      <div className="border-l border-[#2a2e39] h-8 mx-1 shrink-0" />
      <div className="leading-tight shrink-0">
        <div className="text-[10px] text-[#5e6673] uppercase font-semibold tracking-wider">
          Price
        </div>
        <div className="text-sm">{renderCryptoPrice(price, true)}</div>
      </div>

      <div className="border-l border-[#2a2e39] h-8 mx-1 shrink-0" />
      {/* <div className="leading-tight shrink-0">
        <div className="text-[10px] text-[#5e6673] uppercase font-semibold tracking-wider">
          24h Change
        </div>
        <div className="text-xs font-semibold" style={{ color: changeColor }}>
          {changeSign}
          {changePct}%
        </div>
      </div> */}
      <div className="flex-1" />
      {/* <div className="text-right text-xs text-[#848e9c] leading-tight">
        <div>
          Vol&nbsp;<span className="text-[#d1d4dc]">${fmtNum(volUsd)}</span>
          &nbsp;
          <span className="text-[#5e6673]">{fmtNum(totalVolSol)} SOL</span>
        </div>
        <div>
          Trades&nbsp;
          <span className="text-[#d1d4dc]">{fmtNum(totalTrades)}</span>
        </div>
      </div>
      {mcap > 0 && (
        <>
          <div className="border-l border-[#2a2e39] h-8 mx-1" />
          <div className="text-right text-xs text-[#848e9c] leading-tight">
            <div className="text-[10px]">MCap</div>
            <div className="text-[#d1d4dc]">${fmtNum(mcap)}</div>
          </div>
        </>
      )} */}
    </div>
  );
}
