import { Chess } from 'chess.js'
import { Engine } from './engine'
import { posKey } from './openings'

const MATE_CP = 100000
function mateToCp(mate) {
  return (mate > 0 ? 1 : -1) * (MATE_CP - Math.min(Math.abs(mate), 30) * 100)
}

// Lichess win-probability model: centipawns (white POV) -> White win % (0..100).
export function winPercent(whiteCp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * whiteCp)) - 1)
}

export function formatEval({ whiteCp, mate }) {
  if (mate != null) return (mate > 0 ? '+M' : '−M') + Math.abs(mate)
  const pawns = whiteCp / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}

// Move quality categories (chess.com-style). `symbol` shows in the move list,
// `glyph` shows in the on-board badge, `color` themes both.
export const CLASS_META = {
  brilliant: { label: 'Brilliant', symbol: '!!', glyph: '!!', color: '#1ee0c6' },
  great: { label: 'Great', symbol: '!', glyph: '!', color: '#5b8bbd' },
  best: { label: 'Best', symbol: '', glyph: '★', color: '#81b64c' },
  excellent: { label: 'Excellent', symbol: '', glyph: '✓', color: '#81b64c' },
  good: { label: 'Good', symbol: '', glyph: '✓', color: '#9ab87a' },
  book: { label: 'Book', symbol: '', glyph: '♘', color: '#a88865' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', glyph: '?!', color: '#f0b429' },
  mistake: { label: 'Mistake', symbol: '?', glyph: '?', color: '#e58f2a' },
  miss: { label: 'Miss', symbol: '?', glyph: '✗', color: '#e0683c' },
  blunder: { label: 'Blunder', symbol: '??', glyph: '??', color: '#c5524a' },
}
export const CLASS_KEYS = Object.keys(CLASS_META)

const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

// Static Exchange Evaluation on a square for the side to move at `fen`.
// Returns the material (in pawns) the side to move wins by initiating
// captures on `square`. Used to spot offered (hanging) material.
function see(fen, square) {
  const board = new Chess(fen)
  const victim = board.get(square)
  if (!victim) return 0
  const gains = []
  let side = board.turn()
  let onSquareVal = PIECE_VAL[victim.type]
  let d = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const attackers = board.attackers(square, side)
    if (attackers.length === 0) break
    let lvaSq = attackers[0]
    let lvaVal = PIECE_VAL[board.get(attackers[0]).type]
    for (const sq of attackers) {
      const v = PIECE_VAL[board.get(sq).type]
      if (v < lvaVal) {
        lvaVal = v
        lvaSq = sq
      }
    }
    gains[d] = onSquareVal - (d > 0 ? gains[d - 1] : 0)
    const moving = board.get(lvaSq)
    board.remove(lvaSq)
    board.remove(square)
    board.put(moving, square)
    onSquareVal = PIECE_VAL[moving.type]
    side = side === 'w' ? 'b' : 'w'
    d++
    if (d > 32) break
  }
  for (let i = d - 1; i > 0; i--) {
    gains[i - 1] = -Math.max(-gains[i - 1], gains[i])
  }
  return gains[0] ?? 0
}

// Did the side that just moved leave material hanging? (i.e. the side to move
// at `fenAfter` can win >= ~2 pawns via a capture) — the signature of a sac.
function offersSacrifice(fenAfter) {
  const board = new Chess(fenAfter)
  const grabber = board.turn() // opponent of the player who just moved
  let best = 0
  for (const row of board.board()) {
    for (const cell of row) {
      if (!cell || cell.color === grabber) continue
      if (board.attackers(cell.square, grabber).length === 0) continue
      const gain = see(fenAfter, cell.square)
      if (gain > best) best = gain
    }
  }
  return best >= 2
}

// Estimated performance rating for a single game from its accuracy %.
// Piecewise-linear fit to roughly match chess.com's per-game estimate.
const RATING_TABLE = [
  [40, 250], [50, 600], [55, 800], [60, 1000], [65, 1200],
  [70, 1400], [75, 1600], [80, 1850], [85, 2100], [90, 2350],
  [95, 2600], [99, 2850],
]
export function estimatedRating(acc) {
  if (acc == null) return null
  const t = RATING_TABLE
  if (acc <= t[0][0]) return t[0][1]
  if (acc >= t[t.length - 1][0]) return t[t.length - 1][1]
  for (let i = 1; i < t.length; i++) {
    if (acc <= t[i][0]) {
      const [a0, r0] = t[i - 1]
      const [a1, r1] = t[i]
      return Math.round(r0 + ((acc - a0) / (a1 - a0)) * (r1 - r0))
    }
  }
  return t[t.length - 1][1]
}

function moveAccuracy(winLoss) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669))
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function toWhite(cp, mate, sideWhite) {
  if (mate != null) {
    const m = sideWhite ? mate : -mate
    return { whiteCp: mateToCp(m), mate: m }
  }
  return { whiteCp: sideWhite ? cp : -cp, mate: null }
}

function terminalEval(fen, sideWhite) {
  const game = new Chess(fen)
  if (game.isCheckmate()) {
    return { whiteCp: sideWhite ? -MATE_CP : MATE_CP, mate: sideWhite ? -0 : 0 }
  }
  if (game.isStalemate() || game.isInsufficientMaterial() || game.isDraw()) {
    return { whiteCp: 0, mate: null }
  }
  return null
}

function classify({ winLoss, isBest, onlyMove, isBook, isSac, moverBefore, moverAfter }) {
  if (isBook) return 'book'
  if (winLoss < 2 && isSac && moverBefore < 97 && moverAfter >= 45) return 'brilliant'
  if (winLoss < 2 && onlyMove) return 'great'
  if (winLoss >= 10 && moverBefore >= 60 && onlyMove) return 'miss'
  if (winLoss < 2) return isBest ? 'best' : 'excellent'
  if (winLoss < 5) return 'good'
  if (winLoss < 10) return 'inaccuracy'
  if (winLoss < 20) return 'mistake'
  return 'blunder'
}

/**
 * Evaluate every position and classify every move.
 * @param {object} opts { depth, onProgress, signal, book:Set }
 */
export async function analyzeGame(fens, moves, { depth = 13, onProgress, signal, book } = {}) {
  const engine = new Engine()
  await engine.init()
  const evals = new Array(fens.length)

  try {
    for (let i = 0; i < fens.length; i++) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const sideWhite = i % 2 === 0
      const terminal = terminalEval(fens[i], sideWhite)
      if (terminal) {
        evals[i] = { ...terminal, bestMove: null, secondWhiteCp: null }
      } else {
        const r = await engine.analyze(fens[i], depth)
        const top = toWhite(r.scoreCp, r.mate, sideWhite)
        const second = r.hasSecond ? toWhite(r.secondScoreCp, r.secondMate, sideWhite).whiteCp : null
        evals[i] = { whiteCp: top.whiteCp, mate: top.mate, bestMove: r.bestMove, secondWhiteCp: second }
      }
      onProgress?.((i + 1) / fens.length, i + 1, fens.length)
    }
  } finally {
    engine.quit()
  }

  const annotations = new Array(moves.length)
  const accWhite = []
  const accBlack = []

  for (let i = 0; i < moves.length; i++) {
    const sideWhite = i % 2 === 0
    const before = evals[i]
    const after = evals[i + 1]

    const winWhiteBefore = winPercent(before.whiteCp)
    const winWhiteAfter = winPercent(after.whiteCp)
    const moverBefore = sideWhite ? winWhiteBefore : 100 - winWhiteBefore
    const moverAfter = sideWhite ? winWhiteAfter : 100 - winWhiteAfter
    const winLoss = Math.max(0, moverBefore - moverAfter)

    const playedUci = moves[i].from + moves[i].to + (moves[i].promotion || '')
    const isBest = before.bestMove != null && playedUci === before.bestMove

    // "only move": best line is much better than the second best
    let onlyMove = false
    if (before.secondWhiteCp != null) {
      const secondMover = sideWhite ? winPercent(before.secondWhiteCp) : 100 - winPercent(before.secondWhiteCp)
      onlyMove = moverBefore - secondMover >= 10
    }

    // book: both positions are known theory
    const isBook = !!book && book.has(posKey(fens[i])) && book.has(posKey(fens[i + 1]))

    // sacrifice (only worth checking when the move is otherwise top-tier)
    const isSac = winLoss < 2 && !isBook ? offersSacrifice(fens[i + 1]) : false

    const klass = classify({ winLoss, isBest, onlyMove, isBook, isSac, moverBefore, moverAfter })
    const acc = moveAccuracy(winLoss)

    annotations[i] = { ply: i + 1, class: klass, winLoss, accuracy: acc, bestMove: before.bestMove }
    ;(sideWhite ? accWhite : accBlack).push(acc)
  }

  const counts = (white) => {
    const out = Object.fromEntries(CLASS_KEYS.map((k) => [k, 0]))
    annotations.forEach((a, i) => {
      if (i % 2 === 0 === white) out[a.class]++
    })
    return out
  }

  const accuracyWhite = mean(accWhite)
  const accuracyBlack = mean(accBlack)
  return {
    evals,
    annotations,
    accuracyWhite,
    accuracyBlack,
    ratingWhite: estimatedRating(accuracyWhite),
    ratingBlack: estimatedRating(accuracyBlack),
    countsWhite: counts(true),
    countsBlack: counts(false),
  }
}
