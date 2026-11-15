"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { KpiCard, PageHeader, Panel, QueryState, DataTable } from "@/components/admin/bits";
import { num, usd, useAdminQuery } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

interface Point {
  day: string;
  signups: number;
  aiSearches: number;
  wordSearches: number;
  checkSearches: number;
  creditsSpent: number;
  creditsRefunded: number;
  creditsGranted: number;
  revenueUsd: number;
  purchases: number;
  aiCostUsd: number;
  activeUsers: number;
}

interface Summary {
  days: number;
  series: Point[];
  today: Point;
  yesterday: Point | null;
  totals: {
    users: number;
    suspendedUsers: number;
    payingUsers: number;
    conversionRate: number;
    revenueUsd: number;
    aiCostUsd: number;
    outstandingCredits: number;
    failedJobs24h: number;
  };
}

interface LlmRow {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

const searchesConfig = {
  aiSearches: { label: "AI", color: "hsl(var(--chart-1))" },
  wordSearches: { label: "Word builder", color: "hsl(var(--chart-2))" },
  checkSearches: { label: "Checks", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const moneyConfig = {
  revenueUsd: { label: "Revenue", color: "hsl(var(--chart-1))" },
  aiCostUsd: { label: "AI cost", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const usersConfig = {
  signups: { label: "Sign-ups", color: "hsl(var(--chart-1))" },
  activeUsers: { label: "Active", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useAdminQuery<Summary>(["summary", days], `/metrics/summary?days=${days}`, 60_000);
  const llm = useAdminQuery<LlmRow[]>(["llm", days], `/metrics/llm?days=${days}`);

  const searches = (p?: Point | null) => (p ? p.aiSearches + p.wordSearches + p.checkSearches : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Today's numbers compared with yesterday, and trends over time (UTC days)."
        actions={
          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Range">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium",
                  days === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />
      <QueryState isLoading={isLoading} error={error} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Sign-ups today" value={num(data.today.signups)} current={data.today.signups} previous={data.yesterday?.signups} />
            <KpiCard label="Searches today" value={num(searches(data.today))} current={searches(data.today)} previous={searches(data.yesterday)} />
            <KpiCard label="Credits spent today" value={num(data.today.creditsSpent, 2)} current={data.today.creditsSpent} previous={data.yesterday?.creditsSpent} />
            <KpiCard label="Revenue today" value={usd(data.today.revenueUsd)} current={data.today.revenueUsd} previous={data.yesterday?.revenueUsd} />
            <KpiCard label="Total users" value={num(data.totals.users)} hint={`${data.totals.suspendedUsers} suspended`} />
            <KpiCard label="Paying users" value={num(data.totals.payingUsers)} hint={`${data.totals.conversionRate}% conversion`} />
            <KpiCard label="Revenue (all time)" value={usd(data.totals.revenueUsd)} hint={`AI cost ${usd(data.totals.aiCostUsd)}`} />
            <KpiCard
              label="Failed jobs (24h)"
              value={num(data.totals.failedJobs24h)}
              hint={`${num(data.totals.outstandingCredits, 2)} credits unspent`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Searches per day">
              <ChartContainer config={searchesConfig} className="h-64 w-full">
                <BarChart data={data.series}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => shortDay(String(d))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="aiSearches" stackId="s" fill="var(--color-aiSearches)" />
                  <Bar dataKey="wordSearches" stackId="s" fill="var(--color-wordSearches)" />
                  <Bar dataKey="checkSearches" stackId="s" fill="var(--color-checkSearches)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Panel>
            <Panel title="Revenue vs AI cost (USD)">
              <ChartContainer config={moneyConfig} className="h-64 w-full">
                <LineChart data={data.series}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => shortDay(String(d))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="revenueUsd" stroke="var(--color-revenueUsd)" strokeWidth={2} dot={false} />
                  <Line dataKey="aiCostUsd" stroke="var(--color-aiCostUsd)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </Panel>
            <Panel title="Users per day">
              <ChartContainer config={usersConfig} className="h-64 w-full">
                <LineChart data={data.series}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => shortDay(String(d))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="signups" stroke="var(--color-signups)" strokeWidth={2} dot={false} />
                  <Line dataKey="activeUsers" stroke="var(--color-activeUsers)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </Panel>
            <Panel title={`AI usage (last ${days} days)`}>
              <QueryState isLoading={llm.isLoading} error={llm.error} />
              {llm.data && (
                <DataTable head={["Provider", "Model", "Calls", "Tokens", "Cost"]} empty={llm.data.length === 0}>
                  {llm.data.map((r) => (
                    <tr key={`${r.provider}-${r.model}`}>
                      <td className="px-3 py-2">{r.provider}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
                      <td className="px-3 py-2 tabular-nums">{num(r.calls)}</td>
                      <td className="px-3 py-2 tabular-nums">{num(r.tokens)}</td>
                      <td className="px-3 py-2 tabular-nums">{usd(r.costUsd)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
