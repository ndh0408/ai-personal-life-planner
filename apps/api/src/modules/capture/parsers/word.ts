/**
 * Vietnamese-aware word boundary matcher.
 *
 * JavaScript's default `\b` treats non-ASCII letters (ă, ế, ủ, ờ, ấ…) as
 * non-word characters, so `/\bngủ\b/` fails to match "ngủ". This helper
 * builds a regex that uses Unicode property lookarounds — letters/digits
 * in any script — so VN words match correctly.
 */
export function vnWord(words: string[], flags = 'iu'): RegExp {
  const alt = words.map(escape).join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, flags);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
