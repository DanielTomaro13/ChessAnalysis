import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { parsePgn, toMovePairs } from '../lib/pgn'
import { analyzeGame, CLASS_META } from '../lib/analysis'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'

const DEPTHS = [
  { label: 'Fast', value: 10 },
  { label: 'Balanced', value: 13 },
  { label: 'Deep', value: 16 },
]

export default function GameViewer({ game, username }) {
  const parsed = useMemo(() => (game ? parsePgn(game.pgn) : null), [game])
  const [ply, setPly] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [depth, setDepth] = useState(13)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [engineError, setEngineError] = useState(null)
  const moveListRef = useRef(null)
  const cacheRef = useRef(new Map()) // game.url -> analysis result
  const abortRef = useRef(null)

  const total = parsed ? parsed.fens.length - 1 : 0
  const goTo = (p) => setPly(Math.max(0, Math.min(total, p)))

  // New game: reset, orient board to the searched player, load cached analysis.
  useEffect(() => {
    setPly(0)
    setEngineError(null)
    setProgress(0)
    abortRef.current?.abort()
    setAnalyzing(false)
    if (game && username) {
      setFlipped(game.black?.username?.toLowerCase() === username.toLowerCase())
      setAnalysis(cacheRef.current.get(game.url) ?? null)
    } else {
      setAnalysis(null)
    }
  }, [game, username])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Keyboard navigation.
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

  // Keep the current move in view.
  useEffect(() => {
    moveListRef.current
      ?.querySelector('.move.is-current')
      ?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  async function handleAnalyze() {
    if (!parsed) return
    const controller = new AbortController()
    abortRef.current = controller
    setAnalyzing(true)
    setEngineError(null)
    setProgress(0)
    try {
      const result = await analyzeGame(parsed.fens, parsed.moves, {
        depth,
        signal: controller.signal,
        onProgress: (frac) => setProgress(frac),
      })
      if (!controller.signal.aborted) {
        cacheRef.current.set(game.url, result)
        setAnalysis(result)
      }
    } catch (e) {
      if (e.name !== 'AbortError') setEngineError(e.message || 'Engine failed')
    } finally {
      if (abortRef.current === controller) setAnalyzing(false)
    }
  }

  if (!game) {
    return <div className="viewer viewer--empty muted">Pick a game on the left to review it.</div>
  }
  if (!parsed) {
    return <div className="viewer viewer--empty muted">Couldn’t read this game’s moves.</div>
  }

  const { headers, sans, fens, moves } = parsed
  const pairs = toMovePairs(sans)
  const currentEval = analysis ? analysis.evals[ply] : null
  const bestMove = currentEval?.bestMove
  const arrows = bestMove
    ? [[bestMove.slice(0, 2), bestMove.slice(2, 4), 'rgba(127,166,80,0.85)']]
    : []

  return (
    <div className="viewer">
      <div className="viewer__board">
        <div className="board-row">
          <EvalBar evalObj={currentEval} flipped={flipped} />
          <div className="board-row__board">
            <Chessboard
              position={fens[ply]}
              boardOrientation={flipped ? 'black' : 'white'}
              arePiecesDraggable={false}
              customArrows={arrows}
              customDarkSquareStyle={{ backgroundColor: '#6f8d57' }}
              customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
            />
          </div>
        </div>

        <div className="controls">
          <button onClick={() => goTo(0)} title="Start (↑)">⏮</button>
          <button onClick={() => goTo(ply - 1)} title="Previous (←)">◀</button>
          <span className="controls__counter">{ply}/{total}</span>
          <button onClick={() => goTo(ply + 1)} title="Next (→)">▶</button>
          <button onClick={() => goTo(total)} title="End (↓)">⏭</button>
          <button onClick={() => setFlipped((f) => !f)} title="Flip (f)">⟲</button>
        </div>

        {analysis && (
          <EvalGraph evals={analysis.evals} ply={ply} onSeek={goTo} />
        )}
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

        {/* Engine review controls */}
        <div className="analyze">
          {!analysis && !analyzing && (
            <div className="analyze__start">
              <button className="analyze__btn" onClick={handleAnalyze}>
                ⚙ Analyze game
              </button>
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
                {DEPTHS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label} (depth {d.value})
                  </option>
                ))}
              </select>
            </div>
          )}
          {analyzing && (
            <div className="analyze__progress">
              <div className="bar"><div className="bar__fill" style={{ width: `${progress * 100}%` }} /></div>
              <button className="analyze__cancel" onClick={() => abortRef.current?.abort()}>
                Cancel {Math.round(progress * 100)}%
              </button>
            </div>
          )}
          {engineError && <p className="error">{engineError}</p>}
          {analysis && <AccuracySummary analysis={analysis} />}
        </div>

        <ol className="moves" ref={moveListRef}>
          {pairs.map((pair) => (
            <li key={pair.number} className="moves__row">
              <span className="moves__num">{pair.number}.</span>
              <MoveButton
                move={pair.white}
                ann={analysis?.annotations[pair.white.ply - 1]}
                current={ply === pair.white.ply}
                onClick={() => goTo(pair.white.ply)}
              />
              {pair.black ? (
                <MoveButton
                  move={pair.black}
                  ann={analysis?.annotations[pair.black.ply - 1]}
                  current={ply === pair.black.ply}
                  onClick={() => goTo(pair.black.ply)}
                />
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

function MoveButton({ move, ann, current, onClick }) {
  const meta = ann ? CLASS_META[ann.class] : null
  return (
    <button
      className={`move ${current ? 'is-current' : ''}`}
      style={meta ? { color: meta.color } : undefined}
      onClick={onClick}
      title={ann ? `${meta.label} · −${ann.winLoss.toFixed(0)}% win` : undefined}
    >
      {move.san}
      {meta?.symbol ? <sup className="move__sym">{meta.symbol}</sup> : null}
    </button>
  )
}

function AccuracySummary({ analysis }) {
  const { accuracyWhite, accuracyBlack, countsWhite, countsBlack } = analysis
  const row = (label, acc, counts) => (
    <div className="acc__row">
      <span className="acc__name">{label}</span>
      <span className="acc__pct">{acc != null ? acc.toFixed(1) + '%' : '—'}</span>
      <span className="acc__counts">
        {counts.inaccuracy > 0 && <em style={{ color: CLASS_META.inaccuracy.color }}>{counts.inaccuracy}?!</em>}
        {counts.mistake > 0 && <em style={{ color: CLASS_META.mistake.color }}>{counts.mistake}?</em>}
        {counts.blunder > 0 && <em style={{ color: CLASS_META.blunder.color }}>{counts.blunder}??</em>}
      </span>
    </div>
  )
  return (
    <div className="acc">
      <div className="acc__head muted">Accuracy</div>
      {row('White', accuracyWhite, countsWhite)}
      {row('Black', accuracyBlack, countsBlack)}
    </div>
  )
}
