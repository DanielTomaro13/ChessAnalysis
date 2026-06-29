import { Chess } from 'chess.js'
import { Engine } from './engine'

// A mate is stored as a very large centipawn value so the eval bar / graph
// saturate sensibly. Closer mates score slightly higher.
const MATE_CP = 100000
function mateToCp(mate) {
  return (mate > 0 ? 1 : -1) * (MATE_CP - Math.min(Math.abs(mate), 30) * 100)
}

// Lichess win-probability model: centipawns (white POV) -> White win % (0..100).
export function winPercent(whiteCp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * whiteCp)) - 1)
}

// Human-readable eval from a white-POV evaluation object.
export function formatEval({ whiteCp, mate }) {
  if (mate != null) return (mate > 0 ? '+M' : '−M') + Math.abs(mate)
  const pawns = whiteCp / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}

const CLASS_ORDER = ['blunder', 'mistake', 'inaccuracy', 'good', 'best']
export const CLASS_META = {
  best: { label: 'Best', symbol: '', color: '#7fa650' },
  good: { label: 'Good', symbol: '', color: '#8ca3b0' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#d6a04a' },
  mistake: { label: 'Mistake', symbol: '?', color: '#e0823c' },
  blunder: { label: 'Blunder', symbol: '??', color: '#c5524a' },
}

function classify(winLoss, isBest) {
  if (isBest) return 'best'
  if (winLoss >= 20) return 'blunder'
  if (winLoss >= 10) return 'mistake'
  if (winLoss >= 5) return 'inaccuracy'
  if (winLoss >= 2) return 'good'
  return 'best'
}

// Per-move accuracy from the win% lost (lichess formula), 0..100.
function moveAccuracy(winLoss) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669))
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

// Terminal positions don't need the engine — read the result from the rules.
function terminalEval(fen, sideWhite) {
  const game = new Chess(fen)
  if (game.isCheckmate()) {
    // side to move is checkmated => the other side has mated
    return { whiteCp: sideWhite ? -MATE_CP : MATE_CP, mate: sideWhite ? -0 : 0, terminal: 'mate' }
  }
  if (game.isStalemate() || game.isInsufficientMaterial() || game.isDraw()) {
    return { whiteCp: 0, mate: null, terminal: 'draw' }
  }
  return null
}

/**
 * Evaluate every position of a game and classify every move.
 *
 * @param {string[]} fens  positions, fens[0] = start, fens[i] = after move i
 * @param {object[]} moves verbose chess.js moves (.from/.to/.promotion/.san)
 * @param {object} opts    { depth, onProgress(fraction, done, total), signal }
 */
export async function analyzeGame(fens, moves, { depth = 13, onProgress, signal } = {}) {
  const engine = new Engine()
  await engine.init()
  const evals = new Array(fens.length)

  try {
    for (let i = 0; i < fens.length; i++) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const sideWhite = i % 2 === 0

      const terminal = terminalEval(fens[i], sideWhite)
      if (terminal) {
        evals[i] = { ...terminal, bestMove: null }
      } else {
        const r = await engine.analyze(fens[i], depth)
        if (r.mate != null) {
          const mate = sideWhite ? r.mate : -r.mate // to white POV
          evals[i] = { whiteCp: mateToCp(mate), mate, bestMove: r.bestMove }
        } else {
          const whiteCp = sideWhite ? r.scoreCp : -r.scoreCp
          evals[i] = { whiteCp, mate: null, bestMove: r.bestMove }
        }
      }
      onProgress?.((i + 1) / fens.length, i + 1, fens.length)
    }
  } finally {
    engine.quit()
  }

  // Classify each move from the white-POV evals.
  const annotations = new Array(moves.length)
  const accWhite = []
  const accBlack = []
  for (let i = 0; i < moves.length; i++) {
    const sideWhite = i % 2 === 0
    const winWhiteBefore = winPercent(evals[i].whiteCp)
    const winWhiteAfter = winPercent(evals[i + 1].whiteCp)
    const moverBefore = sideWhite ? winWhiteBefore : 100 - winWhiteBefore
    const moverAfter = sideWhite ? winWhiteAfter : 100 - winWhiteAfter
    const winLoss = Math.max(0, moverBefore - moverAfter)

    const playedUci = moves[i].from + moves[i].to + (moves[i].promotion || '')
    const isBest = evals[i].bestMove != null && playedUci === evals[i].bestMove
    const klass = classify(winLoss, isBest)
    const acc = moveAccuracy(winLoss)

    annotations[i] = {
      ply: i + 1,
      class: klass,
      winLoss,
      accuracy: acc,
      bestMove: evals[i].bestMove,
    }
    ;(sideWhite ? accWhite : accBlack).push(acc)
  }

  const counts = (color) => {
    const out = Object.fromEntries(CLASS_ORDER.map((k) => [k, 0]))
    annotations.forEach((a, i) => {
      if ((i % 2 === 0) === color) out[a.class]++
    })
    return out
  }

  return {
    evals,
    annotations,
    accuracyWhite: mean(accWhite),
    accuracyBlack: mean(accBlack),
    countsWhite: counts(true),
    countsBlack: counts(false),
  }
}
