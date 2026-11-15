"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

export class AdminApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Call /api/admin/* with the signed-in user's token. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useDomainQStore.getState().token;
  const res = await fetch(`${API_BASE_URL}/api/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new AdminApiError(res.status, message || `Request failed (${res.status})`);
  }
  return body as T;
}

/** GET an admin resource; refetches every `refreshMs` when given. */
export function useAdminQuery<T>(key: QueryKey, path: string, refreshMs?: number) {
  const token = useDomainQStore((s) => s.token);
  return useQuery({
    queryKey: ["admin", ...key],
    queryFn: () => adminFetch<T>(path),
    enabled: !!token,
    refetchInterval: refreshMs,
  });
}

/** POST/PUT/DELETE an admin resource, then refresh the listed queries. */
export function useAdminMutation<TBody, TResult = unknown>(
  method: "POST" | "PUT" | "DELETE",
  path: string | ((body: TBody) => string),
  invalidate: QueryKey[] = []
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      adminFetch<TResult>(typeof path === "function" ? path(body) : path, {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
      }),
    onSuccess: () =>
      Promise.all(invalidate.map((k) => client.invalidateQueries({ queryKey: ["admin", ...k] }))),
  });
}

export const usd = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const num = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);

export const when = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

export function ago(d: string | Date | null | undefined): string {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
