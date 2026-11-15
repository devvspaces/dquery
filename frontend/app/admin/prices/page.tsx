"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { ago, num, useAdminMutation, useAdminQuery } from "@/lib/admin-api";

interface PriceRow {
  registrar: string;
  tld: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice: number | null;
  isPromo: boolean;
  source: string;
  currency: string;
  updatedAt: string;
}

const input = "h-9 rounded-lg border border-input bg-background px-3 text-sm";

export default function AdminPrices() {
  const [tld, setTld] = useState("com");
  const [registrar, setRegistrar] = useState("");
  const [source, setSource] = useState("");
  const qs = new URLSearchParams({ limit: "200", ...(tld && { tld }), ...(registrar && { registrar }), ...(source && { source }) });
  const { data, isLoading, error } = useAdminQuery<{ total: number; data: PriceRow[] }>(["prices", tld, registrar, source], `/prices?${qs}`);
  const fx = useAdminQuery<Array<{ currency: string; perUsd: number; updatedAt: string }>>(["fx"], "/fx");

  const [form, setForm] = useState({ registrar: "", tld: "", register: "", renew: "", currency: "USD" });
  const save = useAdminMutation<{ registrar: string; tld: string; register: number; renew: number; currency: string }>("PUT", "/prices", [["prices"]]);
  const remove = useAdminMutation<{ registrar: string; tld: string }>("DELETE", (b) => `/prices/${b.registrar}/${b.tld}`, [["prices"]]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        registrar: form.registrar.trim().toLowerCase(),
        tld: form.tld.trim().toLowerCase().replace(/^\./, ""),
        register: Number(form.register),
        renew: Number(form.renew),
        currency: form.currency,
      });
      toast.success("Manual price saved; it won't be overwritten by syncs.");
      setForm({ ...form, register: "", renew: "" });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const fxSample = new Set(["EUR", "GBP", "NGN", "KES", "ZAR", "GHS", "INR", "CAD"]);

  return (
    <div className="space-y-6">
      <PageHeader title="Prices" description="The TLD price catalog. Manual prices override syncs until removed." />
      <Panel title="Set a manual price">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2 text-xs text-muted-foreground">
          {(["registrar", "tld", "register", "renew"] as const).map((k) => (
            <label key={k} className="space-y-1">
              {k === "register" ? "First year" : k === "renew" ? "Renewal" : k === "tld" ? "TLD" : "Registrar id"}
              <input
                required
                type={k === "register" || k === "renew" ? "number" : "text"}
                step="0.01"
                min={0}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={k === "registrar" ? "spaceship" : k === "tld" ? "co.uk" : "9.99"}
                className={`${input} block w-32 text-foreground`}
              />
            </label>
          ))}
          <label className="space-y-1">
            Currency
            <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className={`${input} block w-20 text-foreground`} />
          </label>
          <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
        </form>
      </Panel>

      <Panel
        title="Catalog"
        actions={
          <div className="flex flex-wrap gap-2">
            <input value={tld} onChange={(e) => setTld(e.target.value.toLowerCase())} placeholder="TLD" aria-label="Filter TLD" className={`${input} w-24`} />
            <input value={registrar} onChange={(e) => setRegistrar(e.target.value.toLowerCase())} placeholder="Registrar" aria-label="Filter registrar" className={`${input} w-28`} />
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter source" className={input}>
              <option value="">All sources</option>
              <option value="catalog-api">API</option>
              <option value="catalog-static">Static list</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        }
      >
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">{num(data.total)} prices{data.total > 200 && " (showing 200)"}</p>
            <DataTable head={["TLD", "Registrar", "First year", "Renewal", "Transfer", "Source", "Updated", ""]} empty={data.data.length === 0}>
              {data.data.map((p) => (
                <tr key={`${p.registrar}-${p.tld}`}>
                  <td className="px-3 py-2 font-mono">.{p.tld}</td>
                  <td className="px-3 py-2">{p.registrar}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {p.registerPrice.toFixed(2)} {p.currency}
                    {p.isPromo && <span className="ml-1 text-xs text-muted-foreground">promo</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.renewalPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.transferPrice?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={p.source === "manual" ? "warn" : "muted"}>{p.source}</StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ago(p.updatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {p.source === "manual" && (
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={async () => {
                          try {
                            await remove.mutateAsync({ registrar: p.registrar, tld: p.tld });
                            toast.success("Manual price removed; the next sync restores the catalog price.");
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </Panel>

      <Panel title="Exchange rates (per 1 USD)">
        <QueryState isLoading={fx.isLoading} error={fx.error} />
        {fx.data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {fx.data.filter((r) => fxSample.has(r.currency)).map((r) => (
                <div key={r.currency} className="rounded-lg bg-muted/50 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{r.currency}</div>
                  <div className="tabular-nums text-foreground">{num(r.perUsd, 4)}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {fx.data.length} currencies · updated {ago(fx.data[0]?.updatedAt)} · Rates By Exchange Rate API
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
