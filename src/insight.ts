import type { Asset, LeagueTeam } from './types.ts';

// Roster-based read on a team, built from the published values. Works from day one,
// before anyone has voted. Starter counts are a rough guess at a typical lineup.
export const STARTERS: Record<string, number> = { QB: 2, RB: 3, WR: 4, TE: 2 };
export const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
export type Pos = (typeof POSITIONS)[number];

export interface RosterInsight {
  posValue: Record<Pos, number>;
  need: Pos[]; // thin spots
  surplus: Pos[]; // deep spots
  avgAge: number | null; // value weighted
  ageLabel: 'Young core' | 'Veteran roster' | null;
  total: number;
  top: Asset[];
}

function topSum(assets: Asset[], pos: Pos): number {
  return assets
    .filter((a) => a.position === pos)
    .map((a) => a.value)
    .sort((x, y) => y - x)
    .slice(0, STARTERS[pos])
    .reduce((s, v) => s + v, 0);
}

export function rosterAssets(team: LeagueTeam, byId: Map<string, Asset>): Asset[] {
  return team.roster.map((id) => byId.get(id)).filter((a): a is Asset => !!a);
}

export function computeInsights(teams: LeagueTeam[], byId: Map<string, Asset>): Map<string, RosterInsight> {
  const rosters = new Map(teams.map((t) => [t.teamId, rosterAssets(t, byId)]));
  const avg: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const pos of POSITIONS) {
    const sums = teams.map((t) => topSum(rosters.get(t.teamId)!, pos));
    avg[pos] = sums.reduce((s, v) => s + v, 0) / Math.max(1, sums.length);
  }

  const out = new Map<string, RosterInsight>();
  for (const t of teams) {
    const assets = rosters.get(t.teamId)!;
    const posValue = { QB: 0, RB: 0, WR: 0, TE: 0 } as Record<Pos, number>;
    const need: Pos[] = [];
    const surplus: Pos[] = [];
    for (const pos of POSITIONS) {
      posValue[pos] = topSum(assets, pos);
      const ratio = avg[pos] > 0 ? posValue[pos] / avg[pos] : 1;
      if (ratio < 0.7) need.push(pos);
      else if (ratio > 1.3) surplus.push(pos);
    }
    const aged = assets.filter((a) => a.age);
    const weight = aged.reduce((s, a) => s + a.value, 0);
    const avgAge = weight > 0 ? aged.reduce((s, a) => s + a.age! * a.value, 0) / weight : null;
    out.set(t.teamId, {
      posValue,
      need,
      surplus,
      avgAge,
      ageLabel: avgAge === null ? null : avgAge <= 25.5 ? 'Young core' : avgAge >= 27.5 ? 'Veteran roster' : null,
      total: assets.reduce((s, a) => s + a.value, 0),
      top: [...assets].sort((a, b) => b.value - a.value).slice(0, 3),
    });
  }
  return out;
}

export interface Idea {
  asset: Asset;
  reasons: string[];
  score: number;
}

// Players from `from` that `to` might want, best fit first.
export function ideasFor(
  from: LeagueTeam,
  to: LeagueTeam,
  insights: Map<string, RosterInsight>,
  byId: Map<string, Asset>,
  exclude: Set<string>,
  count = 4,
  toIsMe = false,
): Idea[] {
  const toIns = insights.get(to.teamId);
  const fromIns = insights.get(from.teamId);
  if (!toIns || !fromIns) return [];
  const traits = new Set(to.traits.map((t) => t.key));
  // wording: "they" when suggesting what to offer them, "you" when suggesting what to ask for
  const they = toIsMe ? 'you' : 'they';
  const their = toIsMe ? 'your' : 'their';
  const fromDeep = toIsMe ? `${from.name} is deep at` : 'You are deep at';

  const ideas: Idea[] = [];
  for (const a of rosterAssets(from, byId)) {
    if (exclude.has(a.id) || !a.position || a.value < 800) continue;
    const pos = a.position as Pos;
    const reasons: string[] = [];
    let score = a.value;

    if (toIns.need.includes(pos)) { reasons.push(`Fills ${their} ${pos} need`); score *= 1.35; }
    if (fromIns.surplus.includes(pos)) { reasons.push(`${fromDeep} ${pos}`); score *= 1.1; }
    if (traits.has(`likes-${pos}`)) { reasons.push(`${they[0].toUpperCase()}${they.slice(1)} tend to like ${pos}s`); score *= 1.15; }
    if (traits.has(`fades-${pos}`)) score *= 0.85;
    if (a.age && a.age <= 24 && traits.has('youth')) { reasons.push(`Fits ${their} youth lean`); score *= 1.15; }
    if (a.age && a.age >= 28 && traits.has('vets')) { reasons.push(`Fits ${their} win-now lean`); score *= 1.15; }

    if (reasons.length) ideas.push({ asset: a, reasons, score });
  }
  return ideas.sort((x, y) => y.score - x.score).slice(0, count);
}

// Plain-language notes for the partner panel.
export function partnerNotes(partner: LeagueTeam, ins: RosterInsight | undefined): string[] {
  const notes: string[] = [];
  if (!ins) return notes;
  if (ins.need.length) notes.push(`Thin at ${ins.need.join(', ')}`);
  if (ins.surplus.length) notes.push(`Deep at ${ins.surplus.join(', ')}`);
  if (ins.ageLabel) notes.push(ins.ageLabel);
  if (partner.traits.some((t) => t.key === 'pick-lover')) notes.push('Adding a pick may sweeten an offer');
  if (partner.traits.some((t) => t.key === 'pick-skeptic')) notes.push('Picks may not move the needle');
  return notes;
}

// ---- availability: how likely is it that this owner would put this player in a trade ----
// Sleeper does not expose rejected trade offers, so this is an estimate from what we can
// see: where the player sits on the owner's roster, depth at his position, whether his age
// fits the owner's direction, and how active the owner is in trades.
export type Availability = 'likely' | 'possible' | 'long-shot';

export interface AvailabilityRead {
  score: number; // 0 to 1
  label: Availability;
  why: string[];
}

export const AVAILABILITY_TEXT: Record<Availability, string> = {
  likely: 'Likely available',
  possible: 'Possibly available',
  'long-shot': 'Long shot',
};

export function medianTrades(teams: LeagueTeam[]): number {
  const counts = teams.map((t) => t.trades).filter((n): n is number => typeof n === 'number').sort((x, y) => x - y);
  if (!counts.length) return 0;
  return counts[Math.floor(counts.length / 2)];
}

export function availability(
  owner: LeagueTeam,
  player: Asset,
  insight: RosterInsight | undefined,
  byId: Map<string, Asset>,
  medianTradeCount: number,
): AvailabilityRead {
  const why: string[] = [];
  let score = 0.5;
  const roster = rosterAssets(owner, byId).filter((a) => a.kind === 'player');
  const overall = [...roster].sort((x, y) => y.value - x.value).findIndex((a) => a.id === player.id) + 1;
  const pos = player.position as Pos | null;

  if (overall === 1) { score -= 0.3; why.push('Their best asset'); }
  else if (overall > 0 && overall <= 3) { score -= 0.2; why.push('A top-3 piece for them'); }

  if (pos && insight) {
    const samePos = roster.filter((a) => a.position === pos).sort((x, y) => y.value - x.value);
    const slot = samePos.findIndex((a) => a.id === player.id) + 1;
    const starters = STARTERS[pos];
    if (slot > starters) { score += 0.25; why.push(`Bench depth behind their ${pos} starters`); }
    else if (slot === starters && slot > 1) { score += 0.05; }
    else if (insight.need.includes(pos)) { score -= 0.15; why.push(`They are thin at ${pos}`); }
    if (insight.surplus.includes(pos)) { score += 0.1; why.push(`They are deep at ${pos}`); }
  }

  const traits = new Set(owner.traits.map((t) => t.key));
  const young = traits.has('youth') || insight?.ageLabel === 'Young core';
  const vets = traits.has('vets') || insight?.ageLabel === 'Veteran roster';
  if (player.age) {
    if (young && player.age >= 28) { score += 0.12; why.push('Older than the core they are building'); }
    if (vets && player.age <= 23) { score += 0.12; why.push('Too young for their win-now lean'); }
    if (young && player.age <= 23) score -= 0.1;
  }

  if (typeof owner.trades === 'number') {
    if (medianTradeCount >= 1 && owner.trades >= medianTradeCount * 1.5) { score += 0.1; why.push('Trades often'); }
    else if (owner.trades === 0 && medianTradeCount >= 2) { score -= 0.08; why.push('Rarely trades'); }
  }

  score = Math.max(0.05, Math.min(0.95, score));
  const label: Availability = score >= 0.62 ? 'likely' : score >= 0.42 ? 'possible' : 'long-shot';
  return { score, label, why };
}
