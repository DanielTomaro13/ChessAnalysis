import { Chess } from 'chess.js'

/**
 * Parse a PGN into everything the viewer needs:
 *  - headers: the PGN tag pairs (White, Black, Result, ECO, ...)
 *  - sans: array of moves in Standard Algebraic Notation
 *  - fens: board positions; fens[0] is the start, fens[i] is after move i
 *
 * Returns null if the PGN can't be parsed.
 */
export function parsePgn(pgn) {
  if (!pgn) return null
  const game = new Chess()
  try {
    game.loadPgn(pgn)
  } catch {
    return null
  }

  const verbose = game.history({ verbose: true })
  const sans = verbose.map((m) => m.san)

  // Rebuild positions move-by-move so we can jump to any ply.
  const replay = new Chess()
  const fens = [replay.fen()]
  for (const move of verbose) {
    replay.move(move)
    fens.push(replay.fen())
  }

  return { headers: game.header(), sans, fens, moves: verbose, clocks: parseClocks(pgn) }
}

// Pull the per-move clock readings ([%clk H:MM:SS]) from a chess.com PGN.
// Returns remaining seconds after each ply (empty if the PGN has no clocks).
export function parseClocks(pgn) {
  const re = /%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)/g
  const out = []
  let m
  while ((m = re.exec(pgn))) {
    out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
  }
  return out
}

// "180+2" -> { base: 180, inc: 2 }. Returns null for odd/daily formats.
export function parseTimeControl(tc) {
  if (!tc) return null
  const m = /^(\d+)(?:\+(\d+))?$/.exec(tc.trim())
  if (!m) return null
  return { base: Number(m[1]), inc: Number(m[2] || 0) }
}

/** "1. e4 e5 2. Nf3 ..." pairing for a move-list display. */
export function toMovePairs(sans) {
  const pairs = []
  for (let i = 0; i < sans.length; i += 2) {
    pairs.push({
      number: i / 2 + 1,
      white: { san: sans[i], ply: i + 1 },
      black: sans[i + 1] ? { san: sans[i + 1], ply: i + 2 } : null,
    })
  }
  return pairs
}
