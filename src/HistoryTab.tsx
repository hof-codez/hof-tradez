import { useState } from 'react';
import { api, friendly } from './api.ts';
import { consensusFor, outcomeWord } from './history.ts';
import type { HistoryAsset, HistoryTrade } from './types.ts';

type Filter = 'all' | 'pending';

const label = (a: HistoryAsset) =>
  a.pickYear ? `${a.pickYear} round ${a.pickRound} pick` : `${a.name}${a.position ? ` (${a.position})` : ''}`;

export default function HistoryTab({
  token,
  trades,
  setTrades,
  votesLeft,
  onVotesLeft,
  onVoted,
}: {
  token: string;
  trades: HistoryTrade[] | null;
  setTrades: (updater: (prev: HistoryTrade[] | null) => HistoryTrade[] | null) => void;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
  onVoted: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function vote(t: HistoryTrade, outcome: 'a' | 'even' | 'b') {
    setBusy(t.id);
    setErr('');
    try {
      const r = await api.deskVote(token, { kind: 'real', id: t.id, outcome });
      onVotesLeft(r.votesLeft);
      const mine = outcome === 'a' ? 1 : outcome === 'even' ? 0 : -1;
      setTrades((prev) =>
        prev ? prev.map((x) => (x.id === t.id ? { ...x, mine, canVote: false, split: r.split ?? x.split } : x)) : prev,
      );
      onVoted();
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(null);
    }
  }

  if (!trades) return <p className="sub pad">Loading trades…</p>;

  const rows = trades
    .map((t) => ({ t, c: consensusFor(t.split, t.teamA.name, t.teamB.name) }))
    .filter(({ c }) => filter === 'all' || c.state === 'pending');
  const pending = trades.filter((t) => t.split.total < 3).length;

  return (
    <div className="screen">
      <div className="note">
        This is the league's current view of each trade, built from how owners have voted. It can change as more votes come in.
      </div>
      <div className="chips">
        <button className={`pill${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All trades</button>
        <button className={`pill${filter === 'pending' ? ' on' : ''}`} onClick={() => setFilter('pending')}>Needs votes ({pending})</button>
      </div>
      {err && <p className="error">{err}</p>}
      {trades.length === 0 && (
        <div className="card"><p className="sub">No league trades loaded yet. They appear after the next daily sync.</p></div>
      )}
      {rows.length === 0 && trades.length > 0 && (
        <div className="card"><p className="sub">Every trade has enough votes for a read. Nice.</p></div>
      )}
      {rows.map(({ t, c }) => (
        <div className="card" key={t.id}>
          <div className="sidehead">
            <h2>{t.teamA.name} &amp; {t.teamB.name}</h2>
            <span className="meta">{new Date(t.happenedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="meta strong">{t.teamA.name} got</div>
          {t.teamB.gave.map((a) => <div key={a.id} className="line">{label(a)}</div>)}
          <div className="meta strong">{t.teamB.name} got</div>
          {t.teamA.gave.map((a) => <div key={a.id} className="line">{label(a)}</div>)}

          <div className={`verdict ${c.state === 'pending' ? 'close' : c.state === 'even' ? 'fair' : ''} slim`}>
            <div className="vtitle small">{c.text}</div>
            <div className="meta">{c.detail}</div>
          </div>

          {t.mine !== null && <div className="meta">You voted: {outcomeWord(t.mine) === 'a' ? `${t.teamA.name} got the better deal` : outcomeWord(t.mine) === 'b' ? `${t.teamB.name} got the better deal` : 'Even'}</div>}
          {t.canVote && votesLeft > 0 && (
            <>
              <div className="meta">Weigh in (uses one of your daily votes)</div>
              <div className="choices">
                <button className="btn" disabled={busy === t.id} onClick={() => vote(t, 'a')}>{t.teamA.name} got the better deal</button>
                <button className="btn" disabled={busy === t.id} onClick={() => vote(t, 'even')}>Even</button>
                <button className="btn" disabled={busy === t.id} onClick={() => vote(t, 'b')}>{t.teamB.name} got the better deal</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
