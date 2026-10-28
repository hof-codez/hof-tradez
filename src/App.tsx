import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, friendly } from './api.ts';
import { clear, load, save } from './store.ts';
import { useMemo } from 'react';
import type { Asset, LeagueTeam, ValuesPayload } from './types.ts';
import { computeInsights } from './insight.ts';
import OwnersTab from './OwnersTab.tsx';
import Claim from './Claim.tsx';
import ValuesTab from './ValuesTab.tsx';
import TradeTab from './TradeTab.tsx';
import VoteTab from './VoteTab.tsx';
import { brownBellToken, rememberSignOut, takeLinkToken } from './handoff.ts';

type Tab = 'values' | 'trade' | 'owners' | 'vote';
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
  const [tab, setTab] = useState<Tab>('values');
  const [data, setData] = useState<Cached | null>(() => load<Cached | null>('tc:values', null));
  const [teamName, setTeamName] = useState<string>(() => load('tc:team', ''));
  const [votesLeft, setVotesLeft] = useState(0);
  const [teamId, setTeamId] = useState<string>(() => load('tc:teamId', ''));
  const [league, setLeague] = useState<LeagueTeam[]>([]);
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
      Promise.all([api.league(t), api.tradeFeed(t).catch(() => null)])
        .then(([r, feed]) => {
          const counts = new Map<string, number>();
          for (const tr of feed?.trades ?? []) {
            for (const id of [tr.teamA.id, tr.teamB.id]) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
          }
          setLeague(r.teams.map((x) => ({ ...x, trades: feed ? counts.get(x.teamId) ?? 0 : undefined })));
        })
        .catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_signed_in') return signOut();
      setErr(friendly(e));
    }
  }, [signOut]);

  useEffect(() => {
    if (token) refresh(token);
  }, [token, refresh]);

  const insights = useMemo(
    () => computeInsights(league, new Map((data?.assets ?? []).map((a) => [a.id, a]))),
    [league, data],
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
      {data && tab === 'values' && <ValuesTab assets={data.assets} meta={data.meta} />}
      {data && tab === 'trade' && (
        <TradeTab assets={data.assets} starPremium={data.meta.starPremium} teams={league} insights={insights} myTeamId={teamId} />
      )}
      {data && tab === 'owners' && <OwnersTab teams={league} insights={insights} myTeamId={teamId} />}
      {data && tab === 'vote' && <VoteTab token={token} votesLeft={votesLeft} onVotesLeft={setVotesLeft} maxPerDay={data.meta.maxVotesPerDay} fullWeight={data.meta.fullWeightVotes ?? 5} />}
      <nav>
        {(['values', 'trade', 'owners', 'vote'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            <span className="ico">{t === 'values' ? '▤' : t === 'trade' ? '⇄' : t === 'owners' ? '☰' : '✓'}</span>
            {t === 'values' ? 'Values' : t === 'trade' ? 'Trade' : t === 'owners' ? 'Owners' : `Vote${votesLeft > 0 ? ` (${votesLeft})` : ''}`}
          </button>
        ))}
      </nav>
    </div>
  );
}
