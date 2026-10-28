import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, friendly } from './api.ts';
import { clear, load, save } from './store.ts';
import { useMemo } from 'react';
import type { Asset, HistoryTrade, LeagueTeam, ValuesPayload } from './types.ts';
import { computeInsights } from './insight.ts';
import OwnersTab from './OwnersTab.tsx';
import Claim from './Claim.tsx';
import ValuesTab from './ValuesTab.tsx';
import TradeTab from './TradeTab.tsx';
import VoteTab from './VoteTab.tsx';
import HistoryTab from './HistoryTab.tsx';
import RulesTab from './RulesTab.tsx';
import type { FitData } from './lineup.ts';
import { brownBellToken, linkTarget, rememberSignOut, takeLinkToken } from './handoff.ts';

type Tab = 'values' | 'trade' | 'history' | 'owners' | 'vote';
interface Cached { meta: ValuesPayload; assets: Asset[] }

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const own = load<string | null>('tc:token', null);
    const linked = takeLinkToken();
    if (linked) {
      if (own !== linked) {
        // different sign-in than before: drop cached values from any other team
        clear('tc:values'); clear('tc:team'); clear('tc:teamId');
      }
      save('tc:token', linked);
      return linked;
    }
    if (own) return own;
    const shared = brownBellToken();
    if (shared) save('tc:token', shared);
    return shared;
  });
  const [showRules, setShowRules] = useState(false);
  const [tab, setTab] = useState<Tab>(() => (linkTarget() === 'history' ? 'history' : 'values'));
  const [history, setHistory] = useState<HistoryTrade[] | null>(null);
  const [data, setData] = useState<Cached | null>(() => load<Cached | null>('tc:values', null));
  const [teamName, setTeamName] = useState<string>(() => load('tc:team', ''));
  const [votesLeft, setVotesLeft] = useState(0);
  const [teamId, setTeamId] = useState<string>(() => load('tc:teamId', ''));
  const [league, setLeague] = useState<LeagueTeam[]>([]);
  const [fit, setFit] = useState<FitData | null>(null);
  const [err, setErr] = useState('');

  const signOut = useCallback((explicit = false) => {
    if (explicit) rememberSignOut();
    clear('tc:token');
    clear('tc:values');
    clear('tc:team');
    clear('tc:teamId');
    setToken(null);
    setData(null);
  }, []);

  const refresh = useCallback(async (t: string) => {
    setErr('');
    try {
      const cached = load<Cached | null>('tc:values', null);
      const r = await api.values(t, cached?.meta.version);
      setVotesLeft(r.votesLeft);
      if (r.unchanged && cached) {
        const next = { meta: { ...cached.meta, ...r, assets: undefined }, assets: cached.assets };
        setData(next);
        save('tc:values', next);
      } else if (r.assets) {
        const next = { meta: { ...r, assets: undefined }, assets: r.assets };
        setData(next);
        save('tc:values', next);
      }
      const me = await api.me(t);
      setTeamName(me.name);
      setTeamId(me.teamId);
      save('tc:team', me.name);
      save('tc:teamId', me.teamId);
      // owner profiles are a bonus: if this fails the rest of the app still works
      api.fitData(t).then(setFit).catch(() => {});
      api.history(t).then((r) => setHistory(r.trades)).catch(() => {});
      api.league(t).then((r) => setLeague((prev) => r.teams.map((x) => ({ ...x, trades: prev.find((q) => q.teamId === x.teamId)?.trades })))).catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_signed_in') return signOut();
      setErr(friendly(e));
    }
  }, [signOut]);

  useEffect(() => {
    if (token) refresh(token);
  }, [token, refresh]);

  // how often each owner trades, from the league's trade history
  const leagueWithTrades = useMemo(() => {
    if (!history) return league;
    const counts = new Map<string, number>();
    for (const tr of history) {
      for (const id of [tr.teamA.id, tr.teamB.id]) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return league.map((x) => ({ ...x, trades: counts.get(x.teamId) ?? 0 }));
  }, [league, history]);

  // Votes change values live, so pull fresh values shortly after a vote (batched).
  const reloadTimer = useRef<number | undefined>(undefined);
  const reloadValues = useCallback(() => {
    if (!token) return;
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(async () => {
      try {
        const cached = load<Cached | null>('tc:values', null);
        const r = await api.values(token, cached?.meta.version);
        if (r.assets) {
          const next = { meta: { ...r, assets: undefined }, assets: r.assets };
          setData(next);
          save('tc:values', next);
        }
      } catch { /* the next full refresh will catch up */ }
    }, 1500);
  }, [token]);

  const insights = useMemo(
    () => computeInsights(leagueWithTrades, new Map((data?.assets ?? []).map((a) => [a.id, a]))),
    [leagueWithTrades, data],
  );

  if (!token) {
    return <Claim onDone={(t) => { save('tc:token', t); setToken(t); }} />;
  }

  return (
    <div className="app">
      <header>
        <div>
          <div className="title">Trade Calc</div>
          <div className="meta">{teamName}</div>
        </div>
        <div>
          <button className="x" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Close' : 'Rules'}</button>{' '}
          <a className="x" href="https://hof-codez.github.io/brownbell/">Brown Bell</a>{' '}
          <button className="x" onClick={() => signOut(true)}>Sign out</button>
        </div>
      </header>
      {err && !data && (
        <div className="screen center">
          <p className="error">{err}</p>
          <button className="btn primary" onClick={() => refresh(token)}>Try again</button>
        </div>
      )}
      {err && data && <div className="banner">{err}</div>}
      {!data && !err && <p className="sub pad">Loading values…</p>}
      <div hidden={showRules}>
      {data && tab === 'values' && <ValuesTab assets={data.assets} meta={data.meta} />}
      {data && tab === 'trade' && (
        <TradeTab fit={fit} assets={data.assets} starPremium={data.meta.starPremium} teams={leagueWithTrades} insights={insights} myTeamId={teamId} />
      )}
      {data && tab === 'owners' && <OwnersTab teams={leagueWithTrades} insights={insights} myTeamId={teamId} />}
      {data && tab === 'vote' && <VoteTab token={token} votesLeft={votesLeft} onVotesLeft={setVotesLeft} maxPerDay={data.meta.maxVotesPerDay} fullWeight={data.meta.fullWeightVotes ?? 5} onVoted={reloadValues} />}
      {data && tab === 'history' && (
        <HistoryTab token={token} myTeamId={teamId} trades={history} setTrades={setHistory} votesLeft={votesLeft} onVotesLeft={setVotesLeft} onVoted={reloadValues} />
      )}
      </div>
      {data && showRules && <RulesTab maxPerDay={data.meta.maxVotesPerDay} fullWeight={data.meta.fullWeightVotes ?? 5} starPremium={data.meta.starPremium} />}
      <nav>
        {(['values', 'trade', 'history', 'owners', 'vote'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setShowRules(false); }}>
            <span className="ico">{t === 'values' ? '▤' : t === 'trade' ? '⇄' : t === 'history' ? '↺' : t === 'owners' ? '☰' : '✓'}</span>
            {t === 'values' ? 'Values' : t === 'trade' ? 'Trade' : t === 'history' ? 'History' : t === 'owners' ? 'Owners' : `Vote${votesLeft > 0 ? ` (${votesLeft})` : ''}`}
          </button>
        ))}
      </nav>
    </div>
  );
}
