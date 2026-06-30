import { useEffect, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { BOTS, pickBotMove } from '../lib/bots'
import { Engine } from '../lib/engine'
import { playSound, moveSoundKind } from '../lib/sound'
import { boardColors, useSettings } from '../lib/settings'
import { toMovePairs } from '../lib/pgn'

const DOT = 'radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 24%)'
const RING = 'radial-gradient(circle, transparent 54%, rgba(197,82,74,0.55) 56%, transparent 70%)'
const SELECTED = 'rgba(240, 200, 60, 0.45)'
const LAST = 'rgba(127, 166, 80, 0.38)'
const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 }

// Material advantage (in pawns) for white, from a FEN.
function materialDiff(fen) {
  const placement = fen.split(' ')[0]
  let score = 0
  for (const ch of placement) {
    const low = ch.toLowerCase()
    if (PIECE_VAL[low]) score += (ch === low ? -1 : 1) * PIECE_VAL[low]
  }
  return score
}

export default function PlayBot() {
  const settings = useSettings()
  const [bot, setBot] = useState(null)
  const [colorChoice, setColorChoice] = useState('white')
  const [humanColor, setHumanColor] = useState('white')
  const [position, setPosition] = useState('start')
  const [status, setStatus] = useState('setup') // 'setup' | 'playing' | 'over'
  const [result, setResult] = useState(null) // { kind, text }
  const [thinking, setThinking] = useState(false)
  const [sans, setSans] = useState([])
  const [selected, setSelected] = useState(null)
  const [targets, setTargets] = useState([])
  const [lastMove, setLastMove] = useState(null)

  const gameRef = useRef(new Chess())
  const engineRef = useRef(null)
  const genRef = useRef(0) // bumps on new game so stale engine replies are ignored

  // Measure the board column so we can pass react-chessboard an explicit width
  // (its auto-measure can collapse to 0 height on first paint after a tab switch).
  const boardWrapRef = useRef(null)
  const [boardWidth, setBoardWidth] = useState(0)
  useEffect(() => {
    if (status === 'setup') return
    const el = boardWrapRef.current
    if (!el) return
    const measure = () => { const w = el.clientWidth; if (w) setBoardWidth(w) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [status])

  // react-chessboard can invoke a stale onSquareClick/onPieceDrop closure (one
  // captured during a "thinking" render), so the interaction handlers read all
  // volatile values from refs that are refreshed every render — immune to which
  // closure fires.
  const statusRef = useRef(status)
  const thinkingRef = useRef(thinking)
  const selectedRef = useRef(selected)
  const targetsRef = useRef(targets)
  const humanRef = useRef(humanColor)
  statusRef.current = status
  thinkingRef.current = thinking
  selectedRef.current = selected
  targetsRef.current = targets
  humanRef.current = humanColor

  useEffect(() => () => engineRef.current?.quit(), [])

  async function ensureEngine() {
    if (engineRef.current) return engineRef.current
    const e = new Engine()
    await e.init(5) // MultiPV 5 gives the personalities room to choose
    engineRef.current = e
    return e
  }

  function syncBoard() {
    const g = gameRef.current
    setPosition(g.fen())
    setSans(g.history())
  }

  function finishIfOver() {
    const g = gameRef.current
    if (!g.isGameOver()) return false
    let kind = 'draw', text = 'Draw'
    if (g.isCheckmate()) {
      const loserIsHuman = g.turn() === humanColor[0]
      kind = loserIsHuman ? 'loss' : 'win'
      text = loserIsHuman ? 'Checkmate — you lost' : 'Checkmate — you win! 🎉'
    } else if (g.isStalemate()) text = 'Stalemate — draw'
    else if (g.isInsufficientMaterial()) text = 'Insufficient material — draw'
    else if (g.isThreefoldRepetition()) text = 'Threefold repetition — draw'
    else if (g.isDraw()) text = 'Draw (50-move rule)'
    setStatus('over')
    setResult({ kind, text })
    playSound(kind === 'win' ? 'solve' : kind === 'loss' ? 'fail' : 'move')
    return true
  }

  function applyUci(uci) {
    const g = gameRef.current
    const move = { from: uci.slice(0, 2), to: uci.slice(2, 4) }
    if (uci.length > 4) move.promotion = uci[4]
    const res = g.move(move)
    if (res) {
      setLastMove({ from: res.from, to: res.to })
      playSound(moveSoundKind(res))
    }
    return res
  }

  async function botMove() {
    const g = gameRef.current
    if (g.isGameOver()) { finishIfOver(); return }
    const gen = genRef.current
    setThinking(true)
    try {
      const engine = await ensureEngine()
      const [uci] = await Promise.all([
        pickBotMove(g.fen(), bot, engine),
        new Promise((r) => setTimeout(r, 420)), // small think delay so it feels natural
      ])
      if (gen !== genRef.current) return // a new game started meanwhile
      if (uci) applyUci(uci)
      syncBoard()
      finishIfOver()
    } catch {
      /* engine died/aborted — ignore */
    } finally {
      if (gen === genRef.current) setThinking(false)
    }
  }

  function startGame(selectedBot, choice) {
    const color = choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice
    genRef.current++
    gameRef.current = new Chess()
    setBot(selectedBot)
    setHumanColor(color)
    setStatus('playing')
    setResult(null)
    setSelected(null)
    setTargets([])
    setLastMove(null)
    setThinking(false)
    setSans([])
    setPosition(gameRef.current.fen())
    if (color === 'black') setTimeout(botMove, 350)
  }

  // tryMove returns true if the human's move was legal & played.
  function tryMove(from, to, promo) {
    const g = gameRef.current
    if (statusRef.current !== 'playing' || thinkingRef.current || g.turn() !== humanRef.current[0]) return false
    const legal = g.moves({ verbose: true }).find((m) => m.from === from && m.to === to)
    if (!legal) return false
    applyUci(from + to + (legal.promotion ? promo || 'q' : ''))
    setSelected(null)
    setTargets([])
    syncBoard()
    if (!finishIfOver()) setTimeout(botMove, 120)
    return true
  }

  function onDrop(from, to) {
    return tryMove(from, to)
  }

  function selectSquare(square) {
    const g = gameRef.current
    const piece = g.get(square)
    const me = humanRef.current[0]
    if (piece && piece.color === me && g.turn() === me) {
      setSelected(square)
      setTargets(g.moves({ square, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })))
    } else {
      setSelected(null)
      setTargets([])
    }
  }

  function onSquareClick(square) {
    if (statusRef.current !== 'playing' || thinkingRef.current) return
    const sel = selectedRef.current
    if (!sel) return selectSquare(square)
    if (square === sel) { setSelected(null); setTargets([]); return }
    if (targetsRef.current.some((t) => t.to === square)) {
      if (!tryMove(sel, square)) selectSquare(square)
    } else {
      selectSquare(square)
    }
  }

  function resign() {
    if (status !== 'playing') return
    genRef.current++
    setStatus('over')
    setResult({ kind: 'loss', text: 'You resigned' })
    setThinking(false)
    playSound('fail')
  }

  function takeback() {
    const g = gameRef.current
    if (status !== 'playing' || thinking || g.history().length < 1) return
    genRef.current++ // cancel any in-flight bot move
    g.undo() // undo bot's reply (or your move if you're to move first)
    if (g.history().length && g.turn() !== humanColor[0]) g.undo()
    setThinking(false)
    setSelected(null)
    setTargets([])
    const hist = g.history({ verbose: true })
    setLastMove(hist.length ? { from: hist[hist.length - 1].from, to: hist[hist.length - 1].to } : null)
    syncBoard()
  }

  function changeBot() {
    genRef.current++
    setBot(null)
    setStatus('setup')
    setResult(null)
    setThinking(false)
  }

  // ---- setup screen ----
  if (status === 'setup') {
    return (
      <div className="playbot">
        <div className="playbot__setup">
          <h2>Choose your opponent</h2>
          <p className="muted">Eight bots, each with its own rating and personality. Pick one and play a full game.</p>
          <div className="playbot__color">
            <span className="muted">Play as:</span>
            {[['white', '♔ White'], ['black', '♚ Black'], ['random', '🎲 Random']].map(([k, label]) => (
              <button key={k} className={colorChoice === k ? 'is-active' : ''} onClick={() => setColorChoice(k)}>{label}</button>
            ))}
          </div>
          <div className="bot-grid">
            {BOTS.map((b) => (
              <button key={b.id} className="bot-card" style={{ '--bot': b.accent }} onClick={() => startGame(b, colorChoice)}>
                <span className="bot-card__emoji">{b.emoji}</span>
                <span className="bot-card__rating">{b.rating}</span>
                <h3 className="bot-card__name">{b.name}</h3>
                <p className="bot-card__tag">{b.tagline}</p>
                <p className="bot-card__blurb">{b.blurb}</p>
                <span className="bot-card__cta">Play →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- game screen ----
  const colors = boardColors(settings.boardTheme)
  const squareStyles = {}
  if (lastMove) { squareStyles[lastMove.from] = { background: LAST }; squareStyles[lastMove.to] = { background: LAST } }
  for (const t of targets) squareStyles[t.to] = { background: t.capture ? RING : DOT }
  if (selected) squareStyles[selected] = { background: SELECTED }

  const diff = materialDiff(position === 'start' ? new Chess().fen() : gameRef.current.fen())
  const humanAdv = humanColor === 'white' ? diff : -diff
  const pairs = toMovePairs(sans)
  const myTurn = status === 'playing' && !thinking && gameRef.current.turn() === humanColor[0]

  const advBadge = (forHuman) => {
    const v = forHuman ? humanAdv : -humanAdv
    return v > 0 ? <span className="adv">+{v}</span> : null
  }

  return (
    <div className="playbot playbot--game">
      <div className="playbot__board" ref={boardWrapRef}>
        <div className="playbot__player">
          <span className="playbot__who">{bot.emoji} {bot.name} <span className="muted">({bot.rating})</span></span>
          {thinking ? <span className="playbot__thinking">thinking…</span> : advBadge(false)}
        </div>
        <Chessboard
          position={position}
          boardOrientation={humanColor}
          boardWidth={boardWidth || undefined}
          arePiecesDraggable={myTurn}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={squareStyles}
          customDarkSquareStyle={{ backgroundColor: colors.dark }}
          customLightSquareStyle={{ backgroundColor: colors.light }}
        />
        <div className="playbot__player">
          <span className="playbot__who">You <span className="muted">({humanColor})</span></span>
          {advBadge(true)}
        </div>
      </div>

      <div className="playbot__side">
        {result && (
          <div className={`playbot__result playbot__result--${result.kind}`}>{result.text}</div>
        )}
        {status === 'playing' && (
          <div className="playbot__turn">
            {myTurn ? 'Your move' : thinking ? `${bot.name} is thinking…` : '…'}
          </div>
        )}

        <div className="playbot__moves">
          {pairs.map((p) => (
            <div className="playbot__moverow" key={p.number}>
              <span className="playbot__movenum">{p.number}.</span>
              <span>{p.white?.san}</span>
              <span>{p.black?.san || ''}</span>
            </div>
          ))}
          {!pairs.length && <p className="muted">No moves yet.</p>}
        </div>

        <div className="playbot__actions">
          {status === 'playing' ? (
            <>
              <button onClick={takeback} disabled={thinking || !sans.length}>↶ Takeback</button>
              <button onClick={resign}>🏳 Resign</button>
            </>
          ) : (
            <button className="analyze__btn" onClick={() => startGame(bot, colorChoice)}>↻ Rematch</button>
          )}
          <button onClick={changeBot}>Change bot</button>
        </div>
        <p className="muted playbot__note">Pawns auto-promote to a queen.</p>
      </div>
    </div>
  )
}
