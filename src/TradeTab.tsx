import { useMemo, useState } from 'react';
import type { Asset, LeagueTeam } from './types.ts';
import type { RosterInsight } from './insight.ts';
import { ideasFor, partnerNotes } from './insight.ts';
import { balanceIdeas, judge } from './trade.ts';
import { AssetRow } from './ui.tsx';
import ProfileCard from './ProfileCard.tsx';

type Scope = 'mine' | 'theirs' | 'picks' | 'all';

export default function TradeTab({
  assets,
  starPremium,
  teams,
  insights,
  myTeamId,
}: {
  assets: Asset[];
  starPremium: number;
  teams: LeagueTeam[];
  insights: Map<string, RosterInsight>;
  myTeamId: string;
}) {
  const [a, setA] = useState<Asset[]>([]);
  const [b, setB] = useState<Asset[]>([]);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const byId = useMemo(() => new Map(assets.map((x) => [x.id, x])), [assets]);
  const me = teams.find((t) => t.teamId === myTeamId);
  const partner = teams.find((t) => t.teamId === partnerId);
  const used = useMemo(() => new Set([...a, ...b].map((x) => x.id)), [a, b]);
  const v = judge(a, b, starPremium);
  const trailing = v.winner === 'A' ? 'B' : 'A';
  const evenIdeas = v.label === 'close' || v.label === 'lopsided' ? balanceIdeas(v.gap, assets, used, starPremium) : [];

  const offerIdeas = useMemo(
    () => (me && partner ? ideasFor(me, partner, insights, byId, used) : []),
    [me, partner, insights, byId, used],
  );
  const wantIdeas = useMemo(
    () => (me && partner ? ideasFor(partner, me, insights, byId, used, 3, true) : []),
    [me, partner, insights, byId, used],
  );

  const mine = useMemo(() => new Set(me?.roster ?? []), [me]);
  const theirs = useMemo(() => new Set(partner?.roster ?? []), [partner]);
  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assets
      .filter((x) => {
        if (used.has(x.id)) return false;
        if (term && !x.name.toLowerCase().includes(term)) return false;
        if (scope === 'mine') return mine.has(x.id);
        if (scope === 'theirs') return theirs.has(x.id);
        if (scope === 'picks') return x.kind === 'pick';
        return true;
      })
      .slice(0, 60);
  }, [assets, used, q, scope, mine, theirs]);

  function add(x: Asset, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => [...s, x]);
  }
  function remove(id: string, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => s.filter((x) => x.id !== id));
  }
  function open(side: 'A' | 'B') {
    setPicking(side);
    setQ('');
    setScope(partner ? (side === 'A' ? 'mine' : 'theirs') : 'all');
  }

  const verdictText =
    v.label === 'empty' ? 'Add assets to both sides'
    : v.label === 'fair' ? 'Fair trade'
    : `Side ${v.winner} wins by ${Math.round(v.pct * 100)}%`;

  const scopes: Scope[] = partner ? ['mine', 'theirs', 'picks', 'all'] : ['all', 'picks'];

  return (
    <div className="screen">
      <div className="card">
        <label className="meta strong" htmlFor="partner">Trading with</label>
        <select id="partner" className="input" value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setShowProfile(false); }}>
          <option value="">Nobody yet (free build)</option>
          {teams.filter((t) => t.teamId !== myTeamId).map((t) => (
            <option key={t.teamId} value={t.teamId}>{t.name}</option>
          ))}
        </select>
        {partner && (
          <>
            <div className="tags">
              {partnerNotes(partner, insights.get(partner.teamId)).map((n) => <span key={n} className="tag">{n}</span>)}
              {partner.traits.slice(0, 3).map((t) => <span key={t.key} className="tag accent">{t.label}</span>)}
            </div>
            <button className="btn ghost" onClick={() => setShowProfile((s) => !s)}>
              {showProfile ? 'Hide full profile' : 'View full profile'}
            </button>
            {showProfile && <ProfileCard team={partner} insight={insights.get(partner.teamId)} />}
          </>
        )}
      </div>

      <div className={`verdict ${v.label}`}>
        <div className="vtitle">{verdictText}</div>
        {v.label !== 'empty' && <div className="meta">{v.a.toLocaleString()} vs {v.b.toLocaleString()}</div>}
      </div>

      {(['A', 'B'] as const).map((side) => {
        const list = side === 'A' ? a : b;
        return (
          <div className="card" key={side}>
            <div className="sidehead">
              <h2>{side === 'A' ? 'You give' : partner ? `${partner.name} gives` : 'You get'} (Side {side})</h2>
              <span className="meta">{(side === 'A' ? v.a : v.b).toLocaleString()}</span>
            </div>
            {list.map((x) => (
              <AssetRow key={x.id} a={x} right={<button className="x" onClick={() => remove(x.id, side)} aria-label={`Remove ${x.name}`}>✕</button>} />
            ))}
            <button className="btn ghost" onClick={() => open(side)}>+ Add player or pick</button>
          </div>
        );
      })}

      {partner && (offerIdeas.length > 0 || wantIdeas.length > 0) && (
        <div className="card">
          <h2>Ideas for {partner.name}</h2>
          {offerIdeas.length > 0 && <div className="meta strong">From your roster, they may like</div>}
          {offerIdeas.map((i) => (
            <AssetRow key={i.asset.id} a={i.asset} onClick={() => add(i.asset, 'A')}
              note={i.reasons.join(' · ')} right={<span className="meta">{i.asset.value.toLocaleString()}</span>} />
          ))}
          {wantIdeas.length > 0 && <div className="meta strong">From their roster, you may want</div>}
          {wantIdeas.map((i) => (
            <AssetRow key={i.asset.id} a={i.asset} onClick={() => add(i.asset, 'B')}
              note={i.reasons.join(' · ')} right={<span className="meta">{i.asset.value.toLocaleString()}</span>} />
          ))}
          <div className="meta small">Tap one to add it. Suggestions come from rosters and voting habits, so treat them as a nudge.</div>
        </div>
      )}

      {evenIdeas.length > 0 && (
        <div className="card">
          <h2>To even it up</h2>
          <p className="sub">Side {trailing} could add one of these:</p>
          {evenIdeas.map((x) => (
            <AssetRow key={x.id} a={x} onClick={() => add(x, trailing)} right={<span className="meta">{x.value.toLocaleString()}</span>} />
          ))}
        </div>
      )}

      {(a.length > 0 || b.length > 0) && (
        <button className="btn ghost" onClick={() => { setA([]); setB([]); }}>Clear trade</button>
      )}

      {picking && (
        <div className="sheet" onClick={() => setPicking(null)}>
          <div className="sheetbody" onClick={(e) => e.stopPropagation()}>
            <div className="sidehead">
              <h2>Add to Side {picking}</h2>
              <button className="x" onClick={() => setPicking(null)}>Done</button>
            </div>
            <div className="chips">
              {scopes.map((s) => (
                <button key={s} className={`pill${s === scope ? ' on' : ''}`} onClick={() => setScope(s)}>
                  {s === 'mine' ? 'My roster' : s === 'theirs' ? 'Their roster' : s === 'picks' ? 'Picks' : 'All'}
                </button>
              ))}
            </div>
            <input className="input" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="list scroll">
              {options.map((x) => (
                <AssetRow key={x.id} a={x} onClick={() => add(x, picking)} right={<span className="meta">{x.value.toLocaleString()}</span>} />
              ))}
              {options.length === 0 && <p className="sub pad">Nothing here.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
