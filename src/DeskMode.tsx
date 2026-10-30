import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, friendly } from './api.ts';
import type { DeskItem, RealSplit, VoteResult } from './types.ts';
import { AssetRow } from './ui.tsx';

const MIN_SPLIT = 3; // show how the league voted once this many owners have

function splitText(s: RealSplit): string {
  return `A came out ahead: ${s.aWon}. Even: ${s.even}. B came out ahead: ${s.bWon}. (${s.total} owners)`;
}

// The Offer Desk: judge a trade offer. Mostly made up, sometimes a real one from our league.
export default function DeskMode({
  token,
  votesLeft,
  onVotesLeft,
  onResult,
  onLoaded,
}: {
  token: string;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
  onResult: (r: VoteResult) => void;
  onLoaded: () => void;
}) {
  const [item, setItem] = useState<DeskItem | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [after, setAfter] = useState<{ split: RealSplit | null } | null>(null); // result view for a real trade

  const next = useCallback(async () => {
    setErr('');
    setAfter(null);
    try {
      const r = await api.desk(token);
      setItem(r);
      onVotesLeft(r.votesLeft);
    } catch (e) {
      setItem(null);
      if (e instanceof ApiError && e.code === 'daily_limit') onVotesLeft(0);
      else setErr(friendly(e));
    } finally {
      onLoaded();
    }
  }, [token, onVotesLeft, onLoaded]);

  useEffect(() => {
    if (votesLeft > 0 || !item) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function answer(outcome: string) {
    if (!item) return;
    setBusy(true);
    setErr('');
    try {
      const payload =
        item.kind === 'offer'
          ? { kind: 'offer', receive: item.receive.map((a) => a.id), give: item.give.map((a) => a.id), exp: item.exp, sig: item.sig, outcome }
          : { kind: 'real', id: item.id, outcome };
      const r = await api.deskVote(token, payload);
      onResult(r);
      if (item.kind === 'real' && r.votesLeft > 0) {
        setAfter({ split: r.split && r.split.total >= MIN_SPLIT ? r.split : null });
      } else if (r.votesLeft > 0) {
        await next();
      } else {
        setItem(null);
      }
    } catch (e) {
      setErr(friendly(e));
      if (e instanceof ApiError && ['own_asset', 'offer_expired', 'already_voted', 'bad_assets'].includes(e.code)) await next();
      if (e instanceof ApiError && e.code === 'daily_limit') { onVotesLeft(0); setItem(null); }
    } finally {
      setBusy(false);
    }
  }

  if (!item && !err) return <p className="sub pad">Loading…</p>;

  return (
    <>
      {item?.kind === 'offer' && (
        <>
          <div className="note">
            <span className="tag accent">Offer</span> Made up for this vote. Imagine you own everything here.
          </div>
          <div className="card">
            <h2>You receive</h2>
            {item.receive.map((a) => <AssetRow key={a.id} a={a} />)}
          </div>
          <div className="card">
            <h2>You give</h2>
            {item.give.map((a) => <AssetRow key={a.id} a={a} />)}
          </div>
          <div className="seg">
            <button className="segbtn keep" disabled={busy} onClick={() => answer('accept')}>Accept</button>
            <button className="segbtn trade" disabled={busy} onClick={() => answer('even')}>Toss-up</button>
            <button className="segbtn cut" disabled={busy} onClick={() => answer('decline')}>Decline</button>
          </div>
          <button className="btn ghost" disabled={busy} onClick={next}>Skip this one</button>
        </>
      )}

      {item?.kind === 'real' && (
        <>
          <div className="note">
            <span className="tag good">Real trade</span> Made in our league in {item.year}. Names hidden. Who came out ahead?
          </div>
          <div className="card">
            <h2>Team A gives</h2>
            <div className="meta">Team B receives</div>
            {item.aGave.map((a) => <AssetRow key={a.id} a={a} />)}
          </div>
          <div className="card">
            <h2>Team B gives</h2>
            <div className="meta">Team A receives</div>
            {item.bGave.map((a) => <AssetRow key={a.id} a={a} />)}
          </div>
          {!after ? (
            <>
              <div className="seg">
                <button className="segbtn keep" disabled={busy} onClick={() => answer('a')}>A ahead</button>
                <button className="segbtn trade" disabled={busy} onClick={() => answer('even')}>Even</button>
                <button className="segbtn cut" disabled={busy} onClick={() => answer('b')}>B ahead</button>
              </div>
              <button className="btn ghost" disabled={busy} onClick={next}>Skip this one</button>
            </>
          ) : (
            <>
              <div className="note milestone">
                {after.split ? splitText(after.split) : `Your vote is in. Results show once ${MIN_SPLIT} owners have voted.`}
              </div>
              <button className="btn primary" onClick={next}>Next</button>
            </>
          )}
        </>
      )}

      {err && <p className="error">{err}</p>}
      {!item && err && <button className="btn ghost" onClick={next}>Try again</button>}
    </>
  );
}
