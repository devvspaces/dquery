"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/bits";
import { ago, useAdminMutation } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export interface SettingView {
  key: string;
  group: string;
  label: string;
  description: string;
  type: "number" | "int" | "string" | "enum" | "list" | "record";
  envVar?: string;
  min?: number;
  max?: number;
  options?: string[];
  patternHint?: string;
  value: unknown;
  defaultValue: unknown;
  source: "db" | "env";
  updatedBy?: string | null;
  updatedAt?: string;
}

const inputCls = "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground";

/** One editable setting: typed editor, Save, Reset to .env default. */
export function SettingField({ setting }: { setting: SettingView }) {
  const [draft, setDraft] = useState<unknown>(setting.value);
  useEffect(() => setDraft(setting.value), [setting.value]);
  const save = useAdminMutation<{ value: unknown }>("PUT", `/settings/${setting.key}`, [["settings"]]);
  const reset = useAdminMutation<undefined>("DELETE", `/settings/${setting.key}`, [["settings"]]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);

  const onSave = async () => {
    try {
      await save.mutateAsync({ value: draft });
      toast.success(`${setting.label} saved. Live now.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const onReset = async () => {
    try {
      await reset.mutateAsync(undefined);
      toast.success(`${setting.label} reset to the .env default.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 md:flex-row md:items-start md:justify-between" data-testid={`setting-${setting.key}`}>
      <div className="md:max-w-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{setting.label}</span>
          <StatusBadge tone={setting.source === "db" ? "ok" : "muted"}>
            {setting.source === "db" ? "Override" : setting.envVar ? `.env ${setting.envVar}` : "Default"}
          </StatusBadge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{setting.description}</p>
        {setting.source === "db" && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Changed by {setting.updatedBy} {ago(setting.updatedAt)} · default {format(setting.defaultValue)}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 md:items-end">
        <Editor setting={setting} value={draft} onChange={setDraft} />
        <div className="flex gap-2">
          {setting.source === "db" && (
            <Button size="sm" variant="ghost" onClick={onReset} disabled={reset.isPending}>
              Reset
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={!dirty || save.isPending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function format(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(all)";
  if (v && typeof v === "object") return `${Object.keys(v).length} entries`;
  return String(v);
}

function Editor({ setting, value, onChange }: { setting: SettingView; value: unknown; onChange: (v: unknown) => void }) {
  switch (setting.type) {
    case "number":
    case "int":
      return (
        <input
          type="number"
          aria-label={setting.label}
          step={setting.type === "int" ? 1 : "any"}
          min={setting.min}
          max={setting.max}
          value={value as number}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={cn(inputCls, "w-36")}
        />
      );
    case "enum":
      return (
        <select aria-label={setting.label} value={value as string} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "w-48")}>
          {setting.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "string":
      return (
        <input
          aria-label={setting.label}
          value={value as string}
          placeholder={setting.patternHint}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputCls, "w-full md:w-72 font-mono")}
        />
      );
    case "list":
      return <ListEditor options={setting.options ?? []} value={(value as string[]) ?? []} onChange={onChange} />;
    case "record":
      return <RecordEditor value={(value as Record<string, string>) ?? {}} onChange={onChange} hint={setting.patternHint} />;
  }
}

/** Pick items from the allowed options; the chosen order matters (↑ ↓). */
function ListEditor({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="w-full space-y-2 md:max-w-md">
      <ol className="space-y-1">
        {value.map((v, i) => (
          <li key={v} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 font-mono text-xs">
            <span>
              {i + 1}. {v}
            </span>
            <span className="flex gap-1">
              <button type="button" aria-label={`Move ${v} up`} disabled={i === 0} onClick={() => move(i, -1)} className="px-1 disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move ${v} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)} className="px-1 disabled:opacity-30">↓</button>
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="px-1 text-destructive">×</button>
            </span>
          </li>
        ))}
        {value.length === 0 && <li className="text-xs text-muted-foreground">Empty (means all)</li>}
      </ol>
      <div className="flex flex-wrap gap-1">
        {options.filter((o) => !value.includes(o)).map((o) => (
          <button key={o} type="button" onClick={() => onChange([...value, o])} className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary">
            + {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecordEditor({ value, onChange, hint }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; hint?: string }) {
  const entries = Object.entries(value);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="w-full space-y-2 md:max-w-xl">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 font-mono">{k}</span>
          <input value={v} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className={cn(inputCls, "h-8 flex-1 font-mono text-xs")} aria-label={`${k} link`} />
          <button type="button" onClick={() => { const next = { ...value }; delete next[k]; onChange(next); }} className="text-destructive" aria-label={`Remove ${k}`}>×</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} placeholder="registrar id" className={cn(inputCls, "h-8 w-24 text-xs")} aria-label="New link registrar" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={hint} className={cn(inputCls, "h-8 flex-1 font-mono text-xs")} aria-label="New link URL" />
        <Button type="button" size="sm" variant="outline" disabled={!key || !url} onClick={() => { onChange({ ...value, [key]: url }); setKey(""); setUrl(""); }}>
          Add
        </Button>
      </div>
    </div>
  );
}
