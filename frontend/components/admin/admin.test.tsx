import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/settings" }));

import { AdminShell } from "./admin-shell";
import { SettingField, type SettingView } from "./setting-field";

const wrap = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const user = (isAdmin: boolean) => ({
  id: "u1",
  name: "Ada",
  email: "ada@example.test",
  provider: "github",
  credits: 10,
  isAdmin,
});

describe("AdminShell gate", () => {
  it("blocks non-admins", () => {
    useDomainQStore.setState({ isInitialized: true, isAuthenticated: true, user: user(false) });
    wrap(<AdminShell><p>secret</p></AdminShell>);
    expect(screen.getByText("Not authorised")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("blocks signed-out visitors", () => {
    useDomainQStore.setState({ isInitialized: true, isAuthenticated: false, user: null });
    wrap(<AdminShell><p>secret</p></AdminShell>);
    expect(screen.getByText("Not authorised")).toBeInTheDocument();
  });

  it("shows the panel to admins", () => {
    useDomainQStore.setState({ isInitialized: true, isAuthenticated: true, user: user(true) });
    wrap(<AdminShell><p>secret</p></AdminShell>);
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });
});

describe("SettingField", () => {
  beforeEach(() => useDomainQStore.setState({ token: "t" }));
  afterEach(() => vi.restoreAllMocks());

  const setting: SettingView = {
    key: "credits.perDomainCheck",
    group: "Credits",
    label: "Per name × extension checked",
    description: "Includes the full registrar price comparison.",
    type: "number",
    envVar: "CREDIT_PER_DOMAIN_CHECK",
    min: 0,
    max: 10,
    value: 0.05,
    defaultValue: 0.05,
    source: "env",
  };

  it("saves an edited value with PUT", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...setting, value: 0.07, source: "db" }), { status: 200 })
    );
    wrap(<SettingField setting={setting} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(setting.label), { target: { value: "0.07" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/settings/credits.perDomainCheck"),
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ value: 0.07 }) })
      )
    );
  });

  it("orders list settings", () => {
    const onChange = vi.fn();
    wrap(
      <SettingField
        setting={{
          ...setting,
          key: "registrars.checkerOrder",
          label: "Availability check order",
          type: "list",
          options: ["cloudflare", "namecheap", "spaceship"],
          value: ["cloudflare", "namecheap"],
          defaultValue: ["cloudflare", "namecheap"],
        }}
      />
    );
    fireEvent.click(screen.getByLabelText("Move namecheap up"));
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("namecheap");
    fireEvent.click(screen.getByText("+ spaceship"));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(onChange).not.toHaveBeenCalled();
  });
});

import { CreditDialog } from "./credit-dialog";

describe("CreditDialog", () => {
  beforeEach(() => useDomainQStore.setState({ token: "t" }));
  afterEach(() => vi.restoreAllMocks());
  const target = { id: "11111111-1111-4111-8111-111111111111", name: "Ada", email: "ada@example.test", balance: 3 };

  it("gives a preset amount with a reason and a request id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ balance: 28 }), { status: 201 })
    );
    const onOpenChange = vi.fn();
    wrap(<CreditDialog user={target} open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "25" }));
    expect(screen.getByText("New balance: 28 credits")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /give 25 credits/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/admin/users/${target.id}/credits`);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(expect.objectContaining({ delta: 25, reason: "Goodwill credit" }));
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("won't remove more than the balance", () => {
    wrap(<CreditDialog user={target} open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove credits" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByText(/more than their balance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove 5 credits/i })).toBeDisabled();
  });
});
