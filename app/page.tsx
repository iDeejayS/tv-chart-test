"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTokens } from "@/hooks/useTokens";
import { useOHLCV } from "@/hooks/useOHLCV";
import TokenList from "@/components/TokenList";
import TokenInfoBar from "@/components/TokenInfoBar";
import TradeHistory from "@/components/TradeHistory";
import OHLCVChart, { type OHLCVChartRef } from "@/components/OHLCVChart";

const TIMEFRAMES = [
  "1s",
  "1m",
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "4h",
  "1d",
];

export default function DashboardPage() {
  const params = useParams();
  const urlMint = typeof params?.mint === "string" ? params.mint : null;

  const [activeMint, setActiveMint] = useState<string | null>(urlMint);
  const [activeTimeframe, setActiveTimeframe] = useState("1s");
  const [activeSort, setActiveSort] = useState("latest");
  const [activeSource, setActiveSource] = useState("pg");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayQuery, setDisplayQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(!urlMint);
  const [timezone, setTimezone] = useState<string | number>("local");
  const chartRef = useRef<OHLCVChartRef>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const {
    tokens,
    loading: tokensLoading,
    error: tokensError,
    reload: reloadTokens,
    search,
  } = useTokens(activeSort);

  const activeToken =
    tokens.find((t) => t.mint === activeMint) ?? tokens[0] ?? null;

  const {
    candles,
    solPrice,
    loading: chartLoading,
    reload: reloadOHLCV,
    isSocketConnected,
  } = useOHLCV(
    activeToken?.is_graduated ? activeMint : null,
    activeTimeframe,
    activeSource,
  );

  useEffect(() => {
    if (urlMint) {
      setActiveMint(urlMint);
      setSidebarOpen(false);
      setSearchQuery(urlMint);
      setDisplayQuery(urlMint);
      search(urlMint);
    }
  }, [urlMint, search]);

  useEffect(() => {
    if (!activeMint && tokens.length > 0 && !urlMint) {
      setActiveMint(tokens[0].mint);
    }
  }, [tokens, activeMint, urlMint]);

  const [chartHeight, setChartHeight] = useState(300); // initial height in pixels

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = chartHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = startHeight + deltaY;
        // Keep boundary heights between 150px and 850px
        if (newHeight >= 150 && newHeight <= 850) {
          setChartHeight(newHeight);
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [chartHeight],
  );

  const handleSortChange = (mode: string) => {
    setActiveSort(mode);
    setSearchQuery("");
    setDisplayQuery("");
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (q.length === 0) {
      search("");
      setDisplayQuery("");
      return;
    }
    if (q.length < 3) return;
    searchTimeout.current = setTimeout(() => {
      search(q);
      setDisplayQuery(q);
    }, 300);
  };

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      search(searchQuery);
      setDisplayQuery(searchQuery);
    }
  }, [searchQuery, search]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setDisplayQuery("");
    clearTimeout(searchTimeout.current);
    search("");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 bg-[#1e2329] border-b border-[#2a2e39] flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0ecb81] to-[#14b8a6]" />
          <span className="font-semibold text-sm tracking-wide">
            SOLANA ANALYTICS
          </span>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-[#848e9c]">
          {solPrice > 0 ? `SOL $${solPrice.toFixed(2)}` : "SOL: --"}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`bg-[#12161a] flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarOpen
              ? "w-72 opacity-100 border-r border-[#2a2e39]"
              : "w-0 opacity-0 border-r-0 pointer-events-none"
          }`}
        >
          <div className="w-72 flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-3 border-b border-[#2a2e39] flex flex-col gap-2">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  placeholder="Search or paste mint…"
                  onChange={handleSearchInput}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                  className="w-full bg-[#1e2329] border border-[#2a2e39] rounded px-3 py-1.5 pr-14 text-sm text-[#d1d4dc] outline-none focus:border-[#0ecb81]"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    title="Clear Search"
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-[#f6465d] bg-none border-none cursor-pointer flex items-center justify-center p-1"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleSearchSubmit}
                  title="Search in DB"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-[#0ecb81] bg-none border-none cursor-pointer flex items-center justify-center p-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
              {/* Sort buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleSortChange("latest")}
                  className={`flex-1 py-1 rounded text-[10px] font-semibold ${activeSort === "latest" ? "bg-[#0ecb81] text-[#0b0e11]" : "text-[#848e9c] bg-[#1e2329]"}`}
                >
                  Latest
                </button>
                <button
                  onClick={() => handleSortChange("circulating")}
                  className={`flex-1 py-1 rounded text-[10px] font-semibold ${activeSort === "circulating" ? "bg-[#0ecb81] text-[#0b0e11]" : "text-[#848e9c] bg-[#1e2329]"}`}
                >
                  Top
                </button>
              </div>
            </div>
            {/* Token list */}
            <div className="flex-1 overflow-y-auto">
              {tokensLoading ? (
                <div className="flex items-center justify-center h-32 text-xs text-[#5e6673]">
                  Loading tokens…
                </div>
              ) : tokensError ? (
                <div className="flex items-center justify-center h-32 text-xs text-[#f6465d]">
                  {tokensError}
                </div>
              ) : (
                <TokenList
                  tokens={tokens}
                  activeMint={activeMint}
                  onSelect={setActiveMint}
                  query={displayQuery}
                />
              )}
            </div>
          </div>
        </aside>

        {/* Sleek Vertical Divider Gutter (Separator & Toggle Action) */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="w-1.5 bg-[#12161a] border-r border-l border-[#2a2e39] flex items-center justify-center   cursor-pointer hover:bg-[#0ecb81]/15 active:bg-[#0ecb81]/30 transition-all group shrink-0 relative"
            title="Click to Collapse Token List"
          >
            {/* Centered vertical grab indicator dots */}
            <div className="flex flex-col gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-1 bg-[#848e9c] rounded-full" />
              <div className="w-1 h-1 bg-[#848e9c] rounded-full" />
              <div className="w-1 h-1 bg-[#848e9c] rounded-full" />
            </div>
            {/* Center collapsing arrow floating tab */}
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-[#12161a] border border-[#2a2e39] group-hover:border-[#0ecb81] w-5 h-20 rounded flex items-center justify-center shadow-md z-10 transition-colors pointer-events-none">
              <svg
                className="w-3 h-3 text-[#848e9c] group-hover:text-[#0ecb81] transition-colors"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Chart Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Elegant Floating Handle on the left edge of Main Content to re-expand list */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-[#12161a] border border-l-0 border-[#2a2e39] hover:border-[#0ecb81] text-[#848e9c] hover:text-[#0ecb81] w-8 h-20 rounded-r flex items-center justify-center transition-all shadow-md group shrink-0"
              title="Expand Token List"
            >
              <svg
                className="w-3.5 h-3.5 group-hover:translate-x-[1px] transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
          <TokenInfoBar
            mint={activeMint}
            token={activeToken}
            candles={candles}
            solPrice={solPrice}
            isSocketConnected={isSocketConnected}
          />

          {/* Timeframe + Source */}
          <div className="h-10 bg-[#12161a] border-b border-[#2a2e39] flex items-center px-3 gap-1 shrink-0">
            <span className="text-xs text-[#5e6673] mr-1">TF</span>
            <div className="flex gap-1 flex-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={`tf-btn px-2 py-1 rounded text-xs font-medium ${tf === activeTimeframe ? "active" : "text-[#848e9c]"}`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Timezone and Navigation Controls */}
            <div className="flex items-center gap-1.5 border-l border-[#2a2e39] pl-2 mr-1.5">
              <select
                value={timezone}
                onChange={(e) => {
                  const val = e.target.value;
                  setTimezone(val === "local" ? "local" : Number(val));
                }}
                className="bg-[#1e2329] text-[#848e9c] hover:text-[#d1d4dc] text-[10px] font-bold rounded px-1.5 py-0.5 outline-none border border-[#2a2e39] cursor-pointer"
                title="Select Chart Timezone"
              >
                <option value="local">LOCAL</option>
                <option value="0">UTC</option>
                <option value="1">UTC+1</option>
                <option value="2">UTC+2</option>
                <option value="3">UTC+3</option>
                <option value="5.5">UTC+5:30</option>
                <option value="8">UTC+8</option>
                <option value="9">UTC+9</option>
                <option value="-5">UTC-5</option>
                <option value="-8">UTC-8</option>
              </select>

              {/* Move Prev */}
              <button
                onClick={() => chartRef.current?.scrollLeft()}
                className="p-1 text-[#848e9c] hover:text-[#0ecb81] transition-colors rounded hover:bg-[#1e2329]"
                title="Move Backward (Left)"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </button>

              {/* Move Next */}
              <button
                onClick={() => chartRef.current?.scrollRight()}
                className="p-1 text-[#848e9c] hover:text-[#0ecb81] transition-colors rounded hover:bg-[#1e2329]"
                title="Move Forward (Right)"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>

              {/* Zoom In */}
              <button
                onClick={() => chartRef.current?.zoomIn()}
                className="p-1 text-[#848e9c] hover:text-[#0ecb81] transition-colors rounded hover:bg-[#1e2329]"
                title="Zoom In"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>

              {/* Zoom Out */}
              <button
                onClick={() => chartRef.current?.zoomOut()}
                className="p-1 text-[#848e9c] hover:text-[#0ecb81] transition-colors rounded hover:bg-[#1e2329]"
                title="Zoom Out"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 12h-15"
                  />
                </svg>
              </button>

              {/* Reset / Refresh */}
              <button
                onClick={() => {
                  chartRef.current?.resetView();
                }}
                className="p-1 text-[#848e9c] hover:text-[#0ecb81] transition-colors rounded hover:bg-[#1e2329] flex items-center justify-center"
                title="Refresh Chart Data & Reset Zoom"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
            </div>

            <div className="flex gap-1 ml-2 border-l border-[#2a2e39] pl-2">
              <button
                onClick={() => setActiveSource("pg")}
                className={`src-btn ${activeSource === "pg" ? "active" : "text-[#848e9c] bg-[#1e2329]"}`}
              >
                PG
              </button>
              <button
                onClick={() => setActiveSource("ch")}
                className={`src-btn ${activeSource === "ch" ? "active" : "text-[#848e9c] bg-[#1e2329]"}`}
              >
                CH
              </button>
            </div>
          </div>

          {activeMint ? (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Chart container with dynamic adjustable height */}
              <div
                style={{ height: `${chartHeight}px` }}
                className="shrink-0 flex flex-col overflow-hidden"
              >
                {!activeToken ? (
                  <div className="flex-1 bg-[#0b0e11] flex flex-col items-center justify-center text-center p-6 select-none border-b border-[#2a2e39]">
                    <div className="text-[#848e9c] text-xs font-medium">
                      {tokensLoading ? "Loading chart…" : "Token not found"}
                    </div>
                  </div>
                ) : !activeToken.is_graduated ? (
                  <div className="flex-1 bg-[#0b0e11] flex flex-col items-center justify-center text-center px-6 gap-2 border-b border-[#2a2e39] select-none">
                    <span className="text-3xl">🎓</span>
                    <h3 className="text-sm font-semibold text-[#d1d4dc] uppercase tracking-wider">
                      Token is not graduated yet
                    </h3>
                    <p className="text-xs text-[#5e6673] max-w-sm leading-relaxed">
                      This token has not met the graduation threshold. Live
                      candlestick charts are only available for graduated coins.
                    </p>
                  </div>
                ) : (
                  <OHLCVChart
                    ref={chartRef}
                    key={`${activeMint}_${activeTimeframe}_${activeSource}`}
                    candles={candles}
                    timeframe={activeTimeframe}
                    loading={chartLoading}
                    chartHeight={chartHeight}
                    onRefresh={reloadOHLCV}
                    timezone={timezone}
                  />
                )}
              </div>

              {/* Adjustable split drag handle divider */}
              <div
                onMouseDown={handleMouseDown}
                className="h-2 bg-[#2a2e39] hover:bg-[#0ecb81] active:bg-[#0ecb81] cursor-row-resize shrink-0 transition-colors flex items-center justify-center gap-1"
                title="Drag up or down to resize panels"
              >
                <div className="w-8 h-[2px] bg-[#5e6673]/60 rounded-full" />
              </div>

              {/* Trade History container - expands to fill the remainder */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TradeHistory
                  mint={activeMint}
                  symbol={activeToken?.symbol || null}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#5e6673]">
              Select a token to view chart
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
