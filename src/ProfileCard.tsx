import type { Asset, LeagueTeam } from './types.ts';
import type { RosterInsight } from './insight.ts';
import { POSITIONS } from './insight.ts';

const LEAN_ROWS: { key: string; label: string }[] = [
  { key: 'young', label: 'Young (24 and under)' },
  { key: 'vet', label: 'Veterans (29+)' },
  { key: 'pick', label: 'Draft picks' },
  { key: 'consolidate', label: 'Many-for-one trades' },
  { key: 'spread', label: 'One-for-many trades' },
  ...POSITIONS.map((p) => ({ key: p, label: p })),
];

function LeanBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(50, Math.abs(value) * 100);
  return (
    <div className="lean">
      <span className="meta leanlabel">{label}</span>
      <div className="leantrack">
        <i className="mid" />
        <i
          className={value >= 0 ? 'up' : 'down'}
          style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ProfileCard({
  team,
  insight,
  isMe,
}: {
  team: LeagueTeam;
  insight?: RosterInsight;
  isMe?: boolean;
}) {
  const hasLean = Object.keys(team.lean).length > 0;
  return (
    <div className="card">
      <div className="sidehead">
        <h2>{team.name}</h2>
        {isMe && <span className="tag">You</span>}
      </div>
      {isMe && <p className="sub small">This is how the league sees you.</p>}

      {insight && (
        <>
          <div className="meta strong">Roster</div>
          <div className="tags">
            {insight.surplus.map((p) => <span key={`s${p}`} className="tag good">Deep at {p}</span>)}
            {insight.need.map((p) => <span key={`n${p}`} className="tag warn">Thin at {p}</span>)}
            {insight.ageLabel && <span className="tag">{insight.ageLabel}</span>}
            {!insight.surplus.length && !insight.need.length && !insight.ageLabel && (
              <span className="meta">Balanced roster</span>
            )}
          </div>
          <div className="meta">
            Top assets: {insight.top.map((a: Asset) => a.name).join(', ') || 'none'}
          </div>
        </>
      )}

      <div className="meta strong">
        Voting habits {team.confidence === 'early' && <span className="tag">Early read</span>}
      </div>
      {team.confidence === 'none' ? (
        <p className="sub small">Shows up after 10 votes. Roster insight above works now.</p>
      ) : (
        <>
          <div className="tags">
            {team.traits.length === 0 && <span className="meta">No strong lean yet</span>}
            {team.traits.map((t) => (
              <span key={t.key} className="tag accent" title={t.detail}>{t.label}</span>
            ))}
          </div>
          {hasLean && (
            <div className="leans">
              {LEAN_ROWS.filter((r) => r.key in team.lean).map((r) => (
                <LeanBar key={r.key} label={r.label} value={team.lean[r.key]} />
              ))}
              <div className="meta small">Bars show what they rank above (right) or below (left) the league. Updates daily.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
