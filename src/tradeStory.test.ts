import test from 'node:test';
import assert from 'node:assert';
import { tradeStory } from './tradeStory.ts';
import type { HistoryDetail, SnapPlayer } from './types.ts';

const P = (id: string, pos: string, ppg: number, age = 25): SnapPlayer => ({ id, name: id, pos, age, ppg, games: 6, inj: null });

const detail = (): HistoryDetail => ({
  snapshot: {
    season: 2026, week: 8, basis: 'this', injuriesKnown: false,
    // A is thin at WR, deep at RB. B is the reverse.
    rosterA: [P('rb1', 'RB', 18), P('rb2', 'RB', 15), P('rb3', 'RB', 14), P('wr1', 'WR', 9), P('qb', 'QB', 20), P('te', 'TE', 8)],
    rosterB: [P('wrx', 'WR', 16), P('wr2', 'WR', 14), P('wr3', 'WR', 13), P('wr4', 'WR', 12), P('rbx', 'RB', 7), P('qb2', 'QB', 18), P('te2', 'TE', 9)],
  },
  sideA: ['p:rb3'], sideB: ['p:wrx'],
  slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'FLEX'], starPremium: 0.3,
  values: { 'p:rb3': 2000, 'p:wrx': 2100 }, assets: {},
});

test('a team thin at WR gains lineup points by sending a bench RB for a WR', () => {
  const s = tradeStory(detail(), 'A', 'B')!;
  assert.ok(s.a.lineupDelta > 0);
  assert.ok(s.a.pros[0].startsWith('Lineup gets stronger'));
  assert.ok(s.a.thesis.includes('strengthen'));
});

test('returns null without a snapshot', () => {
  const d = detail(); d.snapshot = null;
  assert.strictEqual(tradeStory(d, 'A', 'B'), null);
});

test('always gives something to show on both lists', () => {
  const s = tradeStory(detail(), 'A', 'B')!;
  for (const side of [s.a, s.b]) { assert.ok(side.pros.length > 0); assert.ok(side.cons.length > 0); }
});

test('a trade that covers a bye-week hole says so', () => {
  const d: HistoryDetail = {
    snapshot: {
      season: 2026, week: 8, basis: 'this', injuriesKnown: false,
      // A has one TE, on bye in week 9. B's TE is not.
      rosterA: [P('qb', 'QB', 20), { ...P('te1', 'TE', 9), bye: 9 }, P('rb1', 'RB', 15), P('wr1', 'WR', 14), P('wr2', 'WR', 13)],
      rosterB: [P('qb2', 'QB', 18), { ...P('te2', 'TE', 7), bye: 5 }, P('rb2', 'RB', 12), P('wr3', 'WR', 12), P('x', 'WR', 5)],
    },
    sideA: ['p:wr2'], sideB: ['p:te2'],
    slots: ['QB', 'RB', 'WR', 'TE'], starPremium: 0.3,
    values: { 'p:wr2': 1500, 'p:te2': 1500 }, assets: {},
  };
  const s = tradeStory(d, 'A', 'B')!;
  assert.ok(s.a.pros.some((x) => x.includes('week 9 bye')), s.a.pros.join(' | '));
});
