import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, friendly } from './api.ts';
import type { BallotAsset } from './types.ts';
import { PosChip, assetMeta } from './ui.tsx';

type Choice = 'keep' | 'trade' | 'cut';
const CHOICES: { id: Choice; label: string }[] = [
  { id: 'keep', label: 'Keep' },
  { id: 'trade', label: 'Trade' },
  { id: 'cut', label: 'Cut' },
];

export default function VoteTab({
  token,
  votesLeft,
  onVotesLeft,
}: {
  token: string;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
}) {
  const [ballot, setBallot] = useState<BallotAsset[] | null>(null);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const next = useCallback(async () => {
    setErr('');
    setPicks({});
    try {
      const r = await api.ballot(token);
      setBallot(r.assets);
      onVotesLeft(r.votesLeft);
    } catch (e) {
      setBallot(null);
      if (e instanceof ApiError && e.code === 'daily_limit') onVotesLeft(0);
      else setErr(friendly(e));
    } finally {
      setLoaded(true);
    }
  }, [token, onVotesLeft]);

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(id: string, c: Choice) {
    setPicks((p) => {
      const out: Record<string, Choice> = {};
      for (const [k, v] of Object.entries(p)) if (v !== c) out[k] = v; // each label once
      if (p[id] !== c) out[id] = c;
      return out;
    });
  }

  async function submit() {
    if (!ballot) return;
    const by = (c: Choice) => ballot.find((a) => picks[a.id] === c)!.id;
    setBusy(true);
    try {
      const r = await api.vote(token, by('keep'), by('trade'), by('cut'));
      onVotesLeft(r.votesLeft);
      setDone((n) => n + 1);
      if (r.votesLeft > 0) await next();
      else setBallot(null);
    } catch (e) {
      setErr(friendly(e));
      if (e instanceof ApiError && (e.code === 'own_asset' || e.code === 'bad_assets')) await next();
      if (e instanceof ApiError && e.code === 'daily_limit') { onVotesLeft(0); setBallot(null); }
    } finally {
      setBusy(false);
    }
  }

  if (loaded && votesLeft <= 0 && !ballot && !err) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>{done > 0 ? 'Thanks, that is today’s votes' : 'No votes left today'}</h2>
          <p className="sub">You get 5 a day. They reset at midnight Arizona time. New values go live when the voting window closes.</p>
        </div>
      </div>
    );
  }

  const ready = ballot && Object.keys(picks).length === 3;

  return (
    <div className="screen">
      <div className="note">Rank these three. Keep your favorite, trade the middle, cut the worst. {votesLeft} vote{votesLeft === 1 ? '' : 's'} left today.</div>
      {!ballot && !err && <p className="sub pad">Loading…</p>}
      {ballot?.map((a) => (
        <div className="card ballot" key={a.id}>
          <div className="row">
            <PosChip a={a} />
            <div className="grow">
              <div className="name big">{a.name}</div>
              <div className="meta">{assetMeta(a)}</div>
            </div>
          </div>
          <div className="seg">
            {CHOICES.map((c) => (
              <button key={c.id} className={`segbtn ${c.id}${picks[a.id] === c.id ? ' on' : ''}`} onClick={() => choose(a.id, c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {err && <p className="error">{err}</p>}
      {ballot && (
        <>
          <button className="btn primary" disabled={!ready || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Submit vote'}
          </button>
          <button className="btn ghost" disabled={busy} onClick={next}>Skip this one</button>
        </>
      )}
      {!ballot && err && <button className="btn ghost" onClick={next}>Try again</button>}
    </div>
  );
}
