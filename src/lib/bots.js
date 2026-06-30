import { Chess } from 'chess.js'

// Roster of play-against bots, à la chess.com — each with a rating, a playing
// "personality", and engine settings that make it that strong. Strength is
// shaped by three dials: search `depth`, `randomness` (chance of choosing a
// deliberately sub-optimal engine move) and `blunder` (chance of a fully random
// legal move). `style` biases which move it prefers among near-equal options.
export const BOTS = [
  {
    id: 'pawnsly', name: 'Pawnsly', emoji: '🐣', rating: 400, style: 'random',
    depth: 1, randomness: 0.6, blunder: 0.3, margin: 300, accent: '#9ab87a',
    tagline: 'Still learning the moves', blurb: 'A total beginner who pushes pieces almost at random. A gentle warm-up.',
  },
  {
    id: 'rex', name: 'Rookie Rex', emoji: '🐶', rating: 700, style: 'greedy',
    depth: 2, randomness: 0.5, blunder: 0.16, margin: 250, accent: '#c8a45a',
    tagline: 'Loves grabbing pieces', blurb: 'Snaps at every free piece and most non-free ones. Punish his greed.',
  },
  {
    id: 'tina', name: 'Tactical Tina', emoji: '🦊', rating: 1000, style: 'aggressive',
    depth: 4, randomness: 0.38, blunder: 0.07, margin: 150, accent: '#e0683c',
    tagline: 'Always attacking', blurb: 'Hunts for checks, captures and cheap threats. Trade her down and she fades.',
  },
  {
    id: 'sam', name: 'Solid Sam', emoji: '🐢', rating: 1250, style: 'defensive',
    depth: 5, randomness: 0.32, blunder: 0.04, margin: 120, accent: '#6f8d57',
    tagline: 'Patient and safe', blurb: 'Builds a fortress and waits for you to overpress. Rarely hangs material.',
  },
  {
    id: 'bruno', name: 'Blitz Bruno', emoji: '🐯', rating: 1500, style: 'aggressive',
    depth: 6, randomness: 0.24, blunder: 0.02, margin: 90, accent: '#e58f2a',
    tagline: 'Fast and sharp', blurb: 'A quick, attacking club player. Decent tactics — keep your king safe.',
  },
  {
    id: 'hoot', name: 'Professor Hoot', emoji: '🦉', rating: 1800, style: 'positional',
    depth: 8, randomness: 0.14, blunder: 0.008, margin: 60, accent: '#5b8bbd',
    tagline: 'Quiet positional squeeze', blurb: 'Improves pieces, fixes weaknesses and grinds. Strong and steady.',
  },
  {
    id: 'volkov', name: 'Maestro Volkov', emoji: '🦅', rating: 2100, style: 'balanced',
    depth: 11, randomness: 0.06, blunder: 0, margin: 35, accent: '#7fa650',
    tagline: 'Expert all-rounder', blurb: 'Few mistakes, sharp tactics, clean technique. A serious test.',
  },
  {
    id: 'stockzilla', name: 'Stockzilla', emoji: '🤖', rating: 2600, style: 'balanced',
    depth: 14, randomness: 0, blunder: 0, margin: 0, accent: '#1ee0c6',
    tagline: 'Pure engine', blurb: 'No mercy, no mistakes — full-strength Stockfish at this depth. Good luck.',
  },
]

export const getBot = (id) => BOTS.find((b) => b.id === id) || null

const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

// Single comparable number for an engine line (mate dominates centipawns),
// from the moving side's perspective.
function lineScore(line) {
  if (line.mate != null) return line.mate > 0 ? 1e6 - line.mate : -1e6 - line.mate
  return line.scoreCp ?? 0
}

function randomLegalUci(fen) {
  const moves = new Chess(fen).moves({ verbose: true })
  if (!moves.length) return null
  const m = moves[Math.floor(Math.random() * moves.length)]
  return m.from + m.to + (m.promotion || '')
}

// What kind of move is this (for style biasing)?
function moveInfo(fen, uci) {
  const c = new Chess(fen)
  const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci[4]
  const legal = c.moves({ verbose: true }).find(
    (m) => m.from === from && m.to === to && (!promo || m.promotion === promo),
  )
  if (!legal) return null
  c.move(legal)
  return {
    uci,
    capture: !!legal.captured,
    capturedVal: legal.captured ? PIECE_VAL[legal.captured] : 0,
    check: c.inCheck(),
  }
}

// Pick a worse-than-best candidate index, weighted toward the near-best ones.
function weightedWorseIndex(n) {
  const weights = []
  for (let i = 1; i < n; i++) weights.push(1 / i)
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * sum
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i + 1
  }
  return n - 1
}

// Among moves that are roughly as good as the anchor, pick the one that best
// fits the bot's personality.
function applyStyle(fen, candidates, anchorIdx, style) {
  const anchor = candidates[anchorIdx]
  const near = candidates.filter((c) => lineScore(anchor) - lineScore(c) <= (anchor.margin ?? 0))
  const infos = near.map((c) => moveInfo(fen, c.uci)).filter(Boolean)
  if (!infos.length) return anchor.uci

  switch (style) {
    case 'greedy': {
      const best = infos.reduce((a, b) => (b.capturedVal > a.capturedVal ? b : a))
      return best.uci
    }
    case 'aggressive': {
      const check = infos.find((m) => m.check)
      if (check) return check.uci
      const cap = infos.reduce((a, b) => (b.capturedVal > a.capturedVal ? b : a))
      if (cap.capturedVal > 0) return cap.uci
      return anchor.uci
    }
    case 'defensive':
    case 'positional': {
      const quiet = infos.find((m) => !m.capture && !m.check)
      return (quiet || infos[0]).uci
    }
    default:
      return anchor.uci
  }
}

/**
 * Decide the bot's move for `fen`. Returns a UCI string (e.g. "e2e4", "e7e8q").
 * Uses the shared Engine (must be init'd with MultiPV >= 2 for personality).
 */
export async function pickBotMove(fen, bot, engine) {
  const legal = new Chess(fen).moves({ verbose: true })
  if (!legal.length) return null
  if (legal.length > 1 && Math.random() < bot.blunder) return randomLegalUci(fen)

  const res = await engine.analyze(fen, bot.depth)
  // Candidate first-moves from each MultiPV line, best first, de-duplicated.
  const seen = new Set()
  const candidates = []
  for (const line of res.lines || []) {
    const uci = line.pv?.[0]
    if (!uci || seen.has(uci)) continue
    seen.add(uci)
    candidates.push({ uci, scoreCp: line.scoreCp, mate: line.mate, margin: bot.margin })
  }
  if (!candidates.length) return res.bestMove || randomLegalUci(fen)

  let anchorIdx = 0
  if (candidates.length > 1 && Math.random() < bot.randomness) {
    anchorIdx = weightedWorseIndex(candidates.length)
  }
  return applyStyle(fen, candidates, anchorIdx, bot.style)
}
