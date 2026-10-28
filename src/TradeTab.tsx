import { useMemo, useState } from 'react';
import type { Asset, LeagueTeam } from './types.ts';
import type { RosterInsight } from './insight.ts';
import { AVAILABILITY_TEXT, availability, ideasFor, medianTrades, partnerNotes, rosterAssets } from './insight.ts';
import { OUT_WEEKS, fitFor, fitHeadline } from './lineup.ts';
import { futureFor, futureHeadline, stanceFromRecord, STANCE_LABEL, type Stance } from './future.ts';
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
  // Two ways to use the tab. "My trade": I pick who I am trading with and every read is about my team.
  // "Other owners": I pick any two teams and every read is about those two, never about my team.
  // me / partner below mean the left and right team of the trade being looked at.
  const [mode, setMode] = useState<'mine' | 'other'>('mine');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const isYou = mode === 'mine';
  const myTeam = teams.find((t) => t.teamId === myTeamId);
  const picked = teams.find((t) => t.teamId === partnerId);
  const me = isYou ? (picked ? myTeam : undefined) : teams.find((t) => t.teamId === leftId);
  const partner = isYou ? picked : teams.find((t) => t.teamId === rightId);
  const pair = !!(me && partner);
  const lPoss = isYou ? 'Your' : `${me?.name ?? 'Their'}'s`;
  const lSubj = isYou ? 'you' : me?.name ?? 'they';
  const used = useMemo(() => new Set([...a, ...b].map((x) => x.id)), [a, b]);
  const v = judge(a, b, starPremium);
  const trailing = v.winner === 'A' ? 'B' : 'A';
  const evenIdeas = v.label === 'close' || v.label === 'lopsided' ? balanceIdeas(v.gap, assets, used, starPremium) : [];

  const offerIdeas = useMemo(
    () => (isYou && me && partner ? ideasFor(me, partner, insights, byId, used) : []),
    [isYou, me, partner, insights, byId, used],
  );
  // What you need that they have, ranked by fit and by how likely they are to part with him
  const wantIdeas = useMemo(() => {
    if (!isYou || !me || !partner) return [];
    const median = medianTrades(teams);
    return ideasFor(partner, me, insights, byId, used, 10, true)
      .map((i) => ({ ...i, avail: availability(partner, i.asset, insights.get(partner.teamId), byId, median) }))
      .sort((x, y) => y.score * (0.6 + y.avail.score) - x.score * (0.6 + x.avail.score))
      .slice(0, 4);
  }, [isYou, me, partner, insights, byId, used, teams]);
  // Lineup impact for each side, from this season's points per game, injuries and byes
  const fitMine = useMemo(() => {
    if (!me || !partner || !fit || (!a.length && !b.length)) return null;
    return fitFor(rosterAssets(me, byId), a, b, fit, isYou ? 'you' : 'them');
  }, [isYou, me, partner, fit, a, b, byId]);
  const fitTheirs = useMemo(() => {
    if (!me || !partner || !fit || (!a.length && !b.length)) return null;
    return fitFor(rosterAssets(partner, byId), b, a, fit, 'them');
  }, [me, partner, fit, a, b, byId]);
  // Dynasty view: how each side's value holds up over the next few seasons
  const [stancePick, setStancePick] = useState<Stance | null>(null);
  const myStance: Stance = (isYou ? stancePick : null) ?? stanceFromRecord(me?.record);
  const theirStance: Stance = stanceFromRecord(partner?.record);
  const futureMine = useMemo(() => (pair ? futureFor(a, b, starPremium, isYou ? 'you' : 'them', fit, myStance) : null), [pair, isYou, a, b, starPremium, fit, myStance]);
  const futureTheirs = useMemo(() => (pair ? futureFor(b, a, starPremium, 'them', fit, theirStance) : null), [pair, a, b, starPremium, fit, theirStance]);
  const myNeeds = isYou && me ? insights.get(me.teamId)?.need ?? [] : [];

  const mine = useMemo(() => new Set(me?.roster ?? []), [me]);
  const theirs = useMemo(() => new Set(partner?.roster ?? []), [partner]);
  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assets
      .filter((x) => {
        if (picking && (picking === 'A' ? b : a).some((y) => y.id === x.id)) return false; // on the other side already
        if (term && !x.name.toLowerCase().includes(term)) return false;
        if (scope === 'mine') return mine.has(x.id);
        if (scope === 'theirs') return theirs.has(x.id);
        if (scope === 'picks') {
          if (x.kind !== 'pick') return false;
          // with a trade partner, only picks the two of you hold can change hands
          return !pair || mine.has(x.id) || theirs.has(x.id);
        }
        return true;
      })
      .slice(0, scope === 'picks' ? 200 : 60);
  }, [assets, a, b, picking, q, scope, mine, theirs, pair]);

  // who holds each pick right now
  const holder = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) for (const id of t.roster) if (id.startsWith('pick:')) m.set(id, t.teamId === myTeamId ? 'You' : t.name);
    return m;
  }, [teams, myTeamId]);

  // Picks tab: you first, then your partner, then everyone else; within an owner by year, round, original team
  const shown = useMemo(() => {
    if (scope !== 'picks') return options;
    const rank = (id: string) => (mine.has(id) ? 0 : theirs.has(id) ? 1 : 2);
    return [...options].sort((x, y) =>
      rank(x.id) - rank(y.id)
      || (holder.get(x.id) ?? '').localeCompare(holder.get(y.id) ?? '')
      || (x.pickYear ?? 0) - (y.pickYear ?? 0)
      || (x.pickRound ?? 0) - (y.pickRound ?? 0)
      || x.name.localeCompare(y.name));
  }, [options, scope, mine, theirs, holder]);

  function add(x: Asset, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => [...s, x]);
  }
  function remove(id: string, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => s.filter((x) => x.id !== id));
  }
  function open(side: 'A' | 'B') {
    setPicking(side);
    setQ('');
    setScope(pair ? (side === 'A' ? 'mine' : 'theirs') : 'all');
  }

  const verdictText = pair
    ? consensusText(v, partner!.name, isYou ? 'you' : me!.name)
    : consensusText(v, 'Side B', 'Side A');

  const scopes: Scope[] = pair ? ['mine', 'theirs', 'picks', 'all'] : ['all', 'picks'];

  return (
    <div className="screen">
      <div className="card">
        <div className="chips">
          <button className={`pill${isYou ? ' on' : ''}`} onClick={() => { setMode('mine'); setA([]); setB([]); setShowProfile(false); }}>My trade</button>
          <button className={`pill${!isYou ? ' on' : ''}`} onClick={() => { setMode('other'); setA([]); setB([]); setShowProfile(false); }}>Other owners</button>
        </div>
        {isYou ? (
          <>
            <label className="meta strong" htmlFor="partner">Trading with</label>
            <select id="partner" className="input" value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setShowProfile(false); }}>
              <option value="">Nobody yet (values only)</option>
              {teams.filter((t) => t.teamId !== myTeamId).map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className="meta strong" htmlFor="left">First owner</label>
            <select id="left" className="input" value={leftId} onChange={(e) => { setLeftId(e.target.value); setA([]); }}>
              <option value="">Pick an owner</option>
              {teams.filter((t) => t.teamId !== rightId).map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </select>
            <label className="meta strong" htmlFor="right">Second owner</label>
            <select id="right" className="input" value={rightId} onChange={(e) => { setRightId(e.target.value); setB([]); setShowProfile(false); }}>
              <option value="">Pick an owner</option>
              {teams.filter((t) => t.teamId !== leftId).map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </select>
          </>
        )}
        {!pair && <div className="meta">Pick {isYou ? 'who you are trading with' : 'two owners'} to see lineup and future fit for the teams involved. Until then you only get values.</div>}
        {isYou && partner && (
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
              <h2>{side === 'A' ? (pair ? `${isYou ? 'You' : me!.name} give${isYou ? '' : 's'}` : 'Side A gives') : pair ? `${partner!.name} gives` : 'Side B gives'} (Side {side})</h2>
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
          <div className="meta strong">{fitHeadline(fitMine, lPoss)}</div>
          {fitMine.notes.map((n) => <div key={n} className="why">{n}</div>)}
          {partner && fitTheirs && fitTheirs.label !== 'unknown' && (
            <>
              <div className="meta strong pad-top">{fitHeadline(fitTheirs, `${partner.name}'s`)}</div>
              {fitTheirs.notes.map((n) => <div key={n} className="why">{n}</div>)}
            </>
          )}
          <div className="meta small">
            Built from a blend of this season's points per game and what each player's targets and carries support, plus injuries and byes for the rest of the regular season. A player who is out is assumed to miss {OUT_WEEKS} weeks, since return dates are not available.
          </div>
        </div>
      )}

      {futureMine && futureMine.label !== 'unknown' && (
        <div className="card">
          <h2>Fit for the future</h2>
          {!isYou && (
            <div className="meta">{me!.name} looks like a {STANCE_LABEL[myStance].toLowerCase()} team{me!.record ? ` (rank ${me!.record.rank} of ${me!.record.size})` : ''}.</div>
          )}
          {isYou && <div className="meta">
            Your situation{me?.record && !stancePick ? ` (rank ${me.record.rank} of ${me.record.size})` : ''}:{' '}
            {(['win', 'balanced', 'build'] as Stance[]).map((st) => (
              <button key={st} type="button" className={`btn ghost small${myStance === st ? ' on' : ''}`} onClick={() => setStancePick(st === stanceFromRecord(me?.record) && stancePick === null ? null : st)}>
                {STANCE_LABEL[st]}
              </button>
            ))}
          </div>}
          <div className="meta strong">{futureHeadline(futureMine, lPoss)}</div>
          {futureMine.chance !== null && futureMine.range && (
            <div className="meta">
              About a {Math.round(futureMine.chance * 100)}% chance this leaves {lSubj} ahead, counting the next three seasons the way a {STANCE_LABEL[myStance].toLowerCase()} team would. Two seasons out, {isYou ? 'your' : `${me!.name}'s`} net change is likely between {Math.round(futureMine.range.lo).toLocaleString()} and {Math.round(futureMine.range.hi).toLocaleString()}.
            </div>
          )}
          {futureMine.notes.map((n) => <div key={n} className="why">{n}</div>)}
          <div className="meta">
            {futureMine.rows.map((r) => (
              <div key={r.years} className="line">
                {r.years === 0 ? 'Today' : `In ${r.years} season${r.years > 1 ? 's' : ''}`}: {lSubj} get{isYou ? '' : 's'} {r.get.toLocaleString()}, {lSubj} give{isYou ? '' : 's'} {r.give.toLocaleString()}
              </div>
            ))}
          </div>
          {partner && futureTheirs && futureTheirs.label !== 'unknown' && (
            <>
              <div className="meta strong pad-top">{futureHeadline(futureTheirs, `${partner.name}'s`)}</div>
              {futureTheirs.chance !== null && (
                <div className="meta">About a {Math.round(futureTheirs.chance * 100)}% chance this leaves them ahead, weighted for a {STANCE_LABEL[theirStance].toLowerCase()} team.</div>
              )}
              {futureTheirs.notes.map((n) => <div key={n} className="why">{n}</div>)}
            </>
          )}
          <div className="meta small">
            An estimate from age, position and usage. Each player's value is moved along a typical dynasty curve (running backs fade fastest, young receivers and tight ends tend to grow). Players scoring well above what their targets and carries support are marked down, since that gap has tended to shrink the next season. Picks hold their value. The range comes from how far real players landed from this kind of forecast between 2010 and 2025, and the chance leans toward the next season or the third season depending on whether the team is a contender or a rebuilder. It does not know about injuries or role changes, so treat it as a lean, not a forecast.
          </div>
        </div>
      )}

      {isYou && partner && (offerIdeas.length > 0 || wantIdeas.length > 0) && (
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
                  {s === 'mine' ? (isYou ? 'My roster' : me?.name ?? 'First') : s === 'theirs' ? (isYou ? 'Their roster' : partner?.name ?? 'Second') : s === 'picks' ? 'Picks' : 'All'}
                </button>
              ))}
            </div>
            {scope === 'picks' && (
              <div className="meta">
                {pair ? `Picks held by ${isYou ? 'you' : me!.name} or ${partner!.name}. ` : ''}A pick's value follows the original team's record, so a worse record is worth more. It updates as standings change.
              </div>
            )}
            <input className="input" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="list scroll">
              {shown.map((x, i) => {
                const who = holder.get(x.id);
                const head = scope === 'picks' && x.kind === 'pick' && who && who !== holder.get(shown[i - 1]?.id ?? '');
                return (
                  <div key={x.id}>
                    {head && <div className="meta strong pad-top">{who === 'You' ? 'Your picks' : `${who}'s picks`}</div>}
                    <label className="pickrow">
                      <input
                        type="checkbox"
                        checked={(picking === 'A' ? a : b).some((y) => y.id === x.id)}
                        onChange={(e) => (e.target.checked ? add(x, picking) : remove(x.id, picking))}
                      />
                      <div className="grow">
                        <AssetRow a={x} note={x.kind === 'pick' && who ? `Held by ${who}` : undefined} right={<span className="meta">{x.value.toLocaleString()}</span>} />
                      </div>
                    </label>
                  </div>
                );
              })}
              {shown.length === 0 && <p className="sub pad">Nothing here.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
