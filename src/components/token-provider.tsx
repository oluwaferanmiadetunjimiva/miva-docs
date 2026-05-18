"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { tokenScopeKey } from "@/lib/tokenScope";

type TokenContextValue = {
  token?: string;
  setToken: (token?: string) => void;
};

const TokenContext = createContext<TokenContextValue | null>(null);

type Props = {
  initialToken?: string;
  serviceSlug?: string;
  envName?: string;
  children: React.ReactNode;
};

export function TokenProvider({ initialToken, serviceSlug, envName, children }: Props) {
  const scopeKey = serviceSlug && envName ? tokenScopeKey(serviceSlug, envName) : null;

  const token = useSyncExternalStore(
    (onStoreChange) => {
      const notify = () => onStoreChange();
      const onStorage = (e: StorageEvent) => {
        if (e.storageArea !== localStorage) return;
        if (!scopeKey) return;
        if (e.key !== scopeKey) return;
        notify();
      };

      window.addEventListener("storage", onStorage);
      window.addEventListener("miva_docs_token_change", notify);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("miva_docs_token_change", notify);
      };
    },
    () => {
      if (!scopeKey) return initialToken;
      try {
        const v = localStorage.getItem(scopeKey) ?? "";
        const trimmed = v.trim();
        return trimmed ? trimmed : undefined;
      } catch {
        return undefined;
      }
    },
    () => initialToken,
  );

  const setToken = useCallback((next?: string) => {
    const v = next?.trim();
    const normalized = v && v.length > 0 ? v : undefined;
    if (scopeKey) {
      try {
        if (normalized) localStorage.setItem(scopeKey, normalized);
        else localStorage.removeItem(scopeKey);
      } catch {
        // ignore
      }
    }
    window.dispatchEvent(new Event("miva_docs_token_change"));
  }, [scopeKey]);

  useEffect(() => {
    (globalThis as unknown as { token?: string }).token = token;
  }, [token]);

  const value = useMemo<TokenContextValue>(() => ({ token, setToken }), [token, setToken]);

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useToken(): TokenContextValue {
  const ctx = useContext(TokenContext);
  if (!ctx) throw new Error("useToken must be used within TokenProvider");
  return ctx;
}

