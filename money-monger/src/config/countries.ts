/**
 * config/countries.ts — typed accessor over the bundled countries.json
 * (city/district names + currency, keyed by id). Used by the host config,
 * join, and board screens to label money and pick a region.
 */
import data from './countries.json';

export type City = { tileIndex: number; name: string };
export type Region = { id: string; name: string; tier: number; cities: City[] };
export type Country = {
  id: string;
  name: string;
  flag: string;
  currency: { symbol: string; name: string; code: string };
  regions?: Region[];
};

export const COUNTRIES = (data as { countries: Country[] }).countries;

export function countryById(id: string): Country | undefined {
  return COUNTRIES.find((c) => c.id === id);
}

export type TileLabel = { name: string; region: string; tier: number };

/** tileIndex → { city name, region, tier } for a country (for board + popups). */
export function tileLabelsFor(id: string): Record<number, TileLabel> {
  const out: Record<number, TileLabel> = {};
  countryById(id)?.regions?.forEach((r) =>
    r.cities.forEach((city) => {
      out[city.tileIndex] = { name: city.name, region: r.name, tier: r.tier };
    }),
  );
  return out;
}
