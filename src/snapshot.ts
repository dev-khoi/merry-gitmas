export interface ContributionDay {
  date: string;
  count: number;
}

export interface Language {
  name: string;
  color: string;
  repositories: number;
}

export interface Snapshot {
  version: 1;
  login: string;
  accountId: string;
  year: number;
  observedOn: string;
  contributionSource: 'github-visible' | 'demo';
  days: ContributionDay[];
  languages: Language[];
}

export const DAY_MS = 86_400_000;
export const dateString = (date: Date): string => date.toISOString().slice(0, 10);

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && dateString(new Date(value)) === value;
}

export function validateSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('Snapshot must be an object.');
  const s = value as Snapshot;
  if (s.version !== 1) throw new Error('Unsupported snapshot version. Expected 1.');
  if (typeof s.login !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(s.login)) {
    throw new Error('Snapshot needs a valid GitHub login.');
  }
  if (typeof s.accountId !== 'string' || !s.accountId.length) throw new Error('Missing account identity.');
  if (!Number.isInteger(s.year) || s.year < 2008 || s.year > 9999) throw new Error('Invalid snapshot year.');
  const start = `${s.year}-01-01`;
  if (!isDate(s.observedOn) || s.observedOn < start || s.observedOn > `${s.year}-12-31`) {
    throw new Error('Observation date must be inside the selected year.');
  }
  if (!['github-visible', 'demo'].includes(s.contributionSource)) throw new Error('Unknown contribution source.');
  if (!Array.isArray(s.days)) throw new Error('Missing daily contribution history.');
  const expected = Math.round((Date.parse(s.observedOn) - Date.parse(start)) / DAY_MS) + 1;
  if (s.days.length !== expected) throw new Error(`Incomplete calendar: expected ${expected} daily entries.`);
  s.days.forEach((day, i) => {
    if (!day || day.date !== dateString(new Date(Date.parse(start) + i * DAY_MS))
      || !Number.isSafeInteger(day.count) || day.count < 0) {
      throw new Error(`Invalid, missing, or out-of-order contribution day at index ${i}.`);
    }
  });
  if (!Array.isArray(s.languages)) throw new Error('Missing language information.');
  const names = new Set<string>();
  for (const language of s.languages) {
    if (!language || typeof language.name !== 'string' || !language.name.length || names.has(language.name)
      || !/^#[a-f\d]{6}$/i.test(language.color) || !Number.isSafeInteger(language.repositories) || language.repositories < 1) {
      throw new Error('Invalid or duplicate language entry.');
    }
    names.add(language.name);
  }
  return s;
}

export function createDemoSnapshot(): Snapshot {
  const start = Date.parse('2026-01-01');
  const end = Date.parse('2026-11-14');
  const days: ContributionDay[] = [];
  for (let time = start, i = 0; time <= end; time += DAY_MS, i++) {
    // Deliberate quiet weeks and a long spring streak, rather than random noise.
    const week = Math.floor((i + 3) / 7); // Jan 1, 2026 is Thursday.
    const active = week % 13 !== 0 && week % 17 !== 0;
    const count = active && i % 7 !== 6 ? (i * 17 + 3) % 9 : 0;
    days.push({ date: dateString(new Date(time)), count });
  }
  return validateSnapshot({
    version: 1, login: 'octocat', accountId: 'demo-octocat', year: 2026,
    observedOn: '2026-11-14', contributionSource: 'demo', days,
    languages: [
      { name: 'TypeScript', color: '#3178c6', repositories: 8 },
      { name: 'JavaScript', color: '#f1e05a', repositories: 4 },
      { name: 'Rust', color: '#dea584', repositories: 3 },
      { name: 'Python', color: '#3572a5', repositories: 2 },
    ],
  });
}
