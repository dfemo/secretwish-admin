"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Thin client for the SecretWish .NET API. All business rules (status transitions, payout
 * eligibility, privacy masking) live on the server; screens only render what the API returns.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

let demoUserId: string | null = null;
let accessToken: (() => Promise<string | null>) | null = null;

/** Demo mode only: identifies the chosen demo persona to the API when nobody is signed in. */
export function setDemoUser(id: string | null) {
  demoUserId = id;
}

/** Set by the session: returns the signed-in account's access token (refreshing it when it has expired). */
export function setAccessTokenProvider(provider: (() => Promise<string | null>) | null) {
  accessToken = provider;
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  const token = demoUserId ? null : await accessToken?.();
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : demoUserId ? { "X-Demo-User": demoUserId } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach the SecretWish API. Is the backend running on " + API_URL + "?", 0);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const errors = data?.errors as Record<string, string[]> | undefined;
    const first = errors ? Object.values(errors)[0]?.[0] : undefined;
    const message =
      res.status === 429 ? "Too many attempts. Please wait a minute and try again." : (data?.detail ?? first ?? data?.title ?? `Request failed (${res.status})`);
    throw new ApiError(message, res.status, errors);
  }
  return data as T;
}

// ---- Global invalidation: after any mutation, every mounted query refetches. ----
let version = 0;
const listeners = new Set<() => void>();
export function invalidate() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApi<T>(path: string | null) {
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === latest.current) setError(e as ApiError);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load, v]);

  return { data, error, loading: loading && data === undefined, refreshing: loading, reload: load, setData };
}

/** One page of a server-side list (see Backend Services/Paging.cs). `total` stops at 10,000; `totalCapped` says there are more. */
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalCapped?: boolean; counts?: Record<string, number> };

type ParamValue = string | number | boolean | null | undefined;

/**
 * A server-paged, searchable list. Search is debounced, and the list goes back to page 1 whenever the
 * search text or any filter in `params` changes. The previous page stays on screen while the next loads.
 */
export function usePagedApi<T>(path: string | null, params: Record<string, ParamValue> = {}, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const filters = JSON.stringify(params);
  useEffect(() => setPage(1), [debounced, filters]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  if (debounced) qs.set("search", debounced);
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  const result = useApi<Paged<T>>(path ? `${path}?${qs}` : null);
  return { ...result, items: result.data?.items, page, setPage, search, setSearch };
}

/** Runs a mutation, tracks pending state, and refreshes all queries on success. */
export function useMutation<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setPending(true);
      setError(null);
      try {
        const r = await fn(...args);
        invalidate();
        return r;
      } catch (e) {
        setError(e as ApiError);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, setError };
}
