import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestLineup, fitFor, fitHeadline, isAvailable } from './lineup.ts';
import type { FitData } from './lineup.ts';
import type { Asset } from './types.ts';

const mk = (id: string, position: string, name = id): Asset => ({
  id, kind: 'player', name, position, team: null, age: 26, pickYear: null, pickRound: null, value: 3000,
});
const st = (ppg: number, inj: string | null = null, bye: number | null = null) => ({ ppg, games: 6, inj, bye });

const fit = (players: FitData['players'], slots = ['QB', 'RB', 'RB', 'WR', 'WR', 'FLEX']): FitData => ({
  slots, lastWeek: 14, currentWeek: 8, players,
});

test('availability skips byes and hard injuries for a few weeks', () => {
  assert.equal(isAvailable(st(10, null, 9), 9, 8), false);
  assert.equal(isAvailable(st(10, 'OUT'), 10, 8), false);
  assert.equal(isAvailable(st(10, 'OUT'), 12, 8), true);
  assert.equal(isAvailable(st(10, 'QUESTIONABLE'), 8, 8), true);
  assert.equal(isAvailable(st(10, 'DOUBTFUL'), 9, 8), true);
});

test('lineup fills specific slots first, then flex', () => {
  const roster = [mk('q', 'QB'), mk('r1', 'RB'), mk('r2', 'RB'), mk('r3', 'RB'), mk('w1', 'WR'), mk('w2', 'WR')];
  const f = fit({ q: st(20), r1: st(15), r2: st(14), r3: st(13), w1: st(12), w2: st(8) });
  const l = bestLineup(roster, f, 8);
  assert.equal(l.length, 6);
  assert.equal(l.find((s) => s.slot === 'FLEX')!.id, 'r3');
});

test('a lesser WR can help more than the RB you send out when WR is depleted', () => {
  // WR1 and WR2 are out for a month, RB depth is deep
  const roster = [mk('q', 'QB'), mk('r1', 'RB'), mk('r2', 'RB'), mk('r3', 'RB'), mk('r4', 'RB'), mk('w1', 'WR'), mk('w2', 'WR')];
  const f = fit({
    q: st(20), r1: st(16), r2: st(15), r3: st(14), r4: st(8), w1: st(18, 'OUT'), w2: st(17, 'IR'), newwr: st(13),
  });
  const newwr = mk('newwr', 'WR', 'Lesser WR');
  const res = fitFor(roster, [roster[3]], [newwr], f); // send r3 (the flex), receive a 13 ppg WR
  assert.equal(res.label, 'helps');
  assert.ok(res.notes.some((n) => n.includes('Lesser WR would start')));
  assert.ok(res.notes.some((n) => n.includes('Injuries at that spot')));
  assert.ok(fitHeadline(res, 'Your').includes('stronger'));
});

test('trading a starter for nothing at his spot hurts', () => {
  const roster = [mk('q', 'QB'), mk('r1', 'RB'), mk('r2', 'RB'), mk('w1', 'WR'), mk('w2', 'WR'), mk('w3', 'WR')];
  const f = fit({ q: st(20), r1: st(15), r2: st(14), w1: st(12), w2: st(11), w3: st(10), bench: st(2) });
  const res = fitFor(roster, [roster[1]], [mk('bench', 'RB', 'Bench RB')], f);
  assert.equal(res.label, 'hurts');
});

test('no data means unknown, picks are ignored', () => {
  const roster = [mk('q', 'QB')];
  assert.equal(fitFor(roster, [], [], null).label, 'unknown');
  const pick: Asset = { ...mk('pick:2027:1', 'QB'), kind: 'pick', position: null };
  assert.equal(fitFor(roster, [pick], [], fit({})).label, 'unknown');
});
