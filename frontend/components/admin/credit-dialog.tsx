"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { num, useAdminMutation } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const AMOUNTS = [5, 10, 25, 50, 100];
const REASONS = ["Goodwill credit", "Refund for a failed search", "Promotion", "Support request"];

export interface CreditTarget {
  id: string;
  name: string;
  email: string;
  balance: number;
}

/**
 * Give (or take back) credits. Each submit carries a fresh request id, so a
 * double-click or a retried request is applied only once by the server.
 */
export function CreditDialog({
  user,
  open,
  onOpenChange,
}: {
  user: CreditTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState(REASONS[0]);
  const mutation = useAdminMutation<{ delta: number; reason: string; requestId: string }, { balance: number }>(
    "POST",
    () => `/users/${user?.id}/credits`,
    [["users"], ["user", user?.id ?? ""], ["summary"]]
  );

  useEffect(() => {
    if (open) {
      setMode("add");
      setAmount("10");
      setReason(REASONS[0]);
    }
  }, [open]);

  if (!user) return null;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= 100_000 && reason.trim().length > 0;
  const delta = mode === "add" ? value : -value;
  const after = user.balance + (valid ? delta : 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const res = await mutation.mutateAsync({ delta, reason: reason.trim(), requestId: crypto.randomUUID() });
      toast.success(
        `${mode === "add" ? "Gave" : "Removed"} ${num(value, 2)} credits ${mode === "add" ? "to" : "from"} ${user.email}. New balance ${num(res.balance, 2)}.`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Credit {user.name}</DialogTitle>
            <DialogDescription>
              {user.email} · balance {num(user.balance, 2)} credits
            </DialogDescription>
          </DialogHeader>

          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Add or remove">
            {(["add", "remove"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {m === "add" ? "Add credits" : "Remove credits"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(String(a))}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm tabular-nums",
                    value === a ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
            <label className="block space-y-1 text-xs text-muted-foreground">
              Amount
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount"
                className="block h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs text-muted-foreground">
            Reason (shown in the user&apos;s credit history)
            <input
              list="credit-reasons"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Reason"
              className="block h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            />
            <datalist id="credit-reasons">
              {REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>

          <p className={cn("text-xs", after < 0 ? "text-destructive" : "text-muted-foreground")}>
            {after < 0
              ? "That's more than their balance; removing will fail."
              : `New balance: ${num(after, 2)} credits`}
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || after < 0 || mutation.isPending} variant={mode === "remove" ? "destructive" : "default"}>
              {mode === "add" ? `Give ${valid ? num(value, 2) : ""} credits` : `Remove ${valid ? num(value, 2) : ""} credits`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
