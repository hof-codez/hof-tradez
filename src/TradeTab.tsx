import { useMemo, useState } from 'react';
import type { Asset, LeagueTeam } from './types.ts';
import type { RosterInsight } from './insight.ts';
import { AVAILABILITY_TEXT, availability, ideasFor, medianTrades, partnerNotes, rosterAssets } from './insight.ts';
import { OUT_WEEKS, fitFor, fitHeadline } from './lineup.ts';
import type { FitData } from './lineup.ts';
import { balanceIdeas, consensusText, judge } from './trade.ts';
import { AssetRow } from './ui.tsx';
import ProfileCard from './ProfileCard.tsx';

type Scope = 'mine' | 'theirs' | 'picks' | 'all';

export default function TradeTab({
  assets,
  starPremium,
  teams,
  insights,
  myTeamId,
  fit,
}: {
  assets: Asset[];
  starPremium: number;
  teams: LeagueTeam[];
  insights: Map<string, RosterInsight>;
  myTeamId: string;
  fit: FitData | null;
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
  // What you need that they have, ranked by fit and by how likely they are to part with him
  const wantIdeas = useMemo(() => {
    if (!me || !partner) return [];
    const median = medianTrades(teams);
    return ideasFor(partner, me, insights, byId, used, 10, true)
      .map((i) => ({ ...i, avail: availability(partner, i.asset, insights.get(partner.teamId), byId, median) }))
      .sort((x, y) => y.score * (0.6 + y.avail.score) - x.score * (0.6 + x.avail.score))
      .slice(0, 4);
  }, [me, partner, insights, byId, used, teams]);
  // Lineup impact for each side, from this season's points per game, injuries and byes
  const fitMine = useMemo(() => {
    if (!me || !fit || (!a.length && !b.length)) return null;
    return fitFor(rosterAssets(me, byId), a, b, fit, 'you');
  }, [me, fit, a, b, byId]);
  const fitTheirs = useMemo(() => {
    if (!partner || !fit || (!a.length && !b.length)) return null;
    return fitFor(rosterAssets(partner, byId), b, a, fit, 'them');
  }, [partner, fit, a, b, byId]);
  const myNeeds = me ? insights.get(me.teamId)?.need ?? [] : [];

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

  const verdictText = consensusText(v, partner?.name);

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

      {fitMine && fitMine.label !== 'unknown' && (
        <div className="card">
          <h2>Fit for the lineup</h2>
          <div className="meta strong">{fitHeadline(fitMine, 'Your')}</div>
          {fitMine.notes.map((n) => <div key={n} className="why">{n}</div>)}
          {partner && fitTheirs && fitTheirs.label !== 'unknown' && (
            <>
              <div className="meta strong pad-top">{fitHeadline(fitTheirs, `${partner.name}'s`)}</div>
              {fitTheirs.notes.map((n) => <div key={n} className="why">{n}</div>)}
            </>
          )}
          <div className="meta small">
            Built from this season's points per game, injuries and byes for the rest of the regular season. A player who is out is assumed to miss {OUT_WEEKS} weeks, since return dates are not available.
          </div>
        </div>
      )}

      {partner && (offerIdeas.length > 0 || wantIdeas.length > 0) && (
        <div className="card">
          <h2>Ideas for {partner.name}</h2>
          {offerIdeas.length > 0 && <div className="meta strong">From your roster, they may like</div>}
          {offerIdeas.map((i) => (
            <AssetRow key={i.asset.id} a={i.asset} onClick={() => add(i.asset, 'A')}
              note={i.reasons.join(' · ')} right={<span className="meta">{i.asset.value.toLocaleString()}</span>} />
          ))}
          {wantIdeas.length > 0 && (
            <div className="meta strong">
              From their roster, you may want{myNeeds.length ? ` (you are thin at ${myNeeds.join(', ')})` : ''}
            </div>
          )}
          {wantIdeas.map((i) => (
            <AssetRow key={i.asset.id} a={i.asset} onClick={() => add(i.asset, 'B')}
              note={[...i.reasons, ...i.avail.why.slice(0, 2)].join(' · ')}
              right={
                <div className="avail">
                  <span className="meta">{i.asset.value.toLocaleString()}</span>
                  <span className={`tag${i.avail.label === 'likely' ? ' accent' : ''}`}>{AVAILABILITY_TEXT[i.avail.label]}</span>
                </div>
              } />
          ))}
          <div className="meta small">Tap one to add it. Availability is an estimate from roster role, depth, age fit and trade activity. Sleeper does not share rejected offers, so treat it as a nudge.</div>
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
