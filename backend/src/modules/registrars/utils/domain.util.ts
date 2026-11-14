/**
 * Domain helpers shared by all providers.
 *
 * We only ever check bare registrable names (`name.tld`), never subdomains, so
 * everything after the first dot is the TLD. This handles multi-label public
 * suffixes such as `co.uk` or `com.au` correctly, which `split('.')` into
 * `[name, tld]` did not.
 */

export function normalizeTld(tld: string): string {
  return tld.trim().toLowerCase().replace(/^\.+/, '');
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function toFqdn(domain: string, tld: string): string {
  return `${normalizeName(domain)}.${normalizeTld(tld)}`;
}

export function parseFqdn(fqdn: string): { domain: string; tld: string } {
  const clean = fqdn.trim().toLowerCase().replace(/\.$/, '');
  const dot = clean.indexOf('.');
  if (dot <= 0 || dot === clean.length - 1) {
    return { domain: clean, tld: '' };
  }
  return { domain: clean.slice(0, dot), tld: clean.slice(dot + 1) };
}

/** Parse a price that may be a number, numeric string, or missing. Returns undefined for blanks/NaN. */
export function parsePrice(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Round to cents to avoid float drift (e.g. 8.98 + 9.98 * 2). */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** First year at `register`, then (years - 1) renewals. */
export function multiYearTotal(
  register: number,
  renewal: number,
  years = 3,
): number {
  return roundMoney(register + renewal * Math.max(0, years - 1));
}

export function chunk<T>(array: T[], size: number): T[][] {
  const out: T[][] = [];
  const step = Math.max(1, size);
  for (let i = 0; i < array.length; i += step)
    out.push(array.slice(i, i + step));
  return out;
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as any).response;
    if (res?.status) {
      const body =
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return `HTTP ${res.status}: ${body?.slice(0, 300)}`;
    }
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error) ?? 'Unknown error';
}
