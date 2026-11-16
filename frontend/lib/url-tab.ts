"use client";

import { useCallback, useEffect, useState } from "react";

export type Tab = "generate" | "check";

/** `?tab=check` → "check"; anything else is the default Generate tab. */
export function tabFromSearch(search: string): Tab {
  return new URLSearchParams(search).get("tab") === "check" ? "check" : "generate";
}

/** The query string for a tab, keeping any other params. Generate is the bare URL. */
export function searchWithTab(search: string, tab: Tab): string {
  const params = new URLSearchParams(search);
  if (tab === "check") params.set("tab", "check");
  else params.delete("tab");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The active tab, kept in the URL so a reload, a shared link and Back/Forward
 * all land on the same tab. `onNavigate` runs when Back/Forward changes it.
 */
export function useUrlTab(onNavigate?: (tab: Tab) => void) {
  const [tab, setTabState] = useState<Tab>("generate");

  useEffect(() => {
    // Read after mount: the server render can't see the query string.
    setTabState(tabFromSearch(window.location.search));
    const onPop = () => {
      const next = tabFromSearch(window.location.search);
      setTabState(next);
      onNavigate?.(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    const { pathname, search, hash } = window.location;
    const nextSearch = searchWithTab(search, next);
    if (nextSearch !== search) {
      window.history.pushState(window.history.state, "", `${pathname}${nextSearch}${hash}`);
    }
  }, []);

  return [tab, setTab] as const;
}
