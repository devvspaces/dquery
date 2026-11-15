/** Names requested per generation run. */
export const GENERATION_COUNT = 15;

/** Max TLDs per generation (enforced by the backend too). */
export const MAX_TLDS = 10;

/** TLDs checked when the user enters a bare name in the checker. */
export const POPULAR_TLDS = [".com", ".net", ".org", ".io", ".co", ".dev", ".ai", ".app"];

/** How many domains a checker query expands to. */
export function checkerDomainCount(query: string): number {
  return query.includes(".") ? 1 : POPULAR_TLDS.length;
}
