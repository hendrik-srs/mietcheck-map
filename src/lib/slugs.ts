/**
 * Stable URL-safe slugs for the 12 Berlin Bezirke.
 *
 * We deliberately enumerate them rather than slugifying database names at
 * request time so that:
 *   - The set is build-time-known (next/static-params can pre-render all
 *     /bezirk/[slug] pages without a DB call during build)
 *   - Umlaut handling ("Köpenick" → "koepenick", not "kopenick") is explicit
 *     and matches German URL conventions
 *   - Renames in the DB don't silently break existing URLs / SEO inbound
 *     links
 *
 * If a future ingestion adds a Bezirk that's not in this list (e.g. a city
 * outside Berlin) the lookup returns null and the page falls back to 404 —
 * we'll add the entry intentionally rather than have a half-broken page.
 */

export interface BerlinBezirk {
  slug: string;
  name: string;
}

export const BERLIN_BEZIRKE: BerlinBezirk[] = [
  { slug: "charlottenburg-wilmersdorf", name: "Charlottenburg-Wilmersdorf" },
  { slug: "friedrichshain-kreuzberg", name: "Friedrichshain-Kreuzberg" },
  { slug: "lichtenberg", name: "Lichtenberg" },
  { slug: "marzahn-hellersdorf", name: "Marzahn-Hellersdorf" },
  { slug: "mitte", name: "Mitte" },
  { slug: "neukoelln", name: "Neukölln" },
  { slug: "pankow", name: "Pankow" },
  { slug: "reinickendorf", name: "Reinickendorf" },
  { slug: "spandau", name: "Spandau" },
  { slug: "steglitz-zehlendorf", name: "Steglitz-Zehlendorf" },
  { slug: "tempelhof-schoeneberg", name: "Tempelhof-Schöneberg" },
  { slug: "treptow-koepenick", name: "Treptow-Köpenick" },
];

const BY_SLUG: ReadonlyMap<string, string> = new Map(
  BERLIN_BEZIRKE.map((b) => [b.slug, b.name]),
);

const BY_NAME: ReadonlyMap<string, string> = new Map(
  BERLIN_BEZIRKE.map((b) => [b.name, b.slug]),
);

export function bezirkNameForSlug(slug: string): string | null {
  return BY_SLUG.get(slug) ?? null;
}

export function bezirkSlugForName(name: string): string | null {
  return BY_NAME.get(name) ?? null;
}
