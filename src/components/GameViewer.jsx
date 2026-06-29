import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { parsePgn, toMovePairs } from '../lib/pgn'

export default function GameViewer({ game, username }) {
  const parsed = useMemo(() => (game ? parsePgn(game.pgn) : null), [game])
  const [ply, setPly] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const moveListRef = useRef(null)

  // Reset to the start whenever a new game is opened, and orient the board
  // so the searched player is on the bottom.
  useEffect(() => {
    setPly(0)
    if (game && username) {
      setFlipped(game.black?.username?.toLowerCase() === username.toLowerCase())
    }
  }, [game, username])

  const total = parsed ? parsed.fens.length - 1 : 0
  const goTo = (p) => setPly(Math.max(0, Math.min(total, p)))

  // Arrow-key navigation.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') goTo(ply - 1)
      else if (e.key === 'ArrowRight') goTo(ply + 1)
      else if (e.key === 'ArrowUp') goTo(0)
      else if (e.key === 'ArrowDown') goTo(total)
      else if (e.key === 'f') setFlipped((f) => !f)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ply, total])

  // Keep the current move visible in the scrollable move list.
  useEffect(() => {
    moveListRef.current
      ?.querySelector('.move.is-current')
      ?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  if (!game) {
    return <div className="viewer viewer--empty muted">Pick a game on the left to review it.</div>
  }
  if (!parsed) {
    return <div className="viewer viewer--empty muted">Couldn’t read this game’s moves.</div>
  }

  const { headers, sans, fens } = parsed
  const pairs = toMovePairs(sans)

  return (
    <div className="viewer">
      <div className="viewer__board">
        <Chessboard
          position={fens[ply]}
          boardOrientation={flipped ? 'black' : 'white'}
          arePiecesDraggable={false}
          customDarkSquareStyle={{ backgroundColor: '#6f8d57' }}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
        />
        <div className="controls">
          <button onClick={() => goTo(0)} title="Start (↑)">⏮</button>
          <button onClick={() => goTo(ply - 1)} title="Previous (←)">◀</button>
          <span className="controls__counter">{ply}/{total}</span>
          <button onClick={() => goTo(ply + 1)} title="Next (→)">▶</button>
          <button onClick={() => goTo(total)} title="End (↓)">⏭</button>
          <button onClick={() => setFlipped((f) => !f)} title="Flip (f)">⟲</button>
        </div>
      </div>

      <div className="viewer__sidebar">
        <h2 className="viewer__title">
          {headers.White} <span className="muted">vs</span> {headers.Black}
        </h2>
        <p className="viewer__sub muted">
          {headers.Result} · {headers.ECO ? `${headers.ECO} ` : ''}
          {headers.TimeControl ? `· ${headers.TimeControl}` : ''}
        </p>
        {game.url && (
          <a className="viewer__link" href={game.url} target="_blank" rel="noreferrer">
            View on chess.com ↗
          </a>
        )}

        <ol className="moves" ref={moveListRef}>
          {pairs.map((pair) => (
            <li key={pair.number} className="moves__row">
              <span className="moves__num">{pair.number}.</span>
              <button
                className={`move ${ply === pair.white.ply ? 'is-current' : ''}`}
                onClick={() => goTo(pair.white.ply)}
              >
                {pair.white.san}
              </button>
              {pair.black ? (
                <button
                  className={`move ${ply === pair.black.ply ? 'is-current' : ''}`}
                  onClick={() => goTo(pair.black.ply)}
                >
                  {pair.black.san}
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
