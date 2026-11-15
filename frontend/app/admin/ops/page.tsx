"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { num, useAdminMutation, useAdminQuery, when } from "@/lib/admin-api";

interface QueueStatus {
  queues: Array<{ name: string; counts: Record<string, number> }>;
  recentFailures: Array<{ jobId: string; queue: string; jobType: string; userId: string | null; error: string | null; creditsDeducted: string | null; creditsRefunded: string | null; createdAt: string }>;
}
interface Payment {
  id: string;
  email: string | null;
  provider: string | null;
  reference: string | null;
  packId: string | null;
  amount: number | null;
  currency: string | null;
  credits: number;
  status: string;
  createdAt: string;
}
interface AuditRow {
  id: string;
  adminEmail: string;
  action: string;
  target: string | null;
  details: unknown;
  createdAt: string;
}

export default function AdminOps() {
  const queues = useAdminQuery<QueueStatus>(["queues"], "/ops/queues", 10_000);
  const [status, setStatus] = useState("");
  const payments = useAdminQuery<{ total: number; data: Payment[] }>(["payments", status], `/payments?limit=100${status ? `&status=${status}` : ""}`);
  const audit = useAdminQuery<AuditRow[]>(["audit"], "/audit?limit=100");
  const retry = useAdminMutation<{ queue: string; jobId: string }>("POST", (b) => `/ops/queues/${b.queue}/jobs/${b.jobId}/retry`, [["queues"]]);

  return (
    <div className="space-y-6">
      <PageHeader title="Operations" description="Background jobs, payments and the admin audit trail." />
      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-4">
          <QueryState isLoading={queues.isLoading} error={queues.error} />
          {queues.data && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {queues.data.queues.map((q) => (
                  <Panel key={q.name} title={q.name}>
                    <dl className="grid grid-cols-5 gap-1 text-center text-xs">
                      {["waiting", "active", "delayed", "completed", "failed"].map((k) => (
                        <div key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className={`text-base font-semibold tabular-nums ${k === "failed" && q.counts[k] ? "text-destructive" : "text-foreground"}`}>
                            {num(q.counts[k] ?? 0)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Panel>
                ))}
              </div>
              <Panel title="Recent failures">
                <DataTable head={["When", "Job", "User", "Credits", "Error", ""]} empty={queues.data.recentFailures.length === 0}>
                  {queues.data.recentFailures.map((f) => (
                    <tr key={f.jobId}>
                      <td className="px-3 py-2 text-muted-foreground">{when(f.createdAt)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{f.jobType}<div className="text-muted-foreground">{f.jobId}</div></td>
                      <td className="px-3 py-2 font-mono text-xs">{f.userId?.slice(0, 8) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">
                        −{f.creditsDeducted ?? 0}
                        {f.creditsRefunded && <span className="text-success"> / +{f.creditsRefunded}</span>}
                      </td>
                      <td className="max-w-sm truncate px-3 py-2 text-xs text-muted-foreground" title={f.error ?? undefined}>{f.error}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={async () => {
                            try {
                              await retry.mutateAsync({ queue: f.queue, jobId: f.jobId });
                              toast.success("Job re-queued");
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </Panel>
            </>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Panel
            title="Payments"
            actions={
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status" className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            }
          >
            <QueryState isLoading={payments.isLoading} error={payments.error} />
            {payments.data && (
              <DataTable head={["When", "User", "Pack", "Amount", "Credits", "Status", "Reference"]} empty={payments.data.data.length === 0}>
                {payments.data.data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-muted-foreground">{when(p.createdAt)}</td>
                    <td className="px-3 py-2">{p.email ?? "—"}</td>
                    <td className="px-3 py-2">{p.packId ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{p.amount != null ? `${p.amount} ${p.currency}` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{num(p.credits)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={p.status === "completed" ? "ok" : p.status === "failed" ? "bad" : "warn"}>{p.status}</StatusBadge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.reference}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="audit">
          <Panel title="Admin actions">
            <QueryState isLoading={audit.isLoading} error={audit.error} />
            {audit.data && (
              <DataTable head={["When", "Admin", "Action", "Target", "Details"]} empty={audit.data.length === 0}>
                {audit.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-muted-foreground">{when(a.createdAt)}</td>
                    <td className="px-3 py-2 text-xs">{a.adminEmail}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.target ?? "—"}</td>
                    <td className="max-w-md truncate px-3 py-2 font-mono text-[11px] text-muted-foreground" title={JSON.stringify(a.details)}>
                      {a.details ? JSON.stringify(a.details) : ""}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
