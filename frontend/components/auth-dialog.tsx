"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { API_BASE_URL } from "@/lib/config";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const providers = [
  {
    id: "google" as const,
    name: "Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
    bg: "bg-card hover:bg-muted/80",
    border: "border-border",
    disabled: true,
  },
  {
    id: "github" as const,
    name: "GitHub",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    bg: "bg-card hover:bg-muted/80",
    border: "border-border",
    disabled: false,
  },
  {
    id: "twitter" as const,
    name: "X (Twitter)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    bg: "bg-card hover:bg-muted/80",
    border: "border-border",
    disabled: true,
  },
  {
    id: "facebook" as const,
    name: "Facebook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    bg: "bg-card hover:bg-muted/80",
    border: "border-border",
    disabled: true,
  },
];

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const handleSignIn = (provider: "google" | "facebook" | "twitter" | "github") => {
    if (provider !== "github") return;

    setSigningIn("github");
    // Redirect browser to the backend Passport GitHub OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/github`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader className="items-center text-center">
            <LogoMark className="h-10 w-10 mb-3" />
            <DialogTitle className="text-lg font-semibold text-foreground">
              Sign in to DQuery
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Create an account to save searches, bookmark domains, and buy credits.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Providers */}
        <div className="px-6 pb-6 space-y-2">
          {providers.map((provider) => {
            const isLoading = signingIn === provider.id;
            const isDisabled = provider.disabled;

            return (
              <button
                key={provider.id}
                onClick={() => handleSignIn(provider.id)}
                disabled={isDisabled || signingIn !== null}
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                  provider.bg,
                  provider.border,
                  isDisabled && "opacity-40 bg-muted/20 border-muted-foreground/10 hover:bg-transparent cursor-not-allowed select-none",
                  signingIn !== null && signingIn !== provider.id && "opacity-50",
                  "disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse_dot" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse_dot" style={{ animationDelay: "0.2s" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse_dot" style={{ animationDelay: "0.4s" }} />
                    </div>
                    <span className="text-muted-foreground">Connecting...</span>
                  </div>
                ) : (
                  <>
                    {provider.icon}
                    <span className="text-foreground">
                      Continue with {provider.name} {isDisabled && "(Disabled)"}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By continuing, you agree to our{" "}
            <span className="text-foreground underline-offset-2 hover:underline cursor-pointer">Terms of Service</span>
            {" "}and{" "}
            <span className="text-foreground underline-offset-2 hover:underline cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
