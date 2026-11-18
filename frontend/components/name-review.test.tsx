import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithClient } from "@/lib/test-utils";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { NameReview } from "./name-review";

const review = {
  names: ["ledgerly", "goledger", "bledger"],
  techniques: { ledgerly: "affix", bledger: "rhyme" },
  tlds: [".com", ".io"],
};

describe("NameReview", () => {
  beforeEach(() =>
    useDomainQStore.setState({
      pricing: { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 },
      user: null,
    })
  );

  it("checks only the kept names across the extensions", () => {
    const onCheck = vi.fn();
    renderWithClient(<NameReview review={review} isLoading={false} onCheck={onCheck} onBack={() => {}} />);
    expect(screen.getByText("3 of 3 selected. Only the names you check are charged.")).toBeInTheDocument();
    // 3 × 2 × 0.05
    expect(screen.getByTestId("cost-note").textContent).toContain("0.3 credits");

    fireEvent.click(screen.getByLabelText("Remove bledger"));
    fireEvent.click(screen.getByLabelText("Select goledger"));
    expect(screen.getByTestId("cost-note").textContent).toContain("0.1 credits");

    fireEvent.click(screen.getByRole("button", { name: /check 1 name × 2 extensions/i }));
    expect(onCheck).toHaveBeenCalledWith(
      [
        { domain: "ledgerly", tld: "com" },
        { domain: "ledgerly", tld: "io" },
      ],
      review.techniques
    );
  });

  it("adds your own name, selected", () => {
    const onCheck = vi.fn();
    renderWithClient(<NameReview review={review} isLoading={false} onCheck={onCheck} onBack={() => {}} />);
    fireEvent.click(screen.getByText("Select none"));
    fireEvent.change(screen.getByLabelText("Add your own name"), { target: { value: "MyBrand.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: /check 1 name/i }));
    expect(onCheck.mock.calls[0][0]).toEqual([
      { domain: "mybrand", tld: "com" },
      { domain: "mybrand", tld: "io" },
    ]);
  });

  it("disables checking when nothing is selected", () => {
    renderWithClient(<NameReview review={review} isLoading={false} onCheck={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByText("Select none"));
    expect(screen.getByRole("button", { name: /check 0 names/i })).toBeDisabled();
  });
});
