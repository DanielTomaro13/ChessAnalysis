import { FEATURED_GAMES, FEATURED_THEMES } from '../lib/featured'
import { buildGameFromPgn } from '../lib/importPgn'

// Landing showcase shown on the Review tab before a player has been loaded.
// Famous games open straight in the engine viewer; tactic chips jump into the
// puzzle trainer pre-filtered to a theme.
export default function Landing({ onPlayGame, onOpenPuzzles }) {
  function openGame(f) {
    const game = buildGameFromPgn(f.pgn)
    onPlayGame({ ...game, title: f.title })
  }

  return (
    <section className="landing">
      <div className="landing__section">
        <div className="landing__head">
          <h2>♟ Famous games</h2>
          <p className="muted">Replay a legendary game with full engine analysis — eval bar, accuracy and move grades.</p>
        </div>
        <div className="featured-grid">
          {FEATURED_GAMES.map((f) => (
            <button key={f.id} className="featured-card" onClick={() => openGame(f)}>
              <span className={`featured-card__result result--${f.result === '1-0' ? 'w' : f.result === '0-1' ? 'b' : 'd'}`}>
                {f.result}
              </span>
              <span className="featured-card__year">{f.year}</span>
              <h3 className="featured-card__title">{f.title}</h3>
              <p className="featured-card__players">{f.players}</p>
              <p className="featured-card__blurb">{f.blurb}</p>
              <span className="featured-card__cta">Analyze →</span>
            </button>
          ))}
        </div>
      </div>

      <div className="landing__section">
        <div className="landing__head">
          <h2>🎯 Train tactics</h2>
          <p className="muted">Sharpen a specific pattern, or warm up with the puzzle of the day.</p>
        </div>
        <div className="tactics-grid">
          <button className="tactic-chip tactic-chip--daily" onClick={() => onOpenPuzzles('daily')}>
            <span className="tactic-chip__icon">📅</span>
            <span className="tactic-chip__label">Daily puzzle</span>
          </button>
          {FEATURED_THEMES.map((t) => (
            <button key={t.key} className="tactic-chip" onClick={() => onOpenPuzzles(t.key)}>
              <span className="tactic-chip__icon">{t.icon}</span>
              <span className="tactic-chip__label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
