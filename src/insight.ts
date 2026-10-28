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

  const ideas: (Idea & { score: number })[] = [];
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
  return ideas.sort((x, y) => y.score - x.score).slice(0, count).map(({ asset, reasons }) => ({ asset, reasons }));
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
