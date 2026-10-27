import { useMemo, useState } from 'react';
import type { Asset } from './types.ts';
import { balanceIdeas, judge } from './trade.ts';
import { AssetRow } from './ui.tsx';

export default function TradeTab({ assets, starPremium }: { assets: Asset[]; starPremium: number }) {
  const [a, setA] = useState<Asset[]>([]);
  const [b, setB] = useState<Asset[]>([]);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);
  const [q, setQ] = useState('');

  const used = useMemo(() => new Set([...a, ...b].map((x) => x.id)), [a, b]);
  const v = judge(a, b, starPremium);
  const trailing = v.winner === 'A' ? 'B' : 'A';
  const ideas = v.label === 'close' || v.label === 'lopsided' ? balanceIdeas(v.gap, assets, used, starPremium) : [];

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assets.filter((x) => !used.has(x.id) && (!term || x.name.toLowerCase().includes(term))).slice(0, 60);
  }, [assets, used, q]);

  function add(x: Asset, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => [...s, x]);
  }
  function remove(id: string, side: 'A' | 'B') {
    (side === 'A' ? setA : setB)((s) => s.filter((x) => x.id !== id));
  }

  const verdictText =
    v.label === 'empty' ? 'Add assets to both sides'
    : v.label === 'fair' ? 'Fair trade'
    : `Side ${v.winner} wins by ${Math.round(v.pct * 100)}%`;

  return (
    <div className="screen">
      <div className={`verdict ${v.label}`}>
        <div className="vtitle">{verdictText}</div>
        {v.label !== 'empty' && (
          <div className="meta">
            {v.a.toLocaleString()} vs {v.b.toLocaleString()}
          </div>
        )}
      </div>

      {(['A', 'B'] as const).map((side) => {
        const list = side === 'A' ? a : b;
        return (
          <div className="card" key={side}>
            <div className="sidehead">
              <h2>Side {side}</h2>
              <span className="meta">{(side === 'A' ? v.a : v.b).toLocaleString()}</span>
            </div>
            {list.map((x) => (
              <AssetRow
                key={x.id}
                a={x}
                right={
                  <button className="x" onClick={() => remove(x.id, side)} aria-label={`Remove ${x.name}`}>
                    ✕
                  </button>
                }
              />
            ))}
            <button className="btn ghost" onClick={() => { setPicking(side); setQ(''); }}>
              + Add player or pick
            </button>
          </div>
        );
      })}

      {ideas.length > 0 && (
        <div className="card">
          <h2>To even it up</h2>
          <p className="sub">Side {trailing} could add one of these:</p>
          {ideas.map((x) => (
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
            <input className="input" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="list scroll">
              {options.map((x) => (
                <AssetRow
                  key={x.id}
                  a={x}
                  onClick={() => add(x, picking)}
                  right={<span className="meta">{x.value.toLocaleString()}</span>}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
