# League Trade Calc

Our league's own player and pick values, set by our votes. Separate app from Brown Bell,
same Supabase project, same team PINs.

- **Values**: ranked list of every rostered QB/RB/WR/TE plus picks for the next 3 drafts (3 rounds).
- **Trade**: build both sides, see who wins, get ideas to even it up. Stars count for more than depth (league setting `star_premium`).
- **Vote**: Keep / Trade / Cut on three assets. Up to 5 ballots per team per day. You never see your own players.

Results go live when the voting window closes (default 7 days). Until then everyone sees the last published values.

## Repo secrets (Settings > Secrets and variables > Actions)

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://govhbcxrzmvghbdewpls.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon (publishable) key |

## Web app / iPhone

1. Settings > Pages > Source: **GitHub Actions**.
2. Push to `main`. The Pages workflow builds and deploys.
3. iPhone: open the Pages URL in Safari, Share, **Add to Home Screen**.

## Android APK

Actions tab > **Build Android APK** > Run workflow. Download `league-trade-calc-apk`
from the run, unzip, install `app-debug.apk` (allow installs from unknown sources).
It is a debug build, fine for the league. It does not go on the Play Store.

## Local

```
npm install
cp .env.example .env   # fill in the anon key
npm run dev
npm test
```
