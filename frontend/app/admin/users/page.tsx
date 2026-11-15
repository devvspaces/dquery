"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable, PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { ago, num, useAdminQuery } from "@/lib/admin-api";
import { CreditDialog, type CreditTarget } from "@/components/admin/credit-dialog";

interface UserRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  createdAt: string;
  suspendedAt: string | null;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastActivity: string | null;
  isAdmin: boolean;
}

export default function AdminUsers() {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [crediting, setCrediting] = useState<CreditTarget | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(draft);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [draft]);

  const { data, isLoading, error } = useAdminQuery<{ total: number; data: UserRow[]; limit: number }>(
    ["users", q, page],
    `/users?q=${encodeURIComponent(q)}&page=${page}&limit=50`
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" description="Search by email or name. Open a user to adjust credits or suspend." />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search users…"
        aria-label="Search users"
        className="h-9 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
      />
      <Panel>
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <>
            <DataTable head={["User", "Signed up", "Balance", "Bought", "Used", "Last activity", "Status", ""]} empty={data.data.length === 0}>
              {data.data.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-foreground hover:text-primary">
                      {u.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ago(u.createdAt)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(u.balance, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(u.totalPurchased, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(u.totalUsed, 2)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ago(u.lastActivity)}</td>
                  <td className="px-3 py-2">
                    {u.isAdmin ? (
                      <StatusBadge tone="ok">Admin</StatusBadge>
                    ) : u.suspendedAt ? (
                      <StatusBadge tone="bad">Suspended</StatusBadge>
                    ) : (
                      <StatusBadge tone="muted">Active</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setCrediting({ id: u.id, name: u.name, email: u.email, balance: u.balance })}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                      aria-label={`Credit ${u.email}`}
                    >
                      Credit
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{num(data.total)} users</span>
              <span className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">
                  Prev
                </button>
                {page} / {pages}
                <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">
                  Next
                </button>
              </span>
            </div>
          </>
        )}
      </Panel>
      <CreditDialog user={crediting} open={!!crediting} onOpenChange={(o) => !o && setCrediting(null)} />
    </div>
  );
}
