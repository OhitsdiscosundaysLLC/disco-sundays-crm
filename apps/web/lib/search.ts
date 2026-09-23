/**
 * Strips characters that would break a PostgREST `.or()` filter string
 * (comma separates conditions, parens group them) before it's interpolated
 * into one.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%]/g, " ").trim().slice(0, 100);
}
