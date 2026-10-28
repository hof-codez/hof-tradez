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
