import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSnapshot, validateSnapshot, DAY_MS, dateString, type Snapshot } from '../src/snapshot.js';
import { deriveTreeState } from '../src/tree-state.js';
import { collectSnapshot } from '../src/github.js';

function emptyYear(year: number): Snapshot {
  const days = [];
  for (let time = Date.parse(`${year}-01-01`); time <= Date.parse(`${year}-12-31`); time += DAY_MS) days.push({ date: dateString(new Date(time)), count: 0 });
  return validateSnapshot({ version: 1, login: 'octocat', accountId: 'test', year, observedOn: `${year}-12-31`, contributionSource: 'demo', days, languages: [] });
}

test('calendar boundary days survive weekly bucketing, including a 54-week leap year', () => {
  for (const year of [2024, 2026, 2012]) {
    const snapshot = emptyYear(year);
    snapshot.days[0].count = 2;
    snapshot.days.at(-1)!.count = 3;
    const state = deriveTreeState(snapshot);
    assert.equal(state.weeks[0].count, 2);
    assert.equal(state.weeks.at(-1)!.count, 3);
    assert.equal(state.contributions, 5);
    assert.equal(state.activeWeeks, 2);
    assert.equal(state.weeks.length, year === 2012 ? 54 : 53);
  }
});

test('earliest longest streak wins; zero activity still produces an attractive tree', () => {
  const snapshot = emptyYear(2026);
  const state = deriveTreeState(snapshot);
  assert.equal(state.longestStreak, 0);
  assert.equal(state.scale, 0.7);
  assert.equal(state.fullness, 0.5);
  for (const date of ['2026-01-05', '2026-01-12', '2026-02-02', '2026-02-09']) snapshot.days.find(day => day.date === date)!.count = 1;
  const active = deriveTreeState(snapshot);
  assert.equal(active.longestStreak, 2);
  assert.deepEqual(active.weeks.filter(week => week.longest).map(week => week.startsOn), ['2026-01-05', '2026-01-12']);
});

test('snapshot validation rejects gaps, duplicate dates, invalid counts and colors', () => {
  const sample = createDemoSnapshot();
  const copy = () => structuredClone(sample);
  const missing = copy(); missing.days.splice(10, 1);
  assert.throws(() => validateSnapshot(missing), /Incomplete calendar/);
  const duplicate = copy(); duplicate.days[10] = duplicate.days[9];
  assert.throws(() => validateSnapshot(duplicate), /out-of-order/);
  const negative = copy(); negative.days[0].count = -1;
  assert.throws(() => validateSnapshot(negative), /contribution day/);
  const invalid = copy(); invalid.languages[0].color = 'red';
  assert.throws(() => validateSnapshot(invalid), /language entry/);
});

test('appearance is stable across re-renders and independent of input language order', () => {
  const a = createDemoSnapshot();
  const b = structuredClone(a); b.languages.reverse();
  assert.deepEqual(deriveTreeState(a), deriveTreeState(b));
  assert.equal(a.days.length, 318);
});

test('collection paginates languages, excludes forks, and ends at yesterday UTC', async () => {
  const requests: Record<string, unknown>[] = [];
  const responses = [
    { user: { id: 'stable-id', login: 'Octocat', createdAt: '2026-01-02T08:00:00Z', contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: [
      { date: '2026-01-02', contributionCount: 2 }, { date: '2026-01-03', contributionCount: 4 },
    ] }] } } } },
    { user: { repositories: { nodes: [
      { isFork: false, primaryLanguage: { name: 'Rust', color: '#dea584' } },
      { isFork: true, primaryLanguage: { name: 'Java', color: '#b07219' } },
    ], pageInfo: { hasNextPage: true, endCursor: 'next' } } } },
    { user: { repositories: { nodes: [
      { isFork: false, primaryLanguage: { name: 'Rust', color: '#dea584' } },
      { isFork: false, primaryLanguage: { name: 'Unknown', color: null } },
    ], pageInfo: { hasNextPage: false, endCursor: null } } } },
  ];
  const fetcher: typeof fetch = async (_url, options) => {
    requests.push(JSON.parse(options!.body as string));
    return Response.json({ data: responses.shift() });
  };
  const snapshot = await collectSnapshot('octocat', 2026, 'test-token', new Date('2026-01-04T16:30:00Z'), fetcher);
  assert.deepEqual(snapshot.days.map(day => day.count), [0, 2, 4]);
  assert.equal(snapshot.observedOn, '2026-01-03');
  assert.equal(snapshot.login, 'Octocat');
  assert.deepEqual(snapshot.languages, [
    { name: 'Rust', color: '#dea584', repositories: 2 },
    { name: 'Unknown', color: '#d9a73c', repositories: 1 },
  ]);
  assert.equal((requests[0].variables as Record<string, string>).to, '2026-01-03T23:59:59Z');
  assert.equal((requests[2].variables as Record<string, string>).cursor, 'next');
});

test('a failed API request or missing calendar never becomes an empty tree', async () => {
  await assert.rejects(collectSnapshot('octocat', 2026, 'token', new Date('2026-01-04'), async () => new Response('', { status: 403 })), /HTTP 403/);
  await assert.rejects(collectSnapshot('octocat', 2026, 'token', new Date('2026-01-04'), async () => Response.json({ data: {
    user: { id: 'id', login: 'octocat', createdAt: '2010-01-01', contributionsCollection: { contributionCalendar: { weeks: [] } } },
  } })), /missing 2026-01-01/);
});
