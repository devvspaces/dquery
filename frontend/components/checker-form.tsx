"use client";

import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CheckerFormProps {
  onCheck: (domain: string) => void;
  isLoading: boolean;
}

export function CheckerForm({ onCheck, isLoading }: CheckerFormProps) {
  const [domain, setDomain] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    onCheck(domain.trim().toLowerCase());
  };

  const isValid = domain.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="domain"
          className="text-sm font-medium text-foreground"
        >
          Domain name
        </label>
        <input
          id="domain"
          type="text"
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter a full domain with extension (e.g. mybusiness.com) or just a
          name to check across all popular TLDs.
        </p>
      </div>
      <Button
        type="submit"
        disabled={!isValid || isLoading}
        className="h-10 w-full text-sm font-medium"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot"
                style={{ animationDelay: "0.4s" }}
              />
            </span>
            Checking...
          </span>
        ) : (
          "Check availability"
        )}
      </Button>
    </form>
  );
}
