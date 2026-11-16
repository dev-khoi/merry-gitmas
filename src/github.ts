import { execFileSync } from 'node:child_process';
import { DAY_MS, dateString, validateSnapshot, type Snapshot, type Language } from './snapshot.js';

type Fetch = typeof globalThis.fetch;

export function resolveToken(): string {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token?.trim()) return token.trim();
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (token) return token;
  } catch { /* Report one actionable error without leaking subprocess output. */ }
  throw new Error('Set GH_TOKEN / GITHUB_TOKEN, or sign in with gh auth login. Use demo for an offline tree.');
}

export async function collectSnapshot(login: string, year: number, token: string, now = new Date(), fetcher: Fetch = fetch): Promise<Snapshot> {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) throw new Error('Invalid GitHub username.');
  const currentYear = now.getUTCFullYear();
  if (!Number.isInteger(year) || year < 2008 || year > currentYear) throw new Error(`Year must be between 2008 and ${currentYear}.`);
  const start = `${year}-01-01`;
  const observedOn = year < currentYear ? `${year}-12-31` : dateString(new Date(Date.UTC(currentYear, now.getUTCMonth(), now.getUTCDate()) - DAY_MS));
  if (observedOn < start) throw new Error('This year has no completed UTC day yet. Select the previous year.');
  async function query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'merry-gitmas' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Check token access and API rate limits.`);
    const result = await response.json() as { data?: T; errors?: { message: string }[] };
    if (result.errors?.length || !result.data) {
      throw new Error(`GitHub query failed: ${result.errors?.map(error => error.message).join('; ') ?? 'missing data'}`);
    }
    return result.data;
  }
  const calendar = await query<{
    user: null | { id: string; login: string; createdAt: string; contributionsCollection: { contributionCalendar: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } } };
  }>(`query Calendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) { id login createdAt contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    } }
  }`, { login, from: `${start}T00:00:00Z`, to: `${observedOn}T23:59:59Z` });
  const user = calendar.user;
  if (!user) throw new Error(`GitHub account ${login} was not found.`);
  const collected = new Map<string, number>();
  for (const week of user.contributionsCollection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.date < start || day.date > observedOn) continue;
      if (collected.has(day.date)) throw new Error(`GitHub returned a duplicate calendar day: ${day.date}`);
      collected.set(day.date, day.contributionCount);
    }
  }
  const days = [];
  for (let time = Date.parse(start); time <= Date.parse(observedOn); time += DAY_MS) {
    const date = dateString(new Date(time));
    const count = collected.get(date);
    if (count === undefined && date >= user.createdAt.slice(0, 10)) throw new Error(`GitHub calendar is missing ${date}. Please retry collection.`);
    days.push({ date, count: count ?? 0 });
  }
  const languages = new Map<string, Language>();
  let cursor: string | null = null;
  const cursors = new Set<string>();
  do {
    const repositories: { user: { repositories: {
      nodes: { isFork: boolean; primaryLanguage: { name: string; color: string | null } | null }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    } } } = await query(`query Languages($login: String!, $cursor: String) {
      user(login: $login) { repositories(first: 100, after: $cursor, privacy: PUBLIC, ownerAffiliations: [OWNER], isFork: false) {
        nodes { isFork primaryLanguage { name color } } pageInfo { hasNextPage endCursor }
      } }
    }`, { login, cursor });
    for (const repository of repositories.user.repositories.nodes) {
      const language = repository.primaryLanguage;
      if (repository.isFork || !language) continue;
      const existing = languages.get(language.name);
      languages.set(language.name, { name: language.name, color: language.color ?? '#d9a73c', repositories: (existing?.repositories ?? 0) + 1 });
    }
    const info = repositories.user.repositories.pageInfo;
    if (!info.hasNextPage) break;
    if (!info.endCursor || cursors.has(info.endCursor)) throw new Error('GitHub returned a missing or repeated repository cursor.');
    cursor = info.endCursor;
    cursors.add(cursor);
  } while (true);
  return validateSnapshot({ version: 1, login: user.login, accountId: user.id, year, observedOn,
    contributionSource: 'github-visible', days, languages: [...languages.values()] });
}
