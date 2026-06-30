# ChessAnalysis

A free, browser-based **chess.com game review** and **tactics trainer** — the
paid "Game Review" and "Puzzles" features, recreated to run entirely in your
browser. No premium account, no backend, no sign-in. Hosted on GitHub Pages.

**Live:** https://danieltomaro13.github.io/ChessAnalysis/

Game data comes from the public
[Chess.com Published-Data API](https://www.chess.com/news/view/published-data-api).
Engine analysis uses Stockfish compiled to WebAssembly. Puzzles use the open
[Lichess puzzle database](https://database.lichess.org/#puzzles), plus tactics
generated from your own games.

## Features

**Review**
- Look up **any** chess.com player by username and browse their games by month,
  with result/color/type **filters**, opponent **search**, and a month W/D/L
  summary.
- Replay any game: board, move list, click-to-jump, keyboard navigation, sounds.
- One-click **engine review** (single-threaded Stockfish, in a Web Worker):
  - Eval bar, best-move arrows, and a clickable eval graph.
  - chess.com-style move classification with on-board badges — **Book,
    Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Miss,
    Blunder**.
  - **Key moments** — jump straight to the turning points.
  - Per-side **accuracy %** (lichess volatility-weighted + harmonic model) and a
    rough **estimated rating** for the game.
  - Both players' **profile cards**: avatar, title, flag, and current
    Bullet/Blitz/Rapid ratings.
  - Analysis is **cached in IndexedDB**, so reopening a game is instant.

**Puzzles**
- **Trainer**: 5,769 bundled Lichess puzzles, quality-filtered across rating
  bands 500–2800. Click-to-move with legal-move hints, tactic-theme filter,
  personal puzzle rating, streak, and difficulty selection.
- **Rush**: a 3-minute race — solve as many as you can; three strikes ends it.
- **My mistakes**: the mistakes and blunders found while reviewing *your own*
  games become "find the best move" puzzles, saved per username.
- **Stats**: level/XP, rating-history sparkline, per-tactic accuracy, and
  achievements.
- Rewards (XP, levels, streak combos, daily goal, achievements) and all progress
  are stored in `localStorage`.

**App**
- Settings: board themes, default engine depth, sound on/off.
- Sound effects, a mute toggle, installable PWA with a favicon/manifest.

## Roadmap

Done:

- [x] **Phase 1 — Game viewer**
- [x] **Phase 2 — Engine review** (eval, accuracy, move classification, graph)
- [x] **Phase 3 — Puzzles** (Lichess trainer + "my mistakes")
- [x] **Phase 4 — Game feel**: click-to-move with legal-move highlights,
      in-panel hint / show-solution, move/capture/check/solve sounds (with a
      mute toggle), tactic-theme filters, and a reward loop — XP, levels,
      streak combos, a daily goal, and achievements.

- [x] **Phase 5 — More tools**: game filters + month stats, key-moments jumps,
      persistent (IndexedDB) analysis cache, settings + board themes, favicon /
      PWA, Puzzle Rush, and a stats dashboard.

Ideas for later: explore-variations from a position, opening explorer,
clock/time-per-move from the PGN, shareable deep links, and a service-worker
offline mode.

## Tech

React + Vite (fully static), [chess.js](https://github.com/jhlywa/chess.js),
[react-chessboard](https://github.com/Clariity/react-chessboard), and
Stockfish.js (WASM).

> **Engine note:** a *single-threaded* Stockfish build is used on purpose —
> GitHub Pages can't send the COOP/COEP headers that `SharedArrayBuffer`
> (threaded WASM) requires. The engine lives in `public/engine/` and runs in a
> Web Worker; choose Fast/Balanced/Deep search depth before analyzing.

Bundled data assets (regenerated offline, not fetched at runtime):
`public/openings.json` (opening book) and `public/puzzles.json` (puzzle set).

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site
and publishes `dist/` to GitHub Pages.

One-time setup: in the repo, go to **Settings → Pages → Build and deployment →
Source** and select **GitHub Actions**.

The site is served from `/ChessAnalysis/`; this is set as `base` in
[`vite.config.js`](vite.config.js). If you rename the repo, update it there.

## Suggested GitHub topics

`chess` · `chess-com` · `chess-analysis` · `game-review` · `stockfish` ·
`chess-engine` · `wasm` · `puzzles` · `tactics-trainer` · `lichess` ·
`react` · `vite` · `github-pages`

## Disclaimer

Not affiliated with or endorsed by Chess.com or Lichess. Uses only public API
data and openly-licensed datasets.
