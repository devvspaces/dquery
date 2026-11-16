import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { searchWithTab, tabFromSearch, useUrlTab } from "./url-tab";

describe("tab in the URL", () => {
  it("reads the tab from the query string", () => {
    expect(tabFromSearch("?tab=check")).toBe("check");
    expect(tabFromSearch("?tab=generate")).toBe("generate");
    expect(tabFromSearch("")).toBe("generate");
    expect(tabFromSearch("?tab=nonsense")).toBe("generate");
  });

  it("writes the tab and keeps other params", () => {
    expect(searchWithTab("", "check")).toBe("?tab=check");
    expect(searchWithTab("?tab=check", "generate")).toBe("");
    expect(searchWithTab("?ref=x", "check")).toBe("?ref=x&tab=check");
    expect(searchWithTab("?ref=x&tab=check", "generate")).toBe("?ref=x");
  });

  it("restores the tab on reload and follows Back/Forward", () => {
    window.history.replaceState(null, "", "/?tab=check");
    const seen: string[] = [];
    const { result } = renderHook(() => useUrlTab((t) => seen.push(t)));
    expect(result.current[0]).toBe("check");

    act(() => result.current[1]("generate"));
    expect(window.location.search).toBe("");
    expect(result.current[0]).toBe("generate");

    act(() => {
      window.history.replaceState(null, "", "/?tab=check");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current[0]).toBe("check");
    expect(seen).toEqual(["check"]);
  });
});
