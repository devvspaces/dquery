"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, KpiCard, PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { num, useAdminMutation, useAdminQuery, when } from "@/lib/admin-api";
import { CreditDialog } from "@/components/admin/credit-dialog";

interface Detail {
  user: { id: string; email: string; name: string; provider: string; createdAt: string; suspendedAt: string | null; isAdmin: boolean };
  wallet: { balance: number; totalPurchased: number; totalUsed: number };
  ledger: Array<{ id: string; type: string; amount: number; description: string; balanceAfter: number; createdAt: string }>;
  searches: Array<{ id: string; businessName: string; tlds: string; resultsCount: number; createdAt: string }>;
  generationJobs: Array<{ jobId: string; status: string; error: string | null; creditsDeducted: string | null; creditsRefunded: string | null; createdAt: string }>;
  purchases: Array<{ id: string; packId: string | null; amount: string | null; currency: string | null; status: string; createdAt: string }>;
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useAdminQuery<Detail>(["user", id], `/users/${id}`);
  const invalidate = [["user", id], ["users"]];
  const suspend = useAdminMutation<{ reason?: string }>("POST", `/users/${id}/suspend`, invalidate);
  const unsuspend = useAdminMutation<Record<string, never>>("POST", `/users/${id}/unsuspend`, invalidate);
  const [creditOpen, setCreditOpen] = useState(false);

  const toggleSuspend = async () => {
    if (!data) return;
    const suspended = !!data.user.suspendedAt;
    if (!suspended && !window.confirm(`Suspend ${data.user.email}? They will be signed out of everything.`)) return;
    try {
      if (suspended) await unsuspend.mutateAsync({});
      else await suspend.mutateAsync({});
      toast.success(suspended ? "User restored" : "User suspended");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <QueryState isLoading={isLoading} error={error} />
      {data && (
        <>
          <PageHeader
            title={data.user.name}
            description={`${data.user.email} · ${data.user.provider} · joined ${when(data.user.createdAt)}`}
            actions={
              <>
                <Button size="sm" onClick={() => setCreditOpen(true)}>
                  Credit user
                </Button>
                {data.user.isAdmin ? (
                  <StatusBadge tone="ok">Admin</StatusBadge>
                ) : (
                  <Button variant={data.user.suspendedAt ? "outline" : "destructive"} size="sm" onClick={toggleSuspend}>
                    {data.user.suspendedAt ? "Unsuspend" : "Suspend"}
                  </Button>
                )}
              </>
            }
          />
          {data.user.suspendedAt && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Suspended {when(data.user.suspendedAt)}.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Balance" value={num(data.wallet.balance, 2)} hint="credits" />
            <KpiCard label="Bought" value={num(data.wallet.totalPurchased, 2)} hint="credits, all time" />
            <KpiCard label="Used" value={num(data.wallet.totalUsed, 2)} hint="credits, all time" />
          </div>


          <Tabs defaultValue="ledger">
            <TabsList>
              <TabsTrigger value="ledger">Credit history</TabsTrigger>
              <TabsTrigger value="searches">Searches</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
            </TabsList>
            <TabsContent value="ledger">
              <Panel>
                <DataTable head={["When", "Type", "Amount", "Balance after", "Description"]} empty={data.ledger.length === 0}>
                  {data.ledger.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 text-muted-foreground">{when(t.createdAt)}</td>
                      <td className="px-3 py-2"><StatusBadge tone={t.type === "deduction" ? "muted" : "ok"}>{t.type}</StatusBadge></td>
                      <td className="px-3 py-2 tabular-nums">{t.type === "deduction" ? "−" : "+"}{num(t.amount, 2)}</td>
                      <td className="px-3 py-2 tabular-nums">{num(t.balanceAfter, 2)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.description}</td>
                    </tr>
                  ))}
                </DataTable>
              </Panel>
            </TabsContent>
            <TabsContent value="searches">
              <Panel>
                <DataTable head={["When", "Search", "Extensions", "Names"]} empty={data.searches.length === 0}>
                  {data.searches.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 text-muted-foreground">{when(s.createdAt)}</td>
                      <td className="px-3 py-2">{s.businessName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{safeList(s.tlds)}</td>
                      <td className="px-3 py-2 tabular-nums">{s.resultsCount}</td>
                    </tr>
                  ))}
                </DataTable>
              </Panel>
            </TabsContent>
            <TabsContent value="purchases">
              <Panel>
                <DataTable head={["When", "Pack", "Amount", "Status"]} empty={data.purchases.length === 0}>
                  {data.purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-muted-foreground">{when(p.createdAt)}</td>
                      <td className="px-3 py-2">{p.packId ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{p.amount ? `${p.amount} ${p.currency ?? ""}` : "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={p.status === "completed" ? "ok" : p.status === "failed" ? "bad" : "warn"}>{p.status}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </Panel>
            </TabsContent>
          </Tabs>
          <CreditDialog
            user={{ id: data.user.id, name: data.user.name, email: data.user.email, balance: data.wallet.balance }}
            open={creditOpen}
            onOpenChange={setCreditOpen}
          />
        </>
      )}
    </div>
  );
}

function safeList(json: string): string {
  try {
    return (JSON.parse(json) as string[]).join(", ");
  } catch {
    return json;
  }
}
