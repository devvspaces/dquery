"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { ago, num, useAdminMutation, useAdminQuery, when } from "@/lib/admin-api";

interface Registrar {
  id: string;
  name: string;
  configured: boolean;
  enabled: boolean;
  checksAvailability: boolean;
  publishesCatalog: boolean;
  checkOrder: number | null;
  tldCount: number;
  manualPrices: number;
  pricesUpdatedAt: string | null;
  lastSync: { ok: boolean; count: number; error: string | null; startedAt: string; durationMs: number } | null;
  api24h: { calls: number; successRate: number; p50Ms: number; p95Ms: number } | null;
}

interface SyncRun {
  id: string;
  registrar: string;
  ok: boolean;
  count: number;
  error: string | null;
  startedAt: string;
  durationMs: number;
}

export default function AdminRegistrars() {
  const { data, isLoading, error } = useAdminQuery<Registrar[]>(["registrars"], "/registrars", 30_000);
  const runs = useAdminQuery<SyncRun[]>(["sync-runs"], "/registrars/sync-runs", 15_000);
  const sync = useAdminMutation<{ registrars?: string[] }, { jobId: string }>("POST", "/registrars/sync", [["sync-runs"], ["registrars"]]);

  const runSync = async (ids?: string[]) => {
    try {
      await sync.mutateAsync({ registrars: ids });
      toast.success(`Sync queued for ${ids?.join(", ") ?? "all registrars"}. Results appear below in a minute.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrars"
        description="Health of each registrar integration. Enable/disable and check order live in Settings."
        actions={<Button size="sm" onClick={() => runSync()} disabled={sync.isPending}>Sync all prices</Button>}
      />
      <Panel>
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <DataTable head={["Registrar", "Status", "Role", "Catalog", "Last sync", "API (24h)", ""]}>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                </td>
                <td className="space-x-1 px-3 py-2">
                  {!r.configured ? (
                    <StatusBadge tone="muted">No API key</StatusBadge>
                  ) : r.enabled ? (
                    <StatusBadge tone="ok">Enabled</StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">Disabled</StatusBadge>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[r.checksAvailability && `checker${r.checkOrder ? ` #${r.checkOrder}` : ""}`, r.publishesCatalog && "price list"]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.tldCount ? (
                    <>
                      <span className="tabular-nums">{num(r.tldCount)} TLDs</span>
                      {r.manualPrices > 0 && <span className="text-muted-foreground"> · {r.manualPrices} manual</span>}
                      <div className="text-muted-foreground">updated {ago(r.pricesUpdatedAt)}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.lastSync ? (
                    <>
                      <StatusBadge tone={r.lastSync.ok ? "ok" : "bad"}>{r.lastSync.ok ? `${r.lastSync.count} prices` : "Failed"}</StatusBadge>
                      <div className="mt-0.5 text-muted-foreground" title={r.lastSync.error ?? undefined}>
                        {ago(r.lastSync.startedAt)}
                        {r.lastSync.error && ` · ${r.lastSync.error.slice(0, 60)}`}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{r.publishesCatalog ? "not synced yet" : "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {r.api24h ? (
                    <>
                      <StatusBadge tone={r.api24h.successRate >= 95 ? "ok" : r.api24h.successRate >= 80 ? "warn" : "bad"}>
                        {r.api24h.successRate}% ok
                      </StatusBadge>
                      <div className="mt-0.5 text-muted-foreground">
                        {num(r.api24h.calls)} calls · p95 {num(r.api24h.p95Ms)} ms
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">no calls</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.publishesCatalog && r.configured && (
                    <Button size="sm" variant="outline" onClick={() => runSync([r.id])} disabled={sync.isPending}>
                      Sync now
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <Panel title="Sync history">
        <QueryState isLoading={runs.isLoading} error={runs.error} />
        {runs.data && (
          <DataTable head={["When", "Registrar", "Result", "Duration", "Error"]} empty={runs.data.length === 0}>
            {runs.data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-muted-foreground">{when(r.startedAt)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.registrar}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={r.ok ? "ok" : "bad"}>{r.ok ? `${r.count} prices` : "failed"}</StatusBadge>
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{(r.durationMs / 1000).toFixed(1)} s</td>
                <td className="max-w-md truncate px-3 py-2 text-xs text-muted-foreground" title={r.error ?? undefined}>{r.error ?? ""}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
