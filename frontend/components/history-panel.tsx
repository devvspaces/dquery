"use client";

import { useState } from "react";
import { Check, Clock, Pin, PinOff, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { timeAgo } from "@/lib/results-view";
import { useSearchActions, useSearchHistory, type SearchSummary } from "@/lib/searches-api";
import { cn } from "@/lib/utils";

/** One saved search: opens on click; pin, rename and delete inline. */
function HistoryItem({ s, onOpen }: { s: SearchSummary; onOpen: (id: string) => void }) {
  const { update, remove } = useSearchActions();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    setEditing(false);
    if (title.trim() && title !== s.title) update.mutate({ id: s.id, title: title.trim() });
  };

  return (
    <li className="group relative rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      {editing ? (
        <form
          className="flex items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            aria-label="Search name"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          />
          <button type="submit" aria-label="Save name" className="p-1 text-primary">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Cancel" onClick={() => setEditing(false)} className="p-1 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <>
          <button type="button" onClick={() => onOpen(s.id)} className="block w-full p-3 pr-24 text-left">
            <span className="flex items-center gap-2">
              {s.pinned && <Pin className="h-3 w-3 shrink-0 fill-primary text-primary" aria-label="Pinned" />}
              <span className="truncate text-sm font-medium text-foreground">{s.title}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                {s.kind === "generate" ? "Generated" : "Check"}
              </span>
              {s.checked > 0 ? (
                <span>
                  <span className="text-success">{s.available} available</span>
                  {s.cheapest !== null && <> · from ${s.cheapest.toFixed(2)}</>}
                </span>
              ) : (
                <span>{s.names} names, not checked yet</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden /> {timeAgo(s.updatedAt)}
              </span>
            </span>
          </button>
          <div className="absolute right-2 top-2 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            {confirmDelete ? (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(s.id, {
                    onSuccess: () => toast.success("Search deleted"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground"
              >
                Delete?
              </button>
            ) : (
              <>
                <IconButton label={s.pinned ? "Unpin" : "Pin"} onClick={() => update.mutate({ id: s.id, pinned: !s.pinned })}>
                  {s.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </IconButton>
                <IconButton label="Rename" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Delete" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Saved searches, newest (and pinned) first. */
export function HistoryList({
  onOpen,
  limit = 30,
  searchable = true,
  className,
}: {
  onOpen: (id: string) => void;
  limit?: number;
  searchable?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useSearchHistory(q, limit);

  return (
    <div className={className}>
      {searchable && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your history"
            aria-label="Search your history"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
      )}
      {isLoading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </ul>
      ) : error ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your searches.</p>
      ) : !data?.data.length ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {q ? "No searches match." : "Your searches will appear here, saved automatically."}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.data.map((s) => (
            <HistoryItem key={s.id} s={s} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function HistorySheet({
  open,
  onOpenChange,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("flex w-full flex-col sm:max-w-md")}>
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>Every search is saved. Reopening one is free.</SheetDescription>
        </SheetHeader>
        <div className="-mx-6 flex-1 overflow-y-auto px-6 pb-6">
          <HistoryList
            onOpen={(id) => {
              onOpenChange(false);
              onOpen(id);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
