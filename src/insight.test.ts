import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInsights, ideasFor, partnerNotes } from './insight.ts';
import type { Asset, LeagueTeam } from './types.ts';

const mk = (id: string, position: string, value: number, age = 26): Asset => ({
  id, kind: 'player', name: id, position, team: null, age, pickYear: null, pickRound: null, value,
});
const team = (teamId: string, roster: string[], traits: string[] = []): LeagueTeam => ({
  teamId, name: teamId, roster, confidence: 'early', lean: {},
  traits: traits.map((key) => ({ key, label: key, detail: '' })),
});

// A is stacked at RB and thin at WR. B is the reverse.
const assets = [
  mk('a-rb1', 'RB', 8000, 23), mk('a-rb2', 'RB', 7000, 24), mk('a-rb3', 'RB', 6000, 29), mk('a-wr1', 'WR', 1000),
  mk('b-wr1', 'WR', 8000), mk('b-wr2', 'WR', 7000), mk('b-wr3', 'WR', 6000), mk('b-wr4', 'WR', 5000), mk('b-rb1', 'RB', 500),
];
const byId = new Map(assets.map((a) => [a.id, a]));
const A = team('A', ['a-rb1', 'a-rb2', 'a-rb3', 'a-wr1']);
const B = team('B', ['b-wr1', 'b-wr2', 'b-wr3', 'b-wr4', 'b-rb1'], ['youth']);

test('need and surplus come from comparison with the league', () => {
  const ins = computeInsights([A, B], byId);
  assert.ok(ins.get('A')!.surplus.includes('RB'));
  assert.ok(ins.get('A')!.need.includes('WR'));
  assert.ok(ins.get('B')!.need.includes('RB'));
});

test('ideas favor what the partner needs and their lean', () => {
  const ins = computeInsights([A, B], byId);
  const ideas = ideasFor(A, B, ins, byId, new Set());
  assert.equal(ideas[0].asset.id, 'a-rb1'); // young RB, fills RB need, fits youth lean
  assert.ok(ideas[0].reasons.some((r) => r.includes('RB need')));
  assert.ok(ideas[0].reasons.some((r) => r.includes('youth')));
});

test('excluded players are skipped', () => {
  const ins = computeInsights([A, B], byId);
  const ideas = ideasFor(A, B, ins, byId, new Set(['a-rb1']));
  assert.ok(!ideas.some((i) => i.asset.id === 'a-rb1'));
});

test('partner notes mention needs', () => {
  const ins = computeInsights([A, B], byId);
  assert.ok(partnerNotes(B, ins.get('B')).some((n) => n.startsWith('Thin at')));
});

test('asking-for ideas use second person wording', () => {
  const ins = computeInsights([A, B], byId);
  const ideas = ideasFor(B, A, ins, byId, new Set(), 3, true);
  assert.ok(ideas.length > 0);
  assert.ok(ideas.every((i) => i.reasons.every((r) => !r.includes('their') && !r.startsWith('You are deep'))));
  assert.ok(ideas[0].reasons.some((r) => r.includes('your')));
});

import { availability, medianTrades } from './insight.ts';

test('best asset is a long shot, bench depth is likely available', () => {
  const stacked = [
    mk('s-wr1', 'WR', 9000), mk('s-wr2', 'WR', 7000), mk('s-wr3', 'WR', 6000), mk('s-wr4', 'WR', 5000), mk('s-wr5', 'WR', 2500, 30),
    mk('s-rb1', 'RB', 3000), mk('s-rb2', 'RB', 2800), mk('s-rb3', 'RB', 2600),
  ];
  const map = new Map(stacked.map((a) => [a.id, a]));
  const S = team('S', stacked.map((a) => a.id));
  const ins = computeInsights([S, A], new Map([...map, ...byId]));
  const star = availability(S, map.get('s-wr1')!, ins.get('S'), map, 1);
  const bench = availability(S, map.get('s-wr5')!, ins.get('S'), map, 1);
  assert.equal(star.label, 'long-shot');
  assert.ok(bench.score > star.score);
  assert.ok(bench.why.some((w) => w.includes('Bench depth')));
});

test('trade activity nudges availability and median ignores missing counts', () => {
  const p = mk('p1', 'WR', 3000);
  const m = new Map([[p.id, p]]);
  const base: LeagueTeam = { ...team('T', ['p1']), trades: 0 };
  const busy: LeagueTeam = { ...base, trades: 6 };
  const quiet = availability(base, p, undefined, m, 2);
  const active = availability(busy, p, undefined, m, 2);
  assert.ok(active.score > quiet.score);
  assert.equal(medianTrades([{ ...base, trades: undefined }, busy]), 6);
});
