const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface TokenInfo {
  mint: string;
  name?: string;
  symbol?: string;
  supply?: number;
  uri?: string;
  timestamp?: number;
  is_graduated?: boolean;
}

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_sol: number;
  volume_token: number;
  trades: number;
}

export interface OHLCVResponse {
  candles: OHLCVCandle[];
  sol_price?: number;
}

export async function fetchTokens(
  sort: string = "latest",
  limit: number = 50,
): Promise<TokenInfo[]> {
  const res = await fetch(`${API_BASE}/api/tokens?sort=${sort}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch tokens");
  return res.json();
}

export async function searchTokens(
  query: string,
  sort: string = "latest",
  limit: number = 50,
): Promise<TokenInfo[]> {
  const res = await fetch(
    `${API_BASE}/api/tokens?search=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}`,
  );
  if (!res.ok) throw new Error("Failed to search tokens");
  return res.json();
}

export async function fetchOHLCV(
  mint: string,
  timeframe: string = "1m",
  limit: number = 300,
  source: string = "pg",
): Promise<OHLCVResponse> {
  const res = await fetch(
    `${API_BASE}/api/tokens/${mint}/ohlcv?timeframe=${timeframe}&limit=${limit}&source=${source}`,
  );
  if (!res.ok) throw new Error("Failed to fetch OHLCV");
  return res.json();
}

export interface TradeInfo {
  trader: string;
  direction: string;
  timestamp: number;
  token_amount: number;
  sol: number;
  usd: number;
  price: number;
  tx: string;
}

export async function fetchTrades(
  mint: string,
  limit: number = 30,
): Promise<TradeInfo[]> {
  const res = await fetch(
    `${API_BASE}/api/tokens/${mint}/trades?limit=${limit}`,
  );
  if (!res.ok) throw new Error("Failed to fetch trades");
  return res.json();
}
