import { useCallback, useEffect, useState } from 'react';
import { api } from './api.ts';
import type { Milestone, SelfPreview, VoteResult } from './types.ts';
import DeskMode from './DeskMode.tsx';

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
  onVoted,
}: {
  token: string;
  votesLeft: number;
  onVotesLeft: (n: number) => void;
  maxPerDay: number;
  fullWeight: number;
  onVoted: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(0);
  const [preview, setPreview] = useState<SelfPreview | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    api.me(token).then((m) => setPreview(m.preview)).catch(() => {});
  }, [token]);

  const onLoaded = useCallback(() => setLoaded(true), []);
  const onResult = useCallback(
    (r: VoteResult) => {
      onVotesLeft(r.votesLeft);
      setPreview(r.preview);
      setDone((n) => n + 1);
      setBanner(milestoneText(r.milestone, r.preview, maxPerDay, fullWeight));
      onVoted();
    },
    [onVotesLeft, maxPerDay, fullWeight, onVoted],
  );

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

  if (loaded && votesLeft <= 0) {
    return (
      <div className="screen">
        {banner && <div className="note milestone">{banner}</div>}
        <div className="card">
          <h2>{done > 0 ? 'Thanks, that is all your votes for today' : 'No votes left today'}</h2>
          <p className="sub">The limit is {maxPerDay} a day and resets at midnight Arizona time. Values update live as owners vote.</p>
        </div>
        {readPanel}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="chips">
        <span className="pill on">Offer Desk</span>
        <span className="meta votesleft">{votesLeft} left today</span>
      </div>
      {banner && (
        <div className="note milestone" onClick={() => setBanner(null)}>
          {banner} <span className="meta">(tap to dismiss)</span>
        </div>
      )}
      <DeskMode token={token} votesLeft={votesLeft} onVotesLeft={onVotesLeft} onResult={onResult} onLoaded={onLoaded} />
      {readPanel}
    </div>
  );
}
