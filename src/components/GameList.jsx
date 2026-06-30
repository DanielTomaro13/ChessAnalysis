import { useMemo, useState } from 'react'
import { archiveLabel } from '../api/chessApi'
import RepertoireModal from './RepertoireModal'

const RESULT_LABEL = { win: 'Win', draw: 'Draw', loss: 'Loss' }

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
  const [fResult, setFResult] = useState('all')
  const [fColor, setFColor] = useState('all')
  const [fClass, setFClass] = useState('all')
  const [search, setSearch] = useState('')
  const [showRep, setShowRep] = useState(false)

  const described = useMemo(
    () => games.map((g) => ({ game: g, d: describeGame(g, username) })),
    [games, username],
  )

  const stats = useMemo(() => {
    const s = { win: 0, draw: 0, loss: 0 }
    described.forEach(({ d }) => (s[d.outcome] += 1))
    return s
  }, [described])

  const timeClasses = useMemo(
    () => [...new Set(described.map(({ d }) => d.timeClass).filter(Boolean))],
    [described],
  )

  const filtered = described.filter(({ d }) => {
    if (fResult !== 'all' && d.outcome !== fResult) return false
    if (fColor !== 'all' && d.color !== fColor) return false
    if (fClass !== 'all' && d.timeClass !== fClass) return false
    if (search && !d.opponent.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="game-list">
      <div className="game-list__header">
        <label>
          Month{' '}
          <select value={selectedArchive || ''} onChange={(e) => onSelectArchive(e.target.value)}>
            {[...archives].reverse().map((url) => (
              <option key={url} value={url}>{archiveLabel(url)}</option>
            ))}
          </select>
        </label>
        <span className="muted">{loading ? 'Loading…' : `${filtered.length}/${games.length}`}</span>
      </div>

      {!loading && games.length > 0 && (
        <div className="game-list__summary">
          <span className="result--win">{stats.win}W</span>
          <span className="result--draw">{stats.draw}D</span>
          <span className="result--loss">{stats.loss}L</span>
          <span className="muted">
            {Math.round((stats.win / Math.max(1, games.length)) * 100)}% win
          </span>
          <button className="linklike game-list__rep" onClick={() => setShowRep(true)}>Openings</button>
        </div>
      )}

      {showRep && <RepertoireModal games={games} username={username} onClose={() => setShowRep(false)} />}

      <div className="game-list__filters">
        <input
          type="text"
          placeholder="Search opponent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={fResult} onChange={(e) => setFResult(e.target.value)}>
          <option value="all">Result</option>
          <option value="win">Wins</option>
          <option value="draw">Draws</option>
          <option value="loss">Losses</option>
        </select>
        <select value={fColor} onChange={(e) => setFColor(e.target.value)}>
          <option value="all">Color</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        {timeClasses.length > 1 && (
          <select value={fClass} onChange={(e) => setFClass(e.target.value)}>
            <option value="all">Type</option>
            {timeClasses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <ul className="game-list__items">
        {filtered.map(({ game, d }) => {
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
                <span className={`game-row__result result--${d.outcome}`}>{RESULT_LABEL[d.outcome]}</span>
                <span className="game-row__meta">
                  {d.timeClass}
                  {d.date ? ` · ${d.date.toLocaleDateString()}` : ''}
                </span>
              </button>
            </li>
          )
        })}
        {!loading && filtered.length === 0 && (
          <li className="muted" style={{ padding: '1rem' }}>
            {games.length ? 'No games match the filters.' : 'No games this month.'}
          </li>
        )}
      </ul>
    </div>
  )
}
