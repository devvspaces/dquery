"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { searchHref } from "@/components/landing/hero-search";

/** "Is yourname.ai free?": opens the checker with the name and this extension filled in. */
export function TldCheck({ tld }: { tld: string }) {
  const router = useRouter();
  const [name, setName] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const label = name.trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0].replace(/[^a-z0-9-]/g, "");
    router.push(searchHref("check", label ? `${label}.${tld}` : ""));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" role="search" aria-label={`Check a .${tld} domain`}>
      <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-4 focus-within:border-primary/60">
        <label htmlFor="tld-check" className="sr-only">
          Name to check
        </label>
        <input
          id="tld-check"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="yourname"
          autoComplete="off"
          maxLength={63}
          className="h-11 min-w-0 flex-1 bg-transparent font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <span className="font-mono text-primary">.{tld}</span>
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Check availability
      </button>
    </form>
  );
}
