"use client";

import { TokenInfo } from "@/lib/api";

interface Props {
  tokens: TokenInfo[];
  activeMint: string | null;
  onSelect: (mint: string) => void;
  query?: string;
}

function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 0) return "";
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function parseLogo(uri?: string): string {
  if (!uri) return "";
  if (/^https?:\/\//.test(uri)) return uri;
  try {
    const j = JSON.parse(uri);
    if (j.image) return j.image;
  } catch {}
  return "";
}

export default function TokenList({
  tokens,
  activeMint,
  onSelect,
  query,
}: Props) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-xs text-[#5e6673]">
        <div>No tokens found</div>
        {query && (
          <>
            <div className="text-center text-[10px] break-all text-[#848e9c]">
              {query}
            </div>
            <button
              onClick={() => onSelect(query)}
              className="px-4 py-1.5 rounded bg-[#0ecb81] text-[#0b0e11] font-semibold text-xs hover:bg-[#0aad6c] transition"
            >
              Load Chart
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {tokens.map((t) => {
        const ago = timeAgo(t.timestamp);
        const logo = parseLogo(t.uri);
        const initial = (t.symbol || t.name || "?").charAt(0).toUpperCase();
        return (
          <div
            key={t.mint}
            className={`token-row flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-[#1e2329] text-xs ${t.mint === activeMint ? "active" : ""}`}
            onClick={() => onSelect(t.mint)}
          >
            <div className="w-7 h-7 rounded-full bg-[#1e2329] flex items-center justify-center shrink-0 overflow-hidden relative">
              {logo && (
                <img
                  src={logo}
                  className="w-7 h-7 rounded-full object-cover"
                  alt=""
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              )}
              {!logo && (
                <span className="text-[10px] font-bold text-[#0ecb81]">
                  {initial}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[#d1d4dc] truncate flex items-center gap-1.5">
                <span className="truncate">
                  {t.name || t.mint.slice(0, 8) + "..."}
                </span>
                {t.is_graduated && (
                  <span className="bg-[#0ecb81]/15 text-[#0ecb81] text-[9px] px-1 rounded font-semibold leading-none scale-[0.85] origin-left shrink-0">
                    GRAD
                  </span>
                )}
              </div>
              <div className="text-[#5e6673] truncate">{t.symbol || "--"}</div>
            </div>
            {ago && (
              <div className="text-right shrink-0 text-[9px] text-[#888] leading-tight">
                {ago}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
