import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, friendly } from './api.ts';
import type { BallotAsset, Milestone, SelfPreview } from './types.ts';
import { PosChip, assetMeta } from './ui.tsx';

type Choice = 'keep' | 'trade' | 'cut';
const CHOICES: { id: Choice; label: string }[] = [
  { id: 'keep', label: 'Keep' },
  { id: 'trade', label: 'Trade' },
  { id: 'cut', label: 'Cut' },
];
const EARLY_AT = 10;
const SOLID_AT = 25;

function labels(p: SelfPreview): string {
  return p.traits.length ? p.traits.map((t) => t.label).join(', ') : 'no strong lean yet';
}

function milestoneText(m: Milestone, p: SelfPreview, maxPerDay: number, fullWeight: number): string | null {
  if (m === 'early') {
    return `Early read unlocked. So far you look like: ${labels(p)}. Other owners see this after tomorrow's update, and it gets sharper as you vote.`;
  }
  if (m === 'solid') {
    return `Solid read unlocked. You look like: ${labels(p)}. Other owners see it after tomorrow's update.`;
  }
  if (m === 'weight') {
    return `That's ${fullWeight} for today. Keep going, up to ${maxPerDay}. Votes past ${fullWeight} count half toward league values today, but they still sharpen your profile.`;
  }
  return null;
}

export default function VoteTab({
  token,
  votesLeft,
  onVotesLeft,
  maxPerDay,
  fullWeight,
}: {
  token: string;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
  maxPerDay: number;
  fullWeight: number;
}) {
  const [ballot, setBallot] = useState<BallotAsset[] | null>(null);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<SelfPreview | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

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
    api.me(token).then((m) => setPreview(m.preview)).catch(() => {});
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
      setPreview(r.preview);
      setDone((n) => n + 1);
      setBanner(milestoneText(r.milestone, r.preview, maxPerDay, fullWeight));
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

  const readPanel = preview && (
    <div className="card">
      <div className="sidehead">
        <h2>Your read so far</h2>
        {preview.confidence !== 'none' && (
          <span className="tag">{preview.confidence === 'early' ? 'Early read' : 'Solid read'}</span>
        )}
      </div>
      {preview.confidence === 'none' ? (
        <p className="sub small">
          {Math.max(0, EARLY_AT - preview.totalVotes)} more vote{EARLY_AT - preview.totalVotes === 1 ? '' : 's'} to unlock your early read.
        </p>
      ) : (
        <>
          <div className="tags">
            {preview.traits.length === 0 && <span className="meta">No strong lean yet</span>}
            {preview.traits.map((t) => <span key={t.key} className="tag accent" title={t.detail}>{t.label}</span>)}
          </div>
          {preview.confidence === 'early' && (
            <p className="sub small">{Math.max(0, SOLID_AT - preview.totalVotes)} more votes for a solid read.</p>
          )}
        </>
      )}
      <p className="sub small">Only you see this live. Other owners see your profile after the daily update.</p>
    </div>
  );

  if (loaded && votesLeft <= 0 && !ballot && !err) {
    return (
      <div className="screen">
        {banner && <div className="note">{banner}</div>}
        <div className="card">
          <h2>{done > 0 ? 'Thanks, that is all your votes for today' : 'No votes left today'}</h2>
          <p className="sub">The limit is {maxPerDay} a day and resets at midnight Arizona time. New values go live when the voting window closes.</p>
        </div>
        {readPanel}
      </div>
    );
  }

  const ready = ballot && Object.keys(picks).length === 3;

  return (
    <div className="screen">
      {banner && (
        <div className="note milestone" onClick={() => setBanner(null)}>
          {banner} <span className="meta">(tap to dismiss)</span>
        </div>
      )}
      <div className="note">
        Rank these three. Keep your favorite, trade the middle, cut the worst. {votesLeft} vote{votesLeft === 1 ? '' : 's'} left today.
      </div>
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
      {readPanel}
    </div>
  );
}
