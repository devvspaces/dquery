export interface DomainResult {
  domain: string;
  name: string;
  extension: string;
  available: boolean;
  prices: RegistrarPrice[];
  bestPrice: number | null;
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
}

export type SortKey = "price" | "domainLength" | "extensionLength" | "name";
export type SortDirection = "asc" | "desc";

export interface GenerateRequest {
  businessName: string;
  description: string;
  tlds: string[];
}

export interface CheckRequest {
  domain: string;
}
