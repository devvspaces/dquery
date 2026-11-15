import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { GeneratorForm } from "./generator-form";
import { CheckerForm } from "./checker-form";

const pricing = { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 };

describe("cost notes", () => {
  beforeEach(() => {
    useDomainQStore.setState({ pricing, user: null });
  });

  it("shows the generation cost for the selected extensions", () => {
    render(<GeneratorForm onGenerate={() => {}} isLoading={false} />);
    // Default selection is 6 extensions: 1 + 15 × 6 × 0.05 = 5.5
    expect(screen.getByTestId("cost-note").textContent).toContain("5.5 credits");
    expect(screen.getByTestId("cost-note").textContent).toContain("15 names × 6 extensions");
  });

  it("warns when the balance is too low", () => {
    useDomainQStore.setState({
      user: { id: "u", name: "A", email: "a@x", credits: 2 } as never,
    });
    render(<GeneratorForm onGenerate={() => {}} isLoading={false} />);
    expect(screen.getByTestId("cost-note").textContent).toContain("you have 2");
  });

  it("prices a bare name across the popular extensions", () => {
    render(<CheckerForm onCheck={() => {}} isLoading={false} />);
    fireEvent.change(screen.getByLabelText("Domain name"), { target: { value: "acme" } });
    expect(screen.getByTestId("cost-note").textContent).toContain("0.4 credits");
    fireEvent.change(screen.getByLabelText("Domain name"), { target: { value: "acme.com" } });
    expect(screen.getByTestId("cost-note").textContent).toContain("0.05 credits");
  });
});
