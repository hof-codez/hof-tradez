import type { Asset, BallotAsset } from './types.ts';

export function assetLabel(a: BallotAsset | Asset): string {
  return a.name;
}

export function assetMeta(a: BallotAsset | Asset): string {
  if (a.kind === 'pick') return 'Draft pick';
  const bits = [a.team, a.age ? `${Math.floor(a.age)} yrs` : null].filter(Boolean);
  return bits.join(' · ');
}

export function PosChip({ a }: { a: BallotAsset | Asset }) {
  const pos = a.kind === 'pick' ? 'PICK' : a.position || '';
  return <span className={`chip pos-${pos}`}>{pos}</span>;
}

export function AssetRow({
  a,
  right,
  onClick,
}: {
  a: BallotAsset | Asset;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={`row${onClick ? ' tappable' : ''}`} onClick={onClick}>
      <PosChip a={a} />
      <div className="grow">
        <div className="name">{assetLabel(a)}</div>
        <div className="meta">{assetMeta(a)}</div>
      </div>
      {right}
    </div>
  );
}
