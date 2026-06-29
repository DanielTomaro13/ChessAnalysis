# ChessAnalysis

Review any **chess.com** player's games for free — no premium account required.
Runs entirely in the browser and is hosted on GitHub Pages.

Game data comes from the public [Chess.com Published-Data API](https://www.chess.com/news/view/published-data-api).
Engine analysis (Phase 2) uses Stockfish compiled to WebAssembly; puzzles
(Phase 3) use the open [Lichess puzzle database](https://database.lichess.org/#puzzles)
plus tactics generated from your own games.

## Status

- [x] **Phase 1 — Game viewer**: enter a username, browse games by month, replay any game with move list + keyboard navigation.
- [ ] **Phase 2 — Game review**: Stockfish eval bar, move classification (blunder/mistake/inaccuracy), accuracy %.
- [ ] **Phase 3 — Puzzles**: Lichess puzzle trainer + "your mistakes" puzzles.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes `dist/` to GitHub Pages.

One-time setup: in the repo, go to **Settings → Pages → Build and deployment →
Source** and select **GitHub Actions**.

The site is served from `/ChessAnalysis/`; this is set as `base` in
[`vite.config.js`](vite.config.js). If you rename the repo, update it there.

## Disclaimer

Not affiliated with or endorsed by Chess.com. Uses only public API data.
