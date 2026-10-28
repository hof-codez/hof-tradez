import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjusted, judge, balanceIdeas } from './trade.ts';
import type { Asset } from './types.ts';

const mk = (id: string, value: number): Asset => ({
  id, kind: 'player', name: id, position: 'WR', team: null, age: null, pickYear: null, pickRound: null, value,
});

test('no premium is plain addition', () => {
  const v = judge([mk('a', 4000), mk('b', 3000)], [mk('c', 7000)], 0);
  assert.equal(v.gap, 0);
  assert.equal(v.label, 'fair');
});

test('premium makes one star beat two mid assets of equal total', () => {
  const v = judge([mk('a', 4000), mk('b', 3000)], [mk('c', 7000)], 0.3);
  assert.equal(v.winner, 'B');
  assert.ok(v.pct > 0.05);
});

test('empty side is flagged', () => {
  assert.equal(judge([], [mk('a', 100)], 0.3).label, 'empty');
});

test('balance ideas pick the closest value and skip used assets', () => {
  const pool = [mk('x', 2000), mk('y', 2600), mk('z', 9000)];
  const ideas = balanceIdeas(2500, pool, new Set(['y']), 0, 2);
  assert.equal(ideas[0].id, 'x');
  assert.ok(!ideas.some((i) => i.id === 'y'));
});

test('adjusted keeps 10000 at 10000', () => {
  assert.equal(Math.round(adjusted(10000, 0.5)), 10000);
});

import { consensusText } from './trade.ts';

test('consensus wording names who it leans toward, never a percentage', () => {
  const a = [{ id: 'a', kind: 'player', name: 'a', position: 'WR', team: null, age: 25, pickYear: null, pickRound: null, value: 9000 }] as any[];
  const b = [{ id: 'b', kind: 'player', name: 'b', position: 'WR', team: null, age: 25, pickYear: null, pickRound: null, value: 2000 }] as any[];
  const heavy = consensusText(judge(a, b, 0.3), 'Sam');
  assert.ok(heavy.includes('heavily one-sided toward Sam'));
  assert.ok(consensusText(judge(b, a, 0.3), 'Sam').includes('toward you'));
  assert.ok(!/\d%/.test(heavy));
  assert.ok(consensusText(judge(a, a, 0.3)).includes('fair'));
  assert.equal(consensusText(judge([], b, 0.3)), 'Add assets to both sides');
});
