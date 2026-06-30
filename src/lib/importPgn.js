import { Chess } from 'chess.js'
import { parseTimeControl } from './pgn'

function hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function timeClassFor(tc) {
  const parsed = parseTimeControl(tc)
  if (!parsed) return undefined
  const t = parsed.base + 40 * parsed.inc
  if (t < 180) return 'bullet'
  if (t < 600) return 'blitz'
  if (t < 1800) return 'rapid'
  return 'daily'
}

function endTimeFrom(h) {
  const date = h.UTCDate || h.Date
  if (date && /^\d{4}\.\d{2}\.\d{2}$/.test(date)) {
    const [y, m, d] = date.split('.').map(Number)
    const [hh, mm, ss] = (h.UTCTime || '00:00:00').split(':').map(Number)
    const ms = Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0)
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000)
  }
  return Math.floor(Date.now() / 1000)
}

/**
 * Validate a pasted PGN and turn it into a game object shaped like the
 * chess.com API games the rest of the app consumes.
 */
export function buildGameFromPgn(pgn) {
  const game = new Chess()
  game.loadPgn(pgn) // throws on invalid PGN
  if (game.history().length === 0) throw new Error('No moves found in that PGN.')
  const h = game.header()
  const result = h.Result || '*'
  const code = (won) => (won === 'win' ? 'win' : won === 'draw' ? 'agreed' : 'resigned')
  const wOut = result === '1-0' ? 'win' : result === '0-1' ? 'loss' : 'draw'
  const bOut = result === '0-1' ? 'win' : result === '1-0' ? 'loss' : 'draw'
  return {
    pgn,
    url: 'pgn:' + hash(pgn),
    imported: true,
    time_control: h.TimeControl || null,
    time_class: timeClassFor(h.TimeControl),
    end_time: endTimeFrom(h),
    rated: false,
    white: { username: h.White || 'White', rating: Number(h.WhiteElo) || undefined, result: code(wOut) },
    black: { username: h.Black || 'Black', rating: Number(h.BlackElo) || undefined, result: code(bOut) },
  }
}
