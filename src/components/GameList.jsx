import { archiveLabel } from '../api/chessApi'

const RESULT_LABEL = { win: 'Win', draw: 'Draw', loss: 'Loss' }

// Map a chess.com side-result code to win / draw / loss.
function outcomeFor(side) {
  if (side.result === 'win') return 'win'
  if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(side.result))
    return 'draw'
  return 'loss'
}

function describeGame(game, username) {
  const lower = username.toLowerCase()
  const userIsWhite = game.white?.username?.toLowerCase() === lower
  const me = userIsWhite ? game.white : game.black
  const opp = userIsWhite ? game.black : game.white
  return {
    color: userIsWhite ? 'white' : 'black',
    opponent: opp?.username ?? '—',
    opponentRating: opp?.rating,
    myRating: me?.rating,
    outcome: me ? outcomeFor(me) : 'draw',
    timeClass: game.time_class,
    date: game.end_time ? new Date(game.end_time * 1000) : null,
  }
}

export default function GameList({
  games,
  username,
  archives,
  selectedArchive,
  onSelectArchive,
  onSelectGame,
  selectedGameUrl,
  loading,
}) {
  return (
    <div className="game-list">
      <div className="game-list__header">
        <label>
          Month{' '}
          <select
            value={selectedArchive || ''}
            onChange={(e) => onSelectArchive(e.target.value)}
          >
            {[...archives].reverse().map((url) => (
              <option key={url} value={url}>
                {archiveLabel(url)}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">{loading ? 'Loading…' : `${games.length} games`}</span>
      </div>

      <ul className="game-list__items">
        {games.map((game) => {
          const d = describeGame(game, username)
          const active = game.url === selectedGameUrl
          return (
            <li key={game.url}>
              <button
                className={`game-row game-row--${d.outcome} ${active ? 'is-active' : ''}`}
                onClick={() => onSelectGame(game)}
              >
                <span className={`dot dot--${d.color}`} title={`You played ${d.color}`} />
                <span className="game-row__opp">
                  {d.opponent}
                  {d.opponentRating ? <em> ({d.opponentRating})</em> : null}
                </span>
                <span className={`game-row__result result--${d.outcome}`}>
                  {RESULT_LABEL[d.outcome]}
                </span>
                <span className="game-row__meta">
                  {d.timeClass}
                  {d.date ? ` · ${d.date.toLocaleDateString()}` : ''}
                </span>
              </button>
            </li>
          )
        })}
        {!loading && games.length === 0 && (
          <li className="muted" style={{ padding: '1rem' }}>No games this month.</li>
        )}
      </ul>
    </div>
  )
}
