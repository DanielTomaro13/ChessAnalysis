import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { parsePgn, toMovePairs, parseTimeControl } from '../lib/pgn'
import { analyzeGame, CLASS_META, formatEval } from '../lib/analysis'
import { loadOpenings } from '../lib/openings'
import { addMistakes } from '../lib/puzzles'
import { playSound, moveSoundKind } from '../lib/sound'
import { boardColors, getSettings, useSettings } from '../lib/settings'
import { idbGet, idbSet } from '../lib/cache'
import { Engine } from '../lib/engine'
import { fetchPlayerCard } from '../api/chessApi'
import { openingName } from '../api/explorer'
import { buildGameLink, copyLink } from '../lib/share'
import { buildAnnotatedPgn, downloadPgn } from '../lib/exportPgn'
import { isSaved, toggleSaved } from '../lib/library'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import MoveBadge from './MoveBadge'
import PlayerCards from './PlayerCards'
import KeyMoments from './KeyMoments'
import Clocks from './Clocks'
import ExplorePanel from './ExplorePanel'

const DEPTHS = [
  { label: 'Fast', value: 10 },
  { label: 'Balanced', value: 13 },
  { label: 'Deep', value: 16 },
]

// chips shown in the accuracy summary (skip the unremarkable categories)
const CHIP_KEYS = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']

export default function GameViewer({ game, username, initialPly = 0 }) {
  const settings = useSettings()
  const parsed = useMemo(() => (game ? parsePgn(game.pgn) : null), [game])
  const [ply, setPly] = useState(initialPly)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [depth, setDepth] = useState(getSettings().depth)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [engineError, setEngineError] = useState(null)
  const [boardWidth, setBoardWidth] = useState(0)
  const [cards, setCards] = useState({})
  const [variation, setVariation] = useState(null) // { startPly, sans[], fen }
  const [exploreEval, setExploreEval] = useState(null)
  const [showExplorer, setShowExplorer] = useState(false)
  const [showLines, setShowLines] = useState(false)
  const [liveLines, setLiveLines] = useState(null)
  const moveListRef = useRef(null)
  const boardRef = useRef(null)
  const cacheRef = useRef(new Map())
  const abortRef = useRef(null)
  const exploreEngineRef = useRef(null)
  const evalSeqRef = useRef(0)

  const total = parsed ? parsed.fens.length - 1 : 0
  const goTo = (p) => {
    setVariation(null)
    setExploreEval(null)
    setPly(Math.max(0, Math.min(total, p)))
  }

  // Lazily spin up a dedicated engine for live "explore"/lines evaluations.
  function exploreEngine() {
    if (!exploreEngineRef.current) {
      exploreEngineRef.current = (async () => {
        const e = new Engine()
        await e.init(3) // MultiPV 3 for the lines panel
        return e
      })()
    }
    return exploreEngineRef.current
  }

  function toWhitePov(scoreCp, mate, stm) {
    if (mate != null) {
      const m = stm === 'w' ? mate : -mate
      return { whiteCp: (m > 0 ? 1 : -1) * 100000, mate: m }
    }
    return { whiteCp: stm === 'w' ? scoreCp : -scoreCp, mate: null }
  }

  function pvToSan(fen, pv, max = 8) {
    const c = new Chess(fen)
    const out = []
    for (const u of (pv || []).slice(0, max)) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' })
      if (!m) break
      out.push(m.san)
    }
    return out
  }

  async function evalPosition(fen) {
    const seq = ++evalSeqRef.current
    setExploreEval({ loading: true })
    setLiveLines((l) => (l ? l : null))
    try {
      const e = await exploreEngine()
      const r = await e.analyze(fen, Math.min(depth, 14))
      if (seq !== evalSeqRef.current) return
      const stm = fen.split(' ')[1]
      const top = toWhitePov(r.scoreCp, r.mate, stm)
      setExploreEval({ whiteCp: top.whiteCp, mate: top.mate, bestMove: r.bestMove })
      setLiveLines(
        (r.lines || []).map((ln) => ({
          ...toWhitePov(ln.scoreCp, ln.mate, stm),
          sans: pvToSan(fen, ln.pv),
          firstUci: ln.pv?.[0] || null,
        })),
      )
    } catch {
      if (seq === evalSeqRef.current) {
        setExploreEval(null)
        setLiveLines(null)
      }
    }
  }

  // Make (or extend) an exploration line from the current position.
  function playExplore(uci) {
    const baseFen = variation ? variation.fen : parsed.fens[ply]
    const c = new Chess(baseFen)
    let move
    try {
      move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
    } catch {
      move = null
    }
    if (!move) return false
    const sans = variation ? [...variation.sans, move.san] : [move.san]
    const next = { startPly: variation ? variation.startPly : ply, sans, fen: c.fen() }
    setVariation(next)
    playSound(moveSoundKind(move))
    evalPosition(next.fen)
    return true
  }

  function undoExplore() {
    if (!variation) return
    const sans = variation.sans.slice(0, -1)
    if (!sans.length) {
      setVariation(null)
      setExploreEval(null)
      return
    }
    const c = new Chess(parsed.fens[variation.startPly])
    sans.forEach((s) => c.move(s))
    const next = { ...variation, sans, fen: c.fen() }
    setVariation(next)
    evalPosition(next.fen)
  }

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
    setPly(initialPly || 0)
    setEngineError(null)
    setProgress(0)
    setVariation(null)
    setExploreEval(null)
    setShowExplorer(false)
    setShowLines(false)
    setLiveLines(null)
    evalSeqRef.current++
    exploreEngineRef.current?.then((e) => e.quit())
    exploreEngineRef.current = null
    abortRef.current?.abort()
    setAnalyzing(false)
    if (!game || !username) {
      setAnalysis(null)
      return
    }
    setFlipped(game.black?.username?.toLowerCase() === username.toLowerCase())
    setSaved(isSaved(game.url))
    const memo = cacheRef.current.get(game.url)
    setAnalysis(memo ?? null)
    if (memo) return
    // Fall back to the persistent (IndexedDB) cache from a previous session.
    let cancelled = false
    idbGet(game.url).then((stored) => {
      if (cancelled || !stored) return
      cacheRef.current.set(game.url, stored)
      setAnalysis(stored)
    })
    return () => {
      cancelled = true
    }
  }, [game, username])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      exploreEngineRef.current?.then((e) => e.quit())
    },
    [],
  )

  // Fetch both players' profiles (avatar, title, current ratings).
  useEffect(() => {
    if (!game || game.imported) return // imported PGNs have arbitrary names
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

  // Live engine lines for the current mainline position (the explore path
  // drives its own eval when in a variation).
  useEffect(() => {
    if (!parsed || variation) return
    if (showLines) evalPosition(parsed.fens[ply])
    else setLiveLines(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, showLines, variation, game])

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
        idbSet(game.url, result)
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

  const { headers, sans, fens, moves, clocks } = parsed
  const pairs = toMovePairs(sans)
  const tc = parseTimeControl(headers.TimeControl)
  const inVar = !!variation
  const boardFen = inVar ? variation.fen : fens[ply]
  const shownEval = inVar ? (exploreEval?.loading ? null : exploreEval) : analysis ? analysis.evals[ply] : null
  const arrowMove = inVar ? exploreEval?.bestMove : analysis?.evals[ply]?.bestMove
  const arrows = arrowMove
    ? [[arrowMove.slice(0, 2), arrowMove.slice(2, 4), 'rgba(127,166,80,0.85)']]
    : []

  // Badge for the move that produced the current position (mainline only).
  const playedMove = !inVar && ply > 0 ? moves[ply - 1] : null
  const playedClass = analysis && ply > 0 ? analysis.annotations[ply - 1]?.class : null

  function onBoardDrop(from, to, piece) {
    const promo = piece && piece[1]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : ''
    return playExplore(from + to + promo)
  }

  return (
    <div className="viewer">
      <div className="viewer__board">
        <div className="board-row">
          <EvalBar evalObj={shownEval} flipped={flipped} />
          <div className="board-row__board" ref={boardRef}>
            <Chessboard
              position={boardFen}
              boardOrientation={flipped ? 'black' : 'white'}
              arePiecesDraggable
              onPieceDrop={onBoardDrop}
              customArrows={arrows}
              customDarkSquareStyle={{ backgroundColor: boardColors(settings.boardTheme).dark }}
              customLightSquareStyle={{ backgroundColor: boardColors(settings.boardTheme).light }}
            />
            {playedMove && (
              <MoveBadge square={playedMove.to} boardWidth={boardWidth} flipped={flipped} klass={playedClass} />
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
          <button
            className={showExplorer ? 'is-active' : ''}
            onClick={() => setShowExplorer((v) => !v)}
            title="Opening explorer"
          >
            ♟?
          </button>
          <button
            className={showLines ? 'is-active' : ''}
            onClick={() => setShowLines((v) => !v)}
            title="Engine lines"
          >
            ≡
          </button>
        </div>

        {(showLines || inVar) && liveLines && liveLines.length > 0 && (
          <div className="lines">
            {liveLines.map((ln, i) => (
              <button key={i} className="lines__row" onClick={() => ln.firstUci && playExplore(ln.firstUci)}>
                <span className="lines__eval">{formatEval(ln)}</span>
                <span className="lines__pv">{ln.sans.join(' ')}</span>
              </button>
            ))}
          </div>
        )}

        {inVar && (
          <div className="varbar">
            <span className="varbar__label">Exploring</span>
            <span className="varbar__line">
              {variation.sans.join(' ')}
              {exploreEval && !exploreEval.loading && (
                <em className="varbar__eval"> ({formatEval(exploreEval)})</em>
              )}
              {exploreEval?.loading && <em className="muted"> …</em>}
            </span>
            <button onClick={undoExplore}>↶</button>
            <button onClick={() => { setVariation(null); setExploreEval(null) }}>Return</button>
          </div>
        )}

        <Clocks clocks={clocks} tc={tc} ply={inVar ? variation.startPly : ply} flipped={flipped} />

        {showExplorer && <ExplorePanel fen={boardFen} onPlay={playExplore} />}

        {analysis && <EvalGraph evals={analysis.evals} ply={ply} onSeek={goTo} />}
      </div>

      <div className="viewer__sidebar">
        <PlayerCards game={game} cards={cards} />
        {openingName(headers) && <p className="viewer__opening">📖 {openingName(headers)}</p>}
        <p className="viewer__sub muted">
          <button
            className="linklike"
            onClick={() => setSaved(toggleSaved(game, username))}
            title={saved ? 'Remove from saved' : 'Save game'}
          >
            {saved ? '★ Saved' : '☆ Save'}
          </button>
          {' · '}
          {headers.Result} · {headers.ECO ? `${headers.ECO} ` : ''}
          {headers.TimeControl ? `· ${headers.TimeControl}` : ''}
          {!game.imported && game.url && (
            <>
              {' · '}
              <a className="viewer__link" href={game.url} target="_blank" rel="noreferrer">
                chess.com ↗
              </a>
            </>
          )}
          {!game.imported && username && (
            <>
              {' · '}
              <button
                className="linklike"
                onClick={async () => {
                  const ok = await copyLink(buildGameLink(username, game.end_time, game.url, ply))
                  if (ok) {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }
                }}
              >
                {copied ? 'Link copied ✓' : 'Share ⧉'}
              </button>
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
          {analysis && (
            <KeyMoments
              annotations={analysis.annotations}
              sans={sans}
              currentPly={ply}
              onJump={goTo}
            />
          )}
          {analysis && (
            <div className="export-row">
              <button onClick={() => downloadPgn(parsed, analysis)}>⬇ PGN</button>
              <button
                className="linklike"
                onClick={async () => {
                  if (await copyLink(buildAnnotatedPgn(parsed, analysis))) {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }
                }}
              >
                {copied ? 'Copied ✓' : 'Copy annotated PGN'}
              </button>
            </div>
          )}
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
