import { bestLineup, type FitData } from './lineup.ts';
import { sideTotal } from './trade.ts';
import type { Asset, HistoryDetail, SnapPlayer } from './types.ts';

// A plain-language read of why each side might have made a trade, from the rosters as they
// stood before it. It is an estimate: points per game up to that week, today's trade values,
// and injury status only when the snapshot was taken near the trade.

export interface SideStory {
  name: string;
  thesis: string;
  pros: string[];
  cons: string[];
  lineupDelta: number;
}

const HARD_OUT = new Set(['OUT', 'IR', 'PUP', 'SUS']);
const MAX_BULLETS = 4;

const toAsset = (p: SnapPlayer, value: number): Asset => ({
  id: p.id, kind: 'player', name: p.name, position: p.pos, team: null, age: p.age, pickYear: null, pickRound: null, value,
});

const avgAge = (l: SnapPlayer[]) => {
  const ages = l.map((p) => p.age).filter((a): a is number => typeof a === 'number');
  return ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null;
};

function sideStory(
  d: HistoryDetail, name: string, mine: SnapPlayer[], theirs: SnapPlayer[], gaveIds: string[], gotIds: string[],
): SideStory {
  const snap = d.snapshot!;
  const val = (id: string) => d.values[id] ?? 0;
  const pid = (id: string) => id.replace(/^p:/, '');
  const gavePlayers = gaveIds.filter((i) => i.startsWith('p:')).map((i) => mine.find((p) => p.id === pid(i))).filter(Boolean) as SnapPlayer[];
  const gotPlayers = gotIds.filter((i) => i.startsWith('p:')).map((i) => theirs.find((p) => p.id === pid(i))).filter(Boolean) as SnapPlayer[];
  const gavePicks = gaveIds.filter((i) => !i.startsWith('p:'));
  const gotPicks = gotIds.filter((i) => !i.startsWith('p:'));

  const fit: FitData = {
    slots: d.slots, lastWeek: snap.week, currentWeek: snap.week,
    players: Object.fromEntries([...mine, ...theirs].map((p) => [p.id, {
      ppg: p.ppg, games: p.games, inj: snap.injuriesKnown ? p.inj : null, bye: p.bye ?? null,
    }])),
  };
  const gaveSet = new Set(gavePlayers.map((p) => p.id));
  const before = mine.map((p) => toAsset(p, val(`p:${p.id}`)));
  const after = [...before.filter((a) => !gaveSet.has(a.id)), ...gotPlayers.map((p) => toAsset(p, val(`p:${p.id}`)))];
  const sb = bestLineup(before, fit, snap.week);
  const sa = bestLineup(after, fit, snap.week);
  const sum = (l: { ppg: number }[]) => l.reduce((s, x) => s + x.ppg, 0);
  const delta = sum(sa) - sum(sb);
  const startedBefore = new Set(sb.filter((s) => s.id).map((s) => s.id));
  const startAfter = new Set(sa.filter((s) => s.id).map((s) => s.id));
  const holesBefore = sb.filter((s) => !s.id).length;
  const holesAfter = sa.filter((s) => !s.id).length;

  const asAsset = (id: string): Asset => {
    const a = d.assets[id];
    return { id, kind: a?.kind ?? 'pick', name: a?.name ?? id, position: a?.position ?? null, team: null, age: a?.age ?? null, pickYear: a?.pickYear ?? null, pickRound: a?.pickRound ?? null, value: val(id) };
  };
  const gaveVal = sideTotal(gaveIds.map(asAsset), d.starPremium);
  const gotVal = sideTotal(gotIds.map(asAsset), d.starPremium);
  const pct = gaveVal > 0 ? (gotVal - gaveVal) / gaveVal : 0;

  const basis = snap.basis === 'this' ? `points per game through week ${Math.max(1, snap.week - 1)}` : "last season's points per game";
  const ppgText = (p: SnapPlayer) => (p.ppg === null ? 'no recent games' : `${p.ppg.toFixed(1)} ppg`);

  // Bye weeks over the next six weeks: does the trade cover a week with nobody to start, or open one?
  const slotName = (slot: string) => (slot.includes('FLEX') ? 'flex spot' : `${slot} spot`);
  const byeCover: string[] = [];
  const byeOpen: string[] = [];
  for (let w = snap.week; w <= Math.min(18, snap.week + 5); w++) {
    const onBye = mine.filter((p) => p.bye === w);
    if (!onBye.length) continue;
    const hb = bestLineup(before, fit, w).filter((x) => !x.id);
    const ha = bestLineup(after, fit, w).filter((x) => !x.id);
    if (ha.length < hb.length) {
      const incoming = gotPlayers.filter((p) => p.bye !== w).map((p) => p.name).slice(0, 2).join(' and ');
      byeCover.push(`Covers the week ${w} bye: ${onBye.map((p) => p.name).join(', ')} is out that week and there was no one else to fill the ${slotName(hb[0].slot)}${incoming ? `, so ${incoming} can play` : ''}`);
    } else if (ha.length > hb.length) {
      byeOpen.push(`Leaves a hole in week ${w} when ${onBye.map((p) => p.name).join(', ')} is on bye`);
    }
  }
  const sameBye = gotPlayers.filter((p) => p.bye && mine.some((m) => m.pos === p.pos && m.bye === p.bye && startedBefore.has(m.id)));

  const pros: string[] = [];
  const cons: string[] = [];

  const newStarters = gotPlayers.filter((p) => startAfter.has(p.id));
  if (delta >= 1) {
    pros.push(`Lineup gets stronger, about +${delta.toFixed(1)} points a week (${basis})${newStarters.length ? `. ${newStarters.map((p) => `${p.name} (${p.pos}, ${ppgText(p)})`).join(', ')} would start` : ''}`);
  }
  if (holesAfter < holesBefore) pros.push('Fills an open starting spot that had no one to play');
  if (byeCover.length) pros.push(byeCover[0]);
  if (pct >= 0.08) pros.push(`Takes in more trade value by today's numbers (about ${Math.round(pct * 100)}% more)`);
  const gaveStarters = gavePlayers.filter((p) => startedBefore.has(p.id));
  if (gavePlayers.length && !gaveStarters.length && delta > -1) pros.push('Gave up players who were not starting, so the lineup cost is small');
  const ageIn = avgAge(gotPlayers);
  const ageOut = avgAge(gavePlayers);
  if (ageIn !== null && ageOut !== null && ageIn <= ageOut - 2) pros.push(`Gets younger (average age ${ageIn.toFixed(0)} coming in, ${ageOut.toFixed(0)} going out)`);
  if (gotPicks.length && !gavePicks.length) pros.push(`Adds draft capital (${gotPicks.length} pick${gotPicks.length > 1 ? 's' : ''})`);
  const topIn = Math.max(0, ...gotIds.map(val));
  const topOut = Math.max(0, ...gaveIds.map(val));
  if (gotIds.length < gaveIds.length && topIn > topOut) pros.push('Turns several pieces into one higher-value player');
  if (gotIds.length > gaveIds.length) pros.push('Turns one asset into several, which adds depth');
  if (snap.injuriesKnown) {
    const hurt = gavePlayers.filter((p) => p.inj && HARD_OUT.has(p.inj));
    if (hurt.length) pros.push(`Moves ${hurt.map((p) => `${p.name} (${p.inj!.toLowerCase()})`).join(', ')} while he was hurt`);
  }

  if (delta <= -1) cons.push(`Lineup gets weaker, about -${Math.abs(delta).toFixed(1)} points a week (${basis})`);
  if (holesAfter > holesBefore) cons.push('Leaves a starting spot with no one to play');
  if (byeOpen.length) cons.push(byeOpen[0]);
  if (sameBye.length) cons.push(`${sameBye[0].name} shares a bye week (${sameBye[0].bye}) with a starter at the same position`);
  if (pct <= -0.08) cons.push(`Gives up more trade value by today's numbers (about ${Math.round(Math.abs(pct) * 100)}% less coming back)`);
  if (gaveStarters.length) cons.push(`Gives up ${gaveStarters.length > 1 ? 'starters' : 'a starter'}: ${gaveStarters.map((p) => `${p.name} (${p.pos}, ${ppgText(p)})`).join(', ')}`);
  if (ageIn !== null && ageOut !== null && ageIn >= ageOut + 2) cons.push(`Gets older (average age ${ageIn.toFixed(0)} coming in, ${ageOut.toFixed(0)} going out)`);
  if (gavePicks.length && !gotPicks.length) cons.push(`Spends draft capital (${gavePicks.length} pick${gavePicks.length > 1 ? 's' : ''})`);
  if (gotIds.length < gaveIds.length && !(topIn > topOut)) cons.push('Sends out more pieces than come back, so depth drops');
  if (snap.injuriesKnown) {
    const hurt = gotPlayers.filter((p) => p.inj && HARD_OUT.has(p.inj));
    if (hurt.length) cons.push(`Takes on ${hurt.map((p) => `${p.name} (${p.inj!.toLowerCase()})`).join(', ')}, who was hurt at the time`);
  }

  let thesis: string;
  if (delta >= 1) thesis = 'Potential thinking: strengthen the weekly lineup';
  else if (byeCover.length) thesis = 'Potential thinking: cover a bye-week hole at a position with no other starter';
  else if (pct >= 0.08 && delta <= -1) thesis = 'Potential thinking: give up some lineup strength for more long-term value';
  else if (pct >= 0.08) thesis = 'Potential thinking: add value';
  else if ((ageIn !== null && ageOut !== null && ageIn <= ageOut - 2) || (gotPicks.length && !gavePicks.length)) thesis = 'Potential thinking: get younger and build for later';
  else if (delta <= -1) thesis = 'Potential thinking: not clear from the numbers, the lineup takes a hit';
  else thesis = 'Potential thinking: a roughly even swap that is hard to explain from the numbers';

  return {
    name, thesis,
    pros: pros.length ? pros.slice(0, MAX_BULLETS) : ['No clear edge from the numbers we have'],
    cons: cons.length ? cons.slice(0, MAX_BULLETS) : ['No clear cost from the numbers we have'],
    lineupDelta: delta,
  };
}

export function tradeStory(d: HistoryDetail, nameA: string, nameB: string): { a: SideStory; b: SideStory } | null {
  if (!d.snapshot || !d.slots.length) return null;
  const { rosterA, rosterB } = d.snapshot;
  return {
    a: sideStory(d, nameA, rosterA, rosterB, d.sideA, d.sideB),
    b: sideStory(d, nameB, rosterB, rosterA, d.sideB, d.sideA),
  };
}
