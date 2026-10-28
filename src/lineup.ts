import type { Asset } from './types.ts';

// Estimates how a trade changes a team's weekly lineup for the rest of the regular season.
// Players are ranked by points per game this season under the league's scoring. A player is
// skipped in weeks he is on bye, and while he is out (OUT, IR, PUP, suspended) for the next
// few weeks. A hole in the lineup is filled by a replacement-level player.

export interface PlayerStatus {
  ppg: number | null;
  games: number;
  inj: string | null;
  bye: number | null;
}

export interface FitData {
  slots: string[];
  lastWeek: number;
  currentWeek: number;
  players: Record<string, PlayerStatus>;
}

export const OUT_WEEKS = 4; // no return date is available, so a hard "out" is assumed to last this long
export const REPLACEMENT_PPG = 4; // what a free agent pickup is assumed to score
const HARD_OUT = new Set(['OUT', 'IR', 'PUP', 'SUS']);

const ELIGIBLE: Record<string, string[]> = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'], WRRB_FLEX: ['RB', 'WR'], REC_FLEX: ['WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

export function isAvailable(st: PlayerStatus | undefined, week: number, currentWeek: number): boolean {
  if (!st) return true;
  if (st.bye === week) return false;
  if (st.inj && HARD_OUT.has(st.inj) && week < currentWeek + OUT_WEEKS) return false;
  if (st.inj === 'DOUBTFUL' && week === currentWeek) return false;
  return true;
}

export interface Starter { slot: string; id: string | null; ppg: number }

export function bestLineup(players: Asset[], fit: FitData, week: number): Starter[] {
  const pool = players
    .filter((p) => p.kind === 'player' && p.position && isAvailable(fit.players[p.id], week, fit.currentWeek))
    .map((p) => ({ id: p.id, pos: p.position as string, ppg: fit.players[p.id]?.ppg ?? 0 }))
    .sort((a, b) => b.ppg - a.ppg);
  const used = new Set<string>();
  // fill the most restrictive slots first so flex spots take what is left
  const slots = fit.slots.filter((s) => ELIGIBLE[s]).sort((a, b) => ELIGIBLE[a].length - ELIGIBLE[b].length);
  const out: Starter[] = [];
  for (const slot of slots) {
    const pick = pool.find((p) => !used.has(p.id) && ELIGIBLE[slot].includes(p.pos));
    if (pick) { used.add(pick.id); out.push({ slot, id: pick.id, ppg: pick.ppg }); }
    else out.push({ slot, id: null, ppg: REPLACEMENT_PPG });
  }
  return out;
}

export type FitLabel = 'helps' | 'hurts' | 'neutral' | 'unknown';

export interface FitResult {
  label: FitLabel;
  perWeek: number; // average change in weekly lineup points
  weeks: number;
  notes: string[];
}

const total = (l: Starter[]) => l.reduce((s, x) => s + x.ppg, 0);

// `roster` is the team's tracked assets right now. `give` leaves, `get` arrives.
export function fitFor(roster: Asset[], give: Asset[], get: Asset[], fit: FitData | null, who: 'you' | 'them' = 'you'): FitResult {
  const you = who;
  const your = who === 'you' ? 'your' : 'their';
  const players = (l: Asset[]) => l.filter((a) => a.kind === 'player');
  const g = players(give);
  const r = players(get);
  if (!fit || !fit.slots.length || (!g.length && !r.length)) return { label: 'unknown', perWeek: 0, weeks: 0, notes: [] };

  const start = Math.max(1, Math.min(fit.currentWeek, fit.lastWeek));
  const weeks: number[] = [];
  for (let w = start; w <= fit.lastWeek; w++) weeks.push(w);

  const giveIds = new Set(g.map((a) => a.id));
  const after = [...roster.filter((a) => !giveIds.has(a.id)), ...r.filter((a) => !roster.some((x) => x.id === a.id))];

  let delta = 0;
  const startsAfter = new Map<string, number>();
  const startsBefore = new Map<string, number>();
  let holesBefore = 0;
  let holesAfter = 0;
  for (const w of weeks) {
    const b = bestLineup(roster, fit, w);
    const a = bestLineup(after, fit, w);
    delta += total(a) - total(b);
    for (const s of b) if (s.id) startsBefore.set(s.id, (startsBefore.get(s.id) ?? 0) + 1);
    for (const s of a) if (s.id) startsAfter.set(s.id, (startsAfter.get(s.id) ?? 0) + 1);
    if (w === start) { holesBefore = b.filter((s) => !s.id).length; holesAfter = a.filter((s) => !s.id).length; }
  }
  const perWeek = delta / Math.max(1, weeks.length);

  const notes: string[] = [];
  for (const p of r) {
    const n = startsAfter.get(p.id) ?? 0;
    notes.push(n > 0 ? `${p.name} would start ${n} of ${weeks.length} weeks for ${you}` : `${p.name} would sit behind ${your} starters`);
  }
  for (const p of g) {
    const n = startsBefore.get(p.id) ?? 0;
    if (n > 0) notes.push(`${p.name} starts ${n} of ${weeks.length} weeks for ${you} now`);
  }
  if (holesAfter < holesBefore) notes.push('Fills an open lineup spot this week');
  const positions = new Set(r.map((p) => p.position));
  const missing = roster.filter((a) => {
    const st = fit.players[a.id];
    return a.kind === 'player' && positions.has(a.position) && st?.inj && (HARD_OUT.has(st.inj) || st.inj === 'DOUBTFUL');
  });
  if (missing.length) notes.push(`Injuries at that spot right now: ${missing.map((m) => `${m.name} (${fit.players[m.id].inj!.toLowerCase()})`).join(', ')}`);

  const label: FitLabel = perWeek >= 1 ? 'helps' : perWeek <= -1 ? 'hurts' : 'neutral';
  return { label, perWeek, weeks: weeks.length, notes };
}

export function fitHeadline(r: FitResult, who: string): string {
  if (r.label === 'unknown') return '';
  const pts = Math.abs(r.perWeek).toFixed(1);
  if (r.label === 'helps') return `${who} lineup gets stronger, about +${pts} points a week`;
  if (r.label === 'hurts') return `${who} lineup gets weaker, about -${pts} points a week`;
  return `${who} lineup stays about the same`;
}
