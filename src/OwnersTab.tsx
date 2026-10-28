import { useState } from 'react';
import type { LeagueTeam } from './types.ts';
import type { RosterInsight } from './insight.ts';
import ProfileCard from './ProfileCard.tsx';

export default function OwnersTab({
  teams,
  insights,
  myTeamId,
}: {
  teams: LeagueTeam[];
  insights: Map<string, RosterInsight>;
  myTeamId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(myTeamId);
  const sorted = [...teams].sort((a, b) => (a.teamId === myTeamId ? -1 : b.teamId === myTeamId ? 1 : a.name.localeCompare(b.name)));
  return (
    <div className="screen">
      <div className="note">Profiles use rosters and voting habits. Votes themselves are never shown.</div>
      {sorted.map((t) =>
        openId === t.teamId ? (
          <div key={t.teamId} onClick={() => setOpenId(null)}>
            <ProfileCard team={t} insight={insights.get(t.teamId)} isMe={t.teamId === myTeamId} />
          </div>
        ) : (
          <button key={t.teamId} className="row tappable btnrow card slim" onClick={() => setOpenId(t.teamId)}>
            <div className="grow name">{t.name}{t.teamId === myTeamId ? ' (you)' : ''}</div>
            <span className="meta">
              {t.traits.slice(0, 2).map((x) => x.label).join(' · ') || (t.confidence === 'none' ? 'Roster only' : '')}
            </span>
          </button>
        ),
      )}
    </div>
  );
}
