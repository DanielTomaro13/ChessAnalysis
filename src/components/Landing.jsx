import { FEATURED_GAMES, FEATURED_THEMES } from '../lib/featured'
import { buildGameFromPgn } from '../lib/importPgn'
import UsernameForm from './UsernameForm'
import RatingChips from './RatingChips'

// The home page. Always shown first. If a player is known it greets them with a
// personalized hero (avatar, ratings, quick actions); otherwise it invites them
// to load a username. Below the hero, everyone gets famous games + tactics.
export default function Landing({
  username, card, loading, error,
  onSubmitUsername, onImport, onReviewGames, onInsights, onPlay, onChangeUser,
  onPlayGame, onOpenPuzzles,
}) {
  function openGame(f) {
    const game = buildGameFromPgn(f.pgn)
    onPlayGame({ ...game, title: f.title })
  }

  return (
    <section className="landing">
      {username ? (
        <div className="hero hero--user">
          {card?.avatar
            ? <img className="hero__avatar" src={card.avatar} alt="" />
            : <div className="hero__avatar hero__avatar--fallback">{username[0]?.toUpperCase()}</div>}
          <div className="hero__body">
            <p className="hero__welcome">Welcome back</p>
            <h2 className="hero__name">{card?.flag ? card.flag + ' ' : ''}{card?.name || username}</h2>
            <RatingChips ratings={card?.ratings} />
            <div className="hero__actions">
              <button className="analyze__btn" onClick={onReviewGames}>📋 Review my games</button>
              <button onClick={onInsights}>📊 My insights</button>
              <button onClick={onPlay}>🤖 Play a bot</button>
            </div>
            <button className="linklike hero__change" onClick={onChangeUser}>Not {username}? Change player</button>
          </div>
        </div>
      ) : (
        <div className="hero">
          <h2 className="hero__name">Analyze your chess, free</h2>
          <p className="muted hero__lead">
            Review any chess.com player’s games with engine analysis, accuracy and move grades —
            plus deep insights, tactics puzzles and bots to play. No premium account needed.
          </p>
          <div className="hero__entry">
            <UsernameForm onSubmit={onSubmitUsername} loading={loading} />
            <button className="import-btn" onClick={onImport}>⬆ Import PGN</button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

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
