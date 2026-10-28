import type { Asset } from './types.ts';

// Stars are worth more than the same total spread over depth. starPremium 0 is plain
// addition. Higher values make one 8000 asset beat two 5000 assets by a wider margin.
export function adjusted(value: number, starPremium: number): number {
  return 10000 * Math.pow(Math.max(0, value) / 10000, 1 + starPremium);
}

export function sideTotal(assets: Asset[], starPremium: number): number {
  return Math.round(assets.reduce((sum, a) => sum + adjusted(a.value, starPremium), 0));
}

export interface Verdict {
  a: number;
  b: number;
  gap: number; // positive means side A is ahead
  pct: number; // gap as a share of the bigger side, 0 to 1
  label: 'empty' | 'fair' | 'close' | 'lopsided';
  winner: 'A' | 'B' | null;
}

export function judge(a: Asset[], b: Asset[], starPremium: number): Verdict {
  const ta = sideTotal(a, starPremium);
  const tb = sideTotal(b, starPremium);
  const gap = ta - tb;
  const big = Math.max(ta, tb);
  const pct = big === 0 ? 0 : Math.abs(gap) / big;
  let label: Verdict['label'] = 'lopsided';
  if (a.length === 0 || b.length === 0) label = 'empty';
  else if (pct <= 0.05) label = 'fair';
  else if (pct <= 0.15) label = 'close';
  return { a: ta, b: tb, gap, pct, label, winner: gap === 0 ? null : gap > 0 ? 'A' : 'B' };
}

// Assets that would roughly close the gap if added to the trailing side.
export function balanceIdeas(
  gap: number,
  all: Asset[],
  used: Set<string>,
  starPremium: number,
  count = 3,
): Asset[] {
  const target = Math.abs(gap);
  if (target < 150) return [];
  return all
    .filter((a) => !used.has(a.id))
    .map((a) => ({ a, miss: Math.abs(adjusted(a.value, starPremium) - target) }))
    .sort((x, y) => x.miss - y.miss)
    .slice(0, count)
    .map((x) => x.a);
}

// Framed as the league's view, not a winner and a percentage. Side A is what you give,
// side B is what you get, so when A is worth more the other side comes out better.
export function consensusText(v: Verdict, partnerName?: string): string {
  if (v.label === 'empty') return 'Add assets to both sides';
  if (v.label === 'fair') return 'The league consensus sees this as a fair trade';
  const favors = v.winner === 'A' ? partnerName ?? 'the other side' : 'you';
  return v.label === 'close'
    ? `The league consensus sees this as a close call that leans toward ${favors}`
    : `The league consensus sees this as heavily one-sided toward ${favors}`;
}
