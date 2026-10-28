import test from 'node:test';
import assert from 'node:assert';
import { futureFor, projectValue } from './future.ts';
import type { Asset } from './types.ts';

const P = (id: string, pos: string, age: number, value: number): Asset => ({
  id, kind: 'player', name: id, position: pos, team: null, age, pickYear: null, pickRound: null, value,
});
const pick: Asset = { id: 'pick:2027:1:1', kind: 'pick', name: '2027 1st', position: null, team: null, age: null, pickYear: 2027, pickRound: 1, value: 3000 };

test('a 27 year old RB loses value and a 22 year old WR gains it', () => {
  assert.ok(projectValue(P('a', 'RB', 27, 5000), 2) < 3000);
  assert.ok(projectValue(P('b', 'WR', 22, 5000), 2) >= 5000 * 1.1);
  assert.strictEqual(projectValue(pick, 3), 3000);
});

test('selling an aging RB for a young WR of equal value builds the future', () => {
  const r = futureFor([P('rb', 'RB', 27, 5000)], [P('wr', 'WR', 22, 5000)], 0.3);
  assert.strictEqual(r.label, 'builds');
  assert.ok(r.notes.some((n) => n.includes('sell rb') || n.includes('wr')));
});

test('the reverse costs the future', () => {
  const r = futureFor([P('wr', 'WR', 22, 5000)], [P('rb', 'RB', 27, 5000)], 0.3);
  assert.strictEqual(r.label, 'costs');
});

test('empty trade is unknown', () => {
  assert.strictEqual(futureFor([], [], 0.3).label, 'unknown');
});

test('a player scoring well above his usage is marked down, one below is marked up', () => {
  const fit = { slots: [], lastWeek: 14, currentWeek: 8, players: {
    hot: { ppg: 16, games: 8, inj: null, bye: null, gap: 4, ug: 8 },
    cold: { ppg: 10, games: 8, inj: null, bye: null, gap: -4, ug: 8 },
  } };
  const hot = P('hot', 'WR', 25, 5000), cold = P('cold', 'WR', 25, 5000);
  assert.ok(projectValue(hot, 1, fit.players.hot) < 5000);
  assert.ok(projectValue(cold, 1, fit.players.cold) > 5000);
  assert.strictEqual(projectValue(hot, 0, fit.players.hot), 5000);
  const r = futureFor([hot], [cold], 0.3, 'you', fit as any);
  assert.ok(r.notes.some((n) => n.includes('bounce back')));
});

test('stance weights shift the chance and a range is returned', async () => {
  const { futureFor, stanceFromRecord } = await import('./future.ts');
  const old = { id: 'o', kind: 'player', name: 'Old', position: 'RB', age: 29, value: 3000 } as any;
  const young = { id: 'y', kind: 'player', name: 'Young', position: 'WR', age: 22, value: 3000 } as any;
  const win = futureFor([young], [old], 0, 'you', null, 'win');
  const build = futureFor([young], [old], 0, 'you', null, 'build');
  assert.ok(win.chance! > build.chance!);
  assert.ok(win.range!.lo < win.range!.hi);
  assert.equal(stanceFromRecord({ rank: 1, size: 12 }), 'win');
  assert.equal(stanceFromRecord({ rank: 12, size: 12 }), 'build');
  assert.equal(stanceFromRecord({ rank: 6, size: 12 }), 'balanced');
  assert.equal(stanceFromRecord(null), 'balanced');
});
