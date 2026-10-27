import { useMemo, useState } from 'react';
import type { Asset, ValuesPayload } from './types.ts';
import { AssetRow } from './ui.tsx';

const FILTERS = ['All', 'QB', 'RB', 'WR', 'TE', 'Picks'] as const;

export default function ValuesTab({ assets, meta }: { assets: Asset[]; meta: ValuesPayload }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [q, setQ] = useState('');

  const ranked = useMemo(() => assets.map((a, i) => ({ a, rank: i + 1 })), [assets]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ranked.filter(({ a }) => {
      if (filter === 'Picks' && a.kind !== 'pick') return false;
      if (['QB', 'RB', 'WR', 'TE'].includes(filter) && a.position !== filter) return false;
      return !term || a.name.toLowerCase().includes(term);
    });
  }, [ranked, filter, q]);

  const ends = new Date(meta.windowEndsAt);
  const days = Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="screen">
      <div className="note">
        Values update when the voting window closes, {days === 0 ? 'later today' : `in ${days} day${days === 1 ? '' : 's'}`} (
        {ends.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}).
      </div>
      <input className="input" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`pill${f === filter ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="list">
        {shown.slice(0, 250).map(({ a, rank }) => (
          <AssetRow
            key={a.id}
            a={a}
            right={
              <div className="val">
                <div className="num">{a.value.toLocaleString()}</div>
                <div className="bar"><i style={{ width: `${Math.max(2, a.value / 100)}%` }} /></div>
                <div className="meta">#{rank}</div>
              </div>
            }
          />
        ))}
        {shown.length === 0 && <p className="sub pad">Nothing matches.</p>}
      </div>
    </div>
  );
}
