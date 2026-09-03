# Go Comment

Keep score of your own LinkedIn activity — comments, posts, DMs and connection requests — with a
weekday streak, weekly targets and a pixel parrot that evolves (and moults back down).

- **Observe only.** It never clicks, posts, or sends anything for you.
- **Paints nothing on linkedin.com.** All UI lives in the extension popup.
- **Nothing leaves your device.** No backend, no telemetry, no network calls at all — CI scans the
  built bundle to prove it.
- **Stores counts, not content.** No post text, names, URLs or profile data are ever saved.

Not affiliated with, endorsed by, or connected to LinkedIn Corporation.

## Status

Version 2 is being rebuilt from scratch. This README grows with it — install instructions, store
link and screenshots land once there is something to install.

## Develop

```
npm install
npm run dev          # Chrome, with hot reload
npm run dev:firefox
npm run verify       # the gate: typecheck + lint + tests + build + manifest check + no-network scan
```

Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

## Licence

MIT — see `LICENSE`.
