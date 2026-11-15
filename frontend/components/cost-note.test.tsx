import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { GeneratorForm } from "./generator-form";
import { CheckerForm } from "./checker-form";

const pricing = { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 };

describe("cost notes", () => {
  beforeEach(() => {
    useDomainQStore.setState({ pricing, user: null });
  });

  it("charges only the generation fee up front", () => {
    render(<GeneratorForm onGenerate={() => {}} isLoading={false} />);
    const note = screen.getByTestId("cost-note").textContent;
    expect(note).toContain("1 credits");
    expect(note).toContain("generate 20 names");
  });

  it("warns when the balance is too low", () => {
    useDomainQStore.setState({
      user: { id: "u", name: "A", email: "a@x", credits: 0.5 } as never,
    });
    render(<GeneratorForm onGenerate={() => {}} isLoading={false} />);
    expect(screen.getByTestId("cost-note").textContent).toContain("you have 0.5");
  });

  it("prices a name across the selected extensions", () => {
    render(<CheckerForm onCheck={() => {}} isLoading={false} />);
    // Default selection: 6 extensions → 6 × 0.05
    fireEvent.change(screen.getByLabelText("Domain name"), { target: { value: "acme" } });
    expect(screen.getByTestId("cost-note").textContent).toContain("0.3 credits");
    // A typed extension outside the selection is added: 7 domains
    fireEvent.change(screen.getByLabelText("Domain name"), { target: { value: "acme.xyz" } });
    expect(screen.getByTestId("cost-note").textContent).toContain("0.35 credits");
  });
});

describe("nothing submits until the main button is clicked", () => {
  beforeEach(() => useDomainQStore.setState({ pricing, user: null }));

  it("selecting extensions, sorting or pressing Enter in TLD search never generates", () => {
    const onGenerate = vi.fn();
    const { container } = render(<GeneratorForm onGenerate={onGenerate} isLoading={false} />);
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Acme" } });
    // Click controls inside the extension picker: two chips plus every non-chip button.
    const buttons = [...container.querySelectorAll("button")].filter(
      (b) => b.getAttribute("role") !== "tab" && !/generate domain names/i.test(b.textContent ?? "")
    );
    const chips = buttons.filter((b) => /^\s*\.[a-z]+/.test(b.textContent ?? ""));
    chips.slice(0, 2).forEach((b) => fireEvent.click(b)); // toggles .com/.net off
    chips.slice(0, 2).forEach((b) => fireEvent.click(b)); // and back on
    buttons.filter((b) => !chips.includes(b)).forEach((b) => fireEvent.click(b));
    container.querySelectorAll('input[type="text"]').forEach((input) => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onGenerate).not.toHaveBeenCalled();
    // Only the main button submits.
    fireEvent.click(screen.getByRole("button", { name: /generate domain names/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("every button in the extension picker is type=button", () => {
    const { container } = render(<CheckerForm onCheck={() => {}} isLoading={false} />);
    const untyped = [...container.querySelectorAll("button")].filter((b) => !b.getAttribute("type"));
    expect(untyped).toHaveLength(0);
  });

  it("the checker passes the chosen extensions", () => {
    const onCheck = vi.fn();
    render(<CheckerForm onCheck={onCheck} isLoading={false} />);
    fireEvent.change(screen.getByLabelText("Domain name"), { target: { value: "acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: /check \d+ domains/i }));
    expect(onCheck).toHaveBeenCalledWith("acme.com", expect.arrayContaining([".com", ".io"]));
  });
});
