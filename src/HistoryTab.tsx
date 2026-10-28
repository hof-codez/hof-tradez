import { useState } from 'react';
import { api, friendly } from './api.ts';
import { consensusFor, outcomeWord } from './history.ts';
import { tradeStory, type SideStory } from './tradeStory.ts';
import type { HistoryAsset, HistoryDetail, HistoryTrade, SnapPlayer } from './types.ts';

type Filter = 'all' | 'pending';

const label = (a: HistoryAsset) =>
  a.pickYear ? `${a.pickYear} round ${a.pickRound} pick` : `${a.name}${a.position ? ` (${a.position})` : ''}`;

export default function HistoryTab({
  token,
  myTeamId,
  trades,
  setTrades,
  votesLeft,
  onVotesLeft,
  onVoted,
}: {
  token: string;
  myTeamId: string;
  trades: HistoryTrade[] | null;
  setTrades: (updater: (prev: HistoryTrade[] | null) => HistoryTrade[] | null) => void;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
  onVoted: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, HistoryDetail | 'loading' | 'error'>>({});

  async function toggleWhy(t: HistoryTrade) {
    if (open === t.id) { setOpen(null); return; }
    setOpen(t.id);
    if (details[t.id] && details[t.id] !== 'error') return;
    setDetails((d) => ({ ...d, [t.id]: 'loading' }));
    try {
      const r = await api.historyDetail(token, t.id);
      setDetails((d) => ({ ...d, [t.id]: r }));
    } catch {
      setDetails((d) => ({ ...d, [t.id]: 'error' }));
    }
  }

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
      <div className="meta">You can't vote on trades you were part of or ones that involve players on your roster.</div>
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

          <button className="btn ghost" onClick={() => toggleWhy(t)}>
            {open === t.id ? 'Hide the thinking' : 'Why would they do this?'}
          </button>
          {open === t.id && <Why d={details[t.id]} nameA={t.teamA.name} nameB={t.teamB.name} />}

          {t.mine !== null && <div className="meta">You voted: {outcomeWord(t.mine) === 'a' ? `${t.teamA.name} got the better deal` : outcomeWord(t.mine) === 'b' ? `${t.teamB.name} got the better deal` : 'Even'}</div>}
          {t.mine === null && !t.canVote && (t.teamA.id === myTeamId || t.teamB.id === myTeamId) && (
            <div className="meta">You were part of this trade, so you can't vote on it.</div>
          )}
          {t.mine === null && !t.canVote && t.teamA.id !== myTeamId && t.teamB.id !== myTeamId && (
            <div className="meta">You can't vote on this one. It involves a player or pick on your roster, or a player no longer tracked.</div>
          )}
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

function SideBlock({ s }: { s: SideStory }) {
  return (
    <div className="why-side">
      <div className="meta strong">{s.name}</div>
      <div className="vtitle small">{s.thesis}</div>
      <div className="meta strong">For</div>
      {s.pros.map((x) => <div key={x} className="line">+ {x}</div>)}
      <div className="meta strong">Against</div>
      {s.cons.map((x) => <div key={x} className="line">- {x}</div>)}
    </div>
  );
}

function Roster({ name, players, moved }: { name: string; players: SnapPlayer[]; moved: Set<string> }) {
  return (
    <details>
      <summary className="meta">{name} before the trade ({players.length} QB/RB/WR/TE)</summary>
      {players.map((p) => (
        <div key={p.id} className={`line${moved.has(p.id) ? ' strong' : ''}`}>
          {p.name} ({p.pos}){p.ppg !== null ? `, ${p.ppg.toFixed(1)} ppg` : ''}{moved.has(p.id) ? ' (in the trade)' : ''}
        </div>
      ))}
    </details>
  );
}

function Why({ d, nameA, nameB }: { d: HistoryDetail | 'loading' | 'error' | undefined; nameA: string; nameB: string }) {
  if (!d || d === 'loading') return <p className="sub">Loading…</p>;
  if (d === 'error') return <p className="error">Could not load this one. Try again.</p>;
  if (!d.snapshot) return <p className="sub">No roster snapshot for this trade yet. Snapshots are built during the daily sync.</p>;
  const story = tradeStory(d, nameA, nameB);
  const moved = new Set([...d.sideA, ...d.sideB].filter((i) => i.startsWith('p:')).map((i) => i.slice(2)));
  const s = d.snapshot;
  return (
    <div className="why">
      {story && <SideBlock s={story.a} />}
      {story && <SideBlock s={story.b} />}
      <Roster name={nameA} players={s.rosterA} moved={moved} />
      <Roster name={nameB} players={s.rosterB} moved={moved} />
      <div className="meta">
        An estimate, not what either owner said. Rosters are rebuilt from Sleeper's transaction log. Points per game are{' '}
        {s.basis === 'this' ? `this season through week ${Math.max(1, s.week - 1)}` : "from last season, since the trade came before enough games were played"}.
        Trade values are today's. {s.injuriesKnown ? 'Injury status was captured near the trade.' : 'Injury status at the time is not available for this trade.'}
      </div>
    </div>
  );
}
