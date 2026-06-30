import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { parsePgn, toMovePairs } from '../lib/pgn'
import { analyzeGame, CLASS_META } from '../lib/analysis'
import { loadOpenings } from '../lib/openings'
import { addMistakes } from '../lib/puzzles'
import { playSound, moveSoundKind } from '../lib/sound'
import { fetchPlayerCard } from '../api/chessApi'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import MoveBadge from './MoveBadge'
import PlayerCards from './PlayerCards'

const DEPTHS = [
  { label: 'Fast', value: 10 },
  { label: 'Balanced', value: 13 },
  { label: 'Deep', value: 16 },
]

// chips shown in the accuracy summary (skip the unremarkable categories)
const CHIP_KEYS = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']

export default function GameViewer({ game, username }) {
  const parsed = useMemo(() => (game ? parsePgn(game.pgn) : null), [game])
  const [ply, setPly] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [depth, setDepth] = useState(13)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [engineError, setEngineError] = useState(null)
  const [boardWidth, setBoardWidth] = useState(0)
  const [cards, setCards] = useState({})
  const moveListRef = useRef(null)
  const boardRef = useRef(null)
  const cacheRef = useRef(new Map())
  const abortRef = useRef(null)

  const total = parsed ? parsed.fens.length - 1 : 0
  const goTo = (p) => setPly(Math.max(0, Math.min(total, p)))

  // Measure the board so the badge overlay lines up with the squares.
  // Depends on `game` because the board element only exists once a game is
  // open — a bare [] effect would run while boardRef is still null.
  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return
    const measure = () => setBoardWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [game])

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

  // Fetch both players' profiles (avatar, title, current ratings).
  useEffect(() => {
    if (!game) return
    let cancelled = false
    const names = [game.white?.username, game.black?.username].filter(Boolean)
    Promise.all(names.map((n) => fetchPlayerCard(n))).then((results) => {
      if (cancelled) return
      setCards((prev) => {
        const next = { ...prev }
        results.forEach((c) => c && (next[c.username.toLowerCase()] = c))
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [game])

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

  useEffect(() => {
    moveListRef.current
      ?.querySelector('.move.is-current')
      ?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  // Play a sound for the move that produced the current position.
  useEffect(() => {
    if (ply > 0 && parsed?.moves[ply - 1]) playSound(moveSoundKind(parsed.moves[ply - 1]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply])

  async function handleAnalyze() {
    if (!parsed) return
    const controller = new AbortController()
    abortRef.current = controller
    setAnalyzing(true)
    setEngineError(null)
    setProgress(0)
    try {
      const book = await loadOpenings()
      const result = await analyzeGame(parsed.fens, parsed.moves, {
        depth,
        book,
        signal: controller.signal,
        onProgress: (frac) => setProgress(frac),
      })
      if (!controller.signal.aborted) {
        cacheRef.current.set(game.url, result)
        setAnalysis(result)
        addMistakes(username, harvestMistakes(result, parsed, game, username))
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

  // Badge for the move that produced the current position.
  const playedMove = ply > 0 ? moves[ply - 1] : null
  const playedClass = analysis && ply > 0 ? analysis.annotations[ply - 1]?.class : null

  return (
    <div className="viewer">
      <div className="viewer__board">
        <div className="board-row">
          <EvalBar evalObj={currentEval} flipped={flipped} />
          <div className="board-row__board" ref={boardRef}>
            <Chessboard
              position={fens[ply]}
              boardOrientation={flipped ? 'black' : 'white'}
              arePiecesDraggable={false}
              customArrows={arrows}
              customDarkSquareStyle={{ backgroundColor: '#6f8d57' }}
              customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
            />
            {playedMove && (
              <MoveBadge
                square={playedMove.to}
                boardWidth={boardWidth}
                flipped={flipped}
                klass={playedClass}
              />
            )}
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

        {analysis && <EvalGraph evals={analysis.evals} ply={ply} onSeek={goTo} />}
      </div>

      <div className="viewer__sidebar">
        <PlayerCards game={game} cards={cards} />
        <p className="viewer__sub muted">
          {headers.Result} · {headers.ECO ? `${headers.ECO} ` : ''}
          {headers.TimeControl ? `· ${headers.TimeControl}` : ''}
          {game.url && (
            <>
              {' · '}
              <a className="viewer__link" href={game.url} target="_blank" rel="noreferrer">
                chess.com ↗
              </a>
            </>
          )}
        </p>

        <div className="analyze">
          {!analysis && !analyzing && (
            <div className="analyze__start">
              <button className="analyze__btn" onClick={handleAnalyze}>⚙ Analyze game</button>
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
                {DEPTHS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label} (depth {d.value})</option>
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

// Collect the searched player's mistakes/blunders into "find the best move"
// puzzles for the Puzzles → My mistakes tab.
function harvestMistakes(result, parsed, game, username) {
  const u = username.toLowerCase()
  const userIsWhite = game.white?.username?.toLowerCase() === u
  const isPlayer = userIsWhite || game.black?.username?.toLowerCase() === u
  if (!isPlayer) return []
  const opponent = userIsWhite ? game.black?.username : game.white?.username
  const out = []
  result.annotations.forEach((a, i) => {
    if ((i % 2 === 0) !== userIsWhite) return
    if (!['mistake', 'blunder', 'miss'].includes(a.class) || !a.bestMove) return
    const fen = parsed.fens[i]
    let bestSan = a.bestMove
    try {
      const c = new Chess(fen)
      const m = c.move({ from: a.bestMove.slice(0, 2), to: a.bestMove.slice(2, 4), promotion: a.bestMove[4] })
      bestSan = m?.san || a.bestMove
    } catch {
      /* keep uci */
    }
    out.push({
      fen,
      solution: [a.bestMove],
      playedSan: parsed.sans[i],
      bestSan,
      class: a.class,
      gameUrl: game.url,
      opponent,
      sideWhite: userIsWhite,
    })
  })
  return out
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
  const rows = [
    { name: 'White', acc: analysis.accuracyWhite, rating: analysis.ratingWhite, counts: analysis.countsWhite },
    { name: 'Black', acc: analysis.accuracyBlack, rating: analysis.ratingBlack, counts: analysis.countsBlack },
  ]
  return (
    <div className="acc">
      <div className="acc__cols muted">
        <span>Player</span><span>Accuracy</span><span>Est. rating</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="acc__row">
          <span className="acc__name">{r.name}</span>
          <span className="acc__pct">{r.acc != null ? r.acc.toFixed(1) + '%' : '—'}</span>
          <span className="acc__rating">{r.rating ?? '—'}</span>
          <span className="acc__chips">
            {CHIP_KEYS.filter((k) => r.counts[k] > 0).map((k) => (
              <em key={k} style={{ color: CLASS_META[k].color }} title={CLASS_META[k].label}>
                {r.counts[k]}{CLASS_META[k].glyph}
              </em>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
