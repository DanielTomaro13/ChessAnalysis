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
- Look up **any** chess.com player by username and browse their games by month.
- Replay any game: board, move list, click-to-jump, keyboard navigation.
- One-click **engine review** (single-threaded Stockfish, in a Web Worker):
  - Eval bar, best-move arrows, and a clickable eval graph.
  - chess.com-style move classification with on-board badges — **Book,
    Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Miss,
    Blunder**.
  - Per-side **accuracy %** (lichess volatility-weighted + harmonic model) and a
    rough **estimated rating** for the game.
  - Both players' **profile cards**: avatar, title, flag, and current
    Bullet/Blitz/Rapid ratings.

**Puzzles**
- **Trainer**: 5,769 bundled Lichess puzzles, quality-filtered and spread across
  rating bands 500–2800. Personal puzzle rating, streak, and difficulty
  selection.
- **My mistakes**: the mistakes and blunders found while reviewing *your own*
  games become "find the best move" puzzles, saved per username.
- Progress (puzzle rating, streak, mistakes) is stored in `localStorage`.

## Roadmap

Planned next (Phase 4 — "more game, more polish"):

- [ ] **Click-to-move** on the puzzle and review boards: click a piece to
      highlight it and show its legal-move dots, then click a target to move.
- [ ] Move **Hint** / **Show solution** into the right-hand puzzle panel.
- [ ] **Sounds** for moves, captures, checks, and puzzle solve/fail — in both
      Review and Puzzles.
- [ ] **Tactic-theme filters** (fork, pin, mate-in-2, endgame, sacrifice, …)
      built from the puzzles' theme tags, with per-theme accuracy tracking.
- [ ] A more **game-like, reward-focused** loop: streak bonuses, daily goals,
      XP / levels, combos, and achievements.

Done:

- [x] **Phase 1 — Game viewer**
- [x] **Phase 2 — Engine review** (eval, accuracy, move classification, graph)
- [x] **Phase 3 — Puzzles** (Lichess trainer + "my mistakes")

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
