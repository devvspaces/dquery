"use client";

export function EmptyStateGenerate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-foreground">
        Generate domain names
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Enter your business name and we will generate creative domain
        suggestions with real-time pricing across registrars.
      </p>
    </div>
  );
}

export function EmptyStateCheck() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-foreground">
        Check domain availability
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Type any domain to instantly check availability and compare
        prices across multiple registrars.
      </p>
    </div>
  );
}
