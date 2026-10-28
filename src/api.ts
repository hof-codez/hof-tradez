import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.ts';
import type { FitData } from './lineup.ts';
import type { DeskItem, LeagueTeam, SelfPreview, TeamOption, ValuesPayload, VoteResult } from './types.ts';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('offline', 0, 'No connection. Try again when you are online.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || 'server_error', res.status, data?.message || data?.error);
  }
  return data as T;
}

const tc = <T,>(action: string, token: string | null, extra: Record<string, unknown> = {}) =>
  call<T>('tc-api', { action, deviceToken: token, ...extra });

export const api = {
  teams: () => tc<{ teams: TeamOption[] }>('teams', null),
  me: (t: string) => tc<{ teamId: string; name: string; votesLeft: number; preview: SelfPreview }>('me', t),
  league: (t: string) => tc<{ teams: LeagueTeam[] }>('league', t),
  values: (t: string, since?: number) => tc<ValuesPayload>('values', t, { since }),
  tradeFeed: (t: string) => tc<{ trades: { teamA: { id: string | null }; teamB: { id: string | null } }[] }>('trade_feed', t),
  fitData: (t: string) => tc<FitData>('fit_data', t),
  desk: (t: string) => tc<DeskItem>('desk', t),
  deskVote: (t: string, payload: Record<string, unknown>) => tc<VoteResult>('desk_vote', t, payload),
  // Reuses Brown Bell's existing claim function: same PINs, same device tokens.
  claim: (teamId: string, pin: string, deviceLabel: string) =>
    call<{ success: boolean; deviceToken: string; action: 'claimed' | 'unlocked' }>('claim-team', {
      teamId,
      pin,
      deviceLabel,
    }),
};

export function friendly(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'offline': return e.message;
      case 'daily_limit': return 'You hit today’s vote limit. It resets at midnight Arizona time.';
      case 'own_asset': return 'That one included one of your players. Loading a new one.';
      case 'offer_expired': return 'That offer timed out. Loading a new one.';
      case 'already_voted': return 'You already voted on that one. Loading a new one.';
      case 'not_signed_in': return 'Your sign in expired. Sign in again.';
      default: return e.message && e.message !== 'server_error' ? e.message : 'Something went wrong. Try again.';
    }
  }
  return 'Something went wrong. Try again.';
}
