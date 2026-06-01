"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTokens, searchTokens, TokenInfo } from "@/lib/api";
import { getSocketIo } from "@/lib/socket";

export function useTokens(sort: string = "latest") {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokensRef = useRef<TokenInfo[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTokens(sort);
      setTokens(data);
      tokensRef.current = data;
    } catch (e) {
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, [sort]);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setTokens(tokensRef.current);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const results = await searchTokens(query, sort);
        setTokens(results);
      } catch {
        setError("Search failed");
      } finally {
        setLoading(false);
      }
    },
    [sort],
  );

  useEffect(() => {
    load();

    const socket = getSocketIo();
    socket.on("new_token", (data: TokenInfo) => {
      setTokens((prev) => {
        const exists = prev.find((t) => t.mint === data.mint);
        if (exists) return prev;
        const updated = [data, ...prev];
        tokensRef.current = updated;
        return updated;
      });
    });

    return () => {
      socket.off("new_token");
    };
  }, [load]);

  return { tokens, loading, error, reload: load, search };
}
