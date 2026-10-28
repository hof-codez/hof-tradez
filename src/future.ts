import { sideTotal } from './trade.ts';
import type { FitData, PlayerStatus } from './lineup.ts';
import type { Asset } from './types.ts';

// "Fit for the future": how a trade changes a team's dynasty value over the next few seasons.
// Each player's value is projected forward with an expected-production curve by position and age:
// how much a player of that age usually produces compared with his prime. Projected value is
// today's value times the change in that index. Picks hold today's value. This is an age and
// position estimate only. It does not know about injuries, role changes or talent, and the
// curves are rough dynasty rules of thumb, not fitted to league data.

// index by age, starting at the first listed age. Ages past the end use the last number.
const CURVE: Record<string, { from: number; v: number[] }> = {
  QB: { from: 21, v: [0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.65, 0.5, 0.35] },
  RB: { from: 21, v: [0.9, 0.95, 1, 1, 0.97, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2] },
  WR: { from: 21, v: [0.85, 0.9, 0.95, 1, 1, 1, 1, 0.95, 0.88, 0.78, 0.65, 0.55, 0.4] },
  TE: { from: 21, v: [0.75, 0.8, 0.85, 0.92, 0.97, 1, 1, 1, 1, 1, 0.9, 0.8, 0.65, 0.45] },
};
export const HORIZONS = [1, 2, 3];

export function ageIndex(position: string | null, age: number | null): number {
  if (!age) return 1;
  const c = CURVE[position ?? ''] ?? CURVE.WR;
  const i = Math.floor(age) - c.from;
  return c.v[Math.max(0, Math.min(c.v.length - 1, i))];
}

// Players who score above what their touches support tend to slip the next year. In a backtest of
// 2015 to 2025, each point per game above usage was followed by about 0.56 fewer points the next season.
const GAP_FADE = 0.56;
const VALUE_STEEPNESS = 1.6; // values scale with points per game to about this power
const MIN_USAGE_GAMES = 4;

export function gapMultiplier(st: PlayerStatus | undefined): number {
  if (!st || st.gap === null || st.gap === undefined || !st.ug || st.ug < MIN_USAGE_GAMES) return 1;
  const now = st.ppg ?? 0;
  if (now < 3) return 1;
  const ratio = Math.max(0.7, Math.min(1.1, (now - GAP_FADE * st.gap) / now));
  const weight = Math.min(1, st.ug / 10); // few games, less trust
  return 1 + weight * (Math.pow(ratio, VALUE_STEEPNESS) - 1);
}

// Value of one asset `years` seasons from now
export function projectValue(a: Asset, years: number, st?: PlayerStatus): number {
  if (a.kind === 'pick' || years === 0) return a.value;
  const age = a.age ? ageIndex(a.position, a.age + years) / ageIndex(a.position, a.age) : 1;
  return Math.max(0, Math.min(10000, a.value * age * gapMultiplier(st)));
}

const at = (list: Asset[], years: number, fit?: FitData | null): Asset[] =>
  list.map((a) => ({ ...a, value: projectValue(a, years, fit?.players[a.id]) }));

export type FutureLabel = 'builds' | 'costs' | 'neutral' | 'unknown';

export interface FutureResult {
  label: FutureLabel;
  rows: { years: number; get: number; give: number }[]; // years 0 = today
  shift: number; // change in (get - give) from today to two seasons out, as a share of what is given today
  notes: string[];
}

export function futureFor(give: Asset[], get: Asset[], starPremium: number, who: 'you' | 'them' = 'you', fit?: FitData | null): FutureResult {
  if (!give.length && !get.length) return { label: 'unknown', rows: [], shift: 0, notes: [] };
  const rows = [0, ...HORIZONS].map((y) => ({
    years: y,
    get: sideTotal(at(get, y, fit), starPremium),
    give: sideTotal(at(give, y, fit), starPremium),
  }));
  const now = rows[0].get - rows[0].give;
  const two = rows.find((r) => r.years === 2)!;
  const base = Math.max(1000, rows[0].give, rows[0].get);
  const shift = (two.get - two.give - now) / base;
  const label: FutureLabel = shift >= 0.08 ? 'builds' : shift <= -0.08 ? 'costs' : 'neutral';

  const notes: string[] = [];
  const change = (a: Asset) => (a.value > 0 ? projectValue(a, 2, fit?.players[a.id]) / a.value - 1 : 0);
  const you = who === 'you' ? 'You' : 'They';
  for (const a of get.filter((x) => x.kind === 'player' && x.age)) {
    const c = change(a);
    if (c >= 0.15) notes.push(`${a.name} (${a.position}, ${Math.floor(a.age!)}) is young enough to gain value, about +${Math.round(c * 100)}% in two seasons`);
    else if (c <= -0.2) notes.push(`${a.name} (${a.position}, ${Math.floor(a.age!)}) is likely to lose value, about ${Math.round(c * 100)}% in two seasons`);
  }
  for (const a of give.filter((x) => x.kind === 'player' && x.age)) {
    const c = change(a);
    if (c <= -0.2) notes.push(`${you} sell ${a.name} (${a.position}, ${Math.floor(a.age!)}) before an expected drop of about ${Math.round(Math.abs(c) * 100)}%`);
    else if (c >= 0.15) notes.push(`${you} give up ${a.name} (${a.position}, ${Math.floor(a.age!)}), who is expected to gain about +${Math.round(c * 100)}%`);
  }
  // scoring above or below what the player's touches support
  const usageNote = (a: Asset, side: 'get' | 'give'): string | null => {
    const st = fit?.players[a.id];
    if (!st || st.gap === null || st.gap === undefined || !st.ug || st.ug < MIN_USAGE_GAMES || a.kind !== 'player') return null;
    const g = Math.abs(st.gap).toFixed(1);
    if (st.gap >= 2) return side === 'get' ? `${a.name} scores ${g} points a game above what his usage supports, so his value may slip` : `${you} sell ${a.name} while he scores ${g} above his usage, which tends to fade`;
    if (st.gap <= -2) return side === 'get' ? `${a.name} scores ${g} points a game below what his usage supports, so he may bounce back` : `${you} give up ${a.name}, who scores ${g} below his usage and may bounce back`;
    return null;
  };
  for (const a of get) { const n = usageNote(a, 'get'); if (n) notes.push(n); }
  for (const a of give) { const n = usageNote(a, 'give'); if (n) notes.push(n); }
  const gotPicks = get.filter((x) => x.kind === 'pick').length;
  const gavePicks = give.filter((x) => x.kind === 'pick').length;
  if (gotPicks > gavePicks) notes.push('Picks hold their value, which steadies the long view');
  return { label, rows, shift, notes: notes.slice(0, 5) };
}

export function futureHeadline(r: FutureResult, who: string): string {
  if (r.label === 'unknown') return '';
  const pct = Math.round(Math.abs(r.shift) * 100);
  if (r.label === 'builds') return `${who} future gets stronger, about ${pct}% better off in two seasons than today`;
  if (r.label === 'costs') return `${who} future gets weaker, about ${pct}% worse off in two seasons than today`;
  return `${who} future stays about the same`;
}
