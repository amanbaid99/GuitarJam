/** House style: no em or en dashes. Safe on both client and server. */
export function noDashesPure(text: string): string {
  return text
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s\u2013\s/g, ", ")
    .replace(/\u2013/g, "-")
}
