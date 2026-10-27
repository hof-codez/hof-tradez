import { useEffect, useState } from 'react';
import { api, friendly } from './api.ts';
import type { TeamOption } from './types.ts';

export default function Claim({ onDone }: { onDone: (token: string) => void }) {
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [team, setTeam] = useState<TeamOption | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.teams().then((r) => setTeams(r.teams)).catch((e) => setErr(friendly(e)));
  }, []);

  async function submit() {
    if (!team) return;
    setBusy(true);
    setErr('');
    try {
      const label = `Trade Calc (${/iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Web'})`;
      const r = await api.claim(team.id, pin, label);
      onDone(r.deviceToken);
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen center">
      <div className="hero">
        <div className="logo">⇄</div>
        <h1>League Trade Calc</h1>
        <p className="sub">Our values, set by our votes.</p>
      </div>

      {!team ? (
        <div className="card">
          <h2>Pick your team</h2>
          {!teams && !err && <p className="sub">Loading teams…</p>}
          <div className="list">
            {teams?.map((t) => (
              <button key={t.id} className="row tappable btnrow" onClick={() => setTeam(t)}>
                <div className="grow name">{t.name}</div>
                <span className="meta">{t.claimed ? 'Enter PIN' : 'Set PIN'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>{team.name}</h2>
          <p className="sub">
            {team.claimed
              ? 'Enter the PIN you use for Brown Bell.'
              : 'Pick a 4 to 8 digit PIN. It also works for Brown Bell.'}
          </p>
          <input
            className="input"
            inputMode="numeric"
            type="password"
            autoComplete="off"
            placeholder="PIN"
            value={pin}
            maxLength={8}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && submit()}
          />
          <button className="btn primary" disabled={busy || pin.length < 4} onClick={submit}>
            {busy ? 'Checking…' : team.claimed ? 'Unlock' : 'Claim team'}
          </button>
          <button className="btn ghost" onClick={() => { setTeam(null); setPin(''); setErr(''); }}>
            Back
          </button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
