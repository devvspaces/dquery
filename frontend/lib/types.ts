export interface DomainResult {
  domain: string;
  name: string;
  extension: string;
  available: boolean;
  prices: RegistrarPrice[];
  bestPrice: number | null;
  /** Word engine only: how the name was built (blend, affix, …). */
  technique?: string;
}

export type AvailabilityStatus = "available" | "taken" | "unknown" | "unsupported";

export interface RegistrarPrice {
  registrar: string;
  registerPrice: number | null;
  renewalPrice: number | null;
  available: boolean;
  /** "unknown" means the registrar check failed — not that the name is taken. */
  status?: AvailabilityStatus;
  threeYearTotal?: number | null;
  isPromo?: boolean;
  premium?: boolean;
  /** Set when the price was converted to USD from the registrar's currency. */
  originalCurrency?: string;
  originalPrice?: number;
  /** Outbound link to buy at this registrar. */
  purchaseUrl?: string;
}

export type SortKey = "price" | "domainLength" | "extensionLength" | "name";
export type SortDirection = "asc" | "desc";

export type Technique =
  | "compound"
  | "blend"
  | "affix"
  | "clip"
  | "respell"
  | "rhyme"
  | "alliterate"
  | "coin"
  | "markov";

export type Feel = "neutral" | "light" | "strong";

/** Mirrors the backend WordEngineConfigDto. */
export interface WordEngineConfig {
  seeds: string[];
  strategies?: Technique[];
  patterns?: string[];
  prefixes?: string[];
  suffixes?: string[];
  useBuiltInAffixes?: boolean;
  minLen?: number;
  maxLen?: number;
  feel?: Feel;
  seed?: number;
}

export interface GeneratedName {
  name: string;
  technique: Technique;
  score: number;
}

export interface GenerateRequest {
  engine: "ai" | "words";
  businessName: string;
  description: string;
  tlds: string[];
  wordEngine?: WordEngineConfig;
}

export interface CheckRequest {
  domain: string;
}
