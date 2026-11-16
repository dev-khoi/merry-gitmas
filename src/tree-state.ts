import {
  DAY_MS,
  dateString,
  validateSnapshot,
  type Snapshot,
} from "./snapshot.js";

export interface WeekLight {
  index: number;
  startsOn: string;
  count: number;
  observed: boolean;
  longest: boolean;
}

export interface TreeState {
  login: string;
  year: number;
  seed: number;
  contributions: number;
  activeWeeks: number;
  longestStreak: number;
  scale: number;
  fullness: number;
  twinkle: number;
  weeks: WeekLight[];
  languages: { name: string; color: string; share: number }[];
  observedOn: string;
  demo: boolean;
}

export function identitySeed(identity: string): number {
  let hash = 2166136261;
  for (const char of identity)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function deriveTreeState(input: Snapshot): TreeState {
  const snapshot = validateSnapshot(input);
  const start = Date.parse(`${snapshot.year}-01-01`);
  const end = Date.parse(`${snapshot.year}-12-31`);
  const mondayOffset = (new Date(start).getUTCDay() + 6) % 7;
  const firstMonday = start - mondayOffset * DAY_MS;
  // Calendar years touch 53 (occasionally 54) Monday-based weeks. Keep all of
  // them rather than silently dropping days to force a 52-light decoration.
  const weeks: WeekLight[] = Array.from(
    { length: Math.floor((end - firstMonday) / (7 * DAY_MS)) + 1 },
    (_, index) => {
      const startsOn = dateString(new Date(firstMonday + index * 7 * DAY_MS));
      return {
        index,
        startsOn,
        count: 0,
        observed: startsOn <= snapshot.observedOn,
        longest: false,
      };
    },
  );
  let contributions = 0;
  let recent = 0;
  const recentStart = Date.parse(snapshot.observedOn) - 6 * DAY_MS;
  for (const day of snapshot.days) {
    contributions += day.count;
    weeks[
      Math.floor((Date.parse(day.date) - firstMonday) / (7 * DAY_MS))
    ].count += day.count;
    if (Date.parse(day.date) >= recentStart) recent += day.count;
  }
  let run = 0;
  let longestStreak = 0;
  let longestEnd = -1;
  for (const week of weeks) {
    run = week.count > 0 ? run + 1 : 0;
    if (run > longestStreak) {
      longestStreak = run;
      longestEnd = week.index;
    }
  }
  for (let i = longestEnd - longestStreak + 1; i <= longestEnd && i >= 0; i++)
    weeks[i].longest = true;
  const growth = Math.min(1, Math.sqrt(contributions / 5000));
  const repositoryTotal = snapshot.languages.reduce(
    (sum, language) => sum + language.repositories,
    0,
  );
  return {
    login: snapshot.login,
    year: snapshot.year,
    seed: identitySeed(snapshot.accountId),
    // A recognizable baseline with modest, capped growth even for very active accounts.
    contributions,
    activeWeeks: weeks.filter((week) => week.count > 0).length,
    longestStreak,
    scale: 0.82 + 0.253 * growth,
    fullness: 0.55 + 0.2 * growth,
    twinkle: Math.min(1, recent / 100),
    weeks,
    languages: [...snapshot.languages]
      .sort(
        (a, b) =>
          b.repositories - a.repositories || a.name.localeCompare(b.name, "en"),
      )
      .map((language) => ({
        name: language.name,
        color: language.color,
        share: language.repositories / repositoryTotal,
      })),
    observedOn: snapshot.observedOn,
    demo: snapshot.contributionSource === "demo",
  };
}
