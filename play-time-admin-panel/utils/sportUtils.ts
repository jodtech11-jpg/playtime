import { Sport, Venue } from '../types';

export type SportLookup = Pick<Sport, 'id' | 'name'> & Partial<Sport>;

export interface SportStyle {
  color: string;
  backgroundColor: string;
  borderColor: string;
}

const FALLBACK_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#eab308'];

/** Resolve a sport field that may be a Firestore ID or display name. */
export function resolveSportName(
  sportIdOrName: string | undefined,
  sports: SportLookup[] = []
): string {
  if (!sportIdOrName) return '';
  const byId = sports.find((s) => s.id === sportIdOrName);
  if (byId) return byId.name;
  const byName = sports.find((s) => s.name.toLowerCase() === sportIdOrName.toLowerCase());
  if (byName) return byName.name;
  return sportIdOrName;
}

/** Resolve sport ID from a field that may store ID or name. */
export function resolveSportId(
  sportIdOrName: string | undefined,
  sports: SportLookup[] = []
): string | undefined {
  if (!sportIdOrName) return undefined;
  const byId = sports.find((s) => s.id === sportIdOrName);
  if (byId) return byId.id;
  const byName = sports.find((s) => s.name.toLowerCase() === sportIdOrName.toLowerCase());
  if (byName) return byName.id;
  return undefined;
}

/** Find full sport record from ID or name. */
export function findSport(
  sportIdOrName: string | undefined,
  sports: Sport[] = []
): Sport | undefined {
  if (!sportIdOrName) return undefined;
  return (
    sports.find((s) => s.id === sportIdOrName) ||
    sports.find((s) => s.name.toLowerCase() === sportIdOrName.toLowerCase())
  );
}

/** Match courts whose sport field is stored as id or name. */
export function courtMatchesSport(
  courtSport: string | undefined,
  selectedSport: string,
  sports: SportLookup[] = []
): boolean {
  if (!courtSport || !selectedSport) return false;
  if (courtSport === selectedSport) return true;
  const courtName = resolveSportName(courtSport, sports);
  const selectedName = resolveSportName(selectedSport, sports);
  return courtName.toLowerCase() === selectedName.toLowerCase();
}

/** Sports offered at a venue — falls back to full catalog if venue has none assigned. */
export function getSportsForVenue(
  venue: Pick<Venue, 'sports'> | undefined,
  allSports: Sport[]
): Sport[] {
  const active = allSports.filter((s) => s.isActive !== false);
  const venueSports = venue?.sports?.filter(Boolean) ?? [];
  if (venueSports.length === 0) return active;
  return active.filter((s) =>
    venueSports.some(
      (vs) => vs === s.id || vs.trim().toLowerCase() === s.name.trim().toLowerCase()
    )
  );
}

/** Normalize sportSpecificOptions into selectable entries. */
export function getSportOptionEntries(
  sport: Sport | undefined
): Array<{ key: string; label: string; values: string[] }> {
  if (!sport?.sportSpecificOptions) return [];
  return Object.entries(sport.sportSpecificOptions)
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== '';
    })
    .map(([key, value]) => ({
      key,
      label: formatOptionKey(key),
      values: Array.isArray(value) ? value.map(String) : [String(value)],
    }));
}

export function formatOptionKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function getSportColor(sportName: string, sports: Sport[] = []): string {
  const sport = findSport(sportName, sports);
  if (sport?.color) return sport.color;
  let hash = 0;
  for (let i = 0; i < sportName.length; i++) {
    hash = sportName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function getSportStyle(sportName: string, sports: Sport[] = []): SportStyle {
  const color = getSportColor(sportName, sports);
  return {
    color,
    backgroundColor: `${color}18`,
    borderColor: color,
  };
}

export function buildSportStylesMap(sports: Sport[]): Record<string, SportStyle> {
  const map: Record<string, SportStyle> = {};
  sports.forEach((sport) => {
    if (sport.isActive === false) return;
    map[sport.name] = getSportStyle(sport.name, sports);
  });
  return map;
}

/** Strip empty sport option selections. */
export function cleanSportOptions(options: Record<string, string>): Record<string, string> | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v && v.trim() !== '')
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}
