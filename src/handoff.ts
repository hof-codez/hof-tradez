import { clear, load, save } from './store.ts';

// Signing in with the PIN twice is annoying, so the calculator borrows the Brown Bell
// sign-in. Two routes, tried in order:
//  1. A link from Brown Bell carries the device token in the URL fragment (#t=...). This
//     works on a home-screen app too, where storage is not shared with the browser.
//  2. Only when there is no calculator sign-in yet. Same site, same browser: read the Brown Bell claim straight from storage.
// The token is only a candidate. tc-api checks it, and a bad one just falls back to the PIN screen.
const BB_KEY = 'brownbell-device-claim';
const OPT_OUT = 'tc:noshare';

export function takeLinkToken(): string | null {
  try {
    const m = /[#&]t=([^&]+)/.exec(window.location.hash);
    if (m) {
      const token = decodeURIComponent(m[1]);
      // strip it from the address bar and history right away
      history.replaceState(null, '', window.location.pathname + window.location.search);
      clear(OPT_OUT);
      if (token.length >= 8) return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function brownBellToken(): string | null {
  if (load<boolean>(OPT_OUT, false)) return null;
  try {
    const raw = localStorage.getItem(BB_KEY);
    const token = raw ? (JSON.parse(raw)?.deviceToken as string | undefined) : undefined;
    return token && token.length >= 8 ? token : null;
  } catch {
    return null;
  }
}

// After an explicit sign out, do not quietly sign back in from Brown Bell.
export function rememberSignOut() {
  save(OPT_OUT, true);
}
