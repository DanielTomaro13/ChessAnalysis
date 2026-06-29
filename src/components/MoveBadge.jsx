import { CLASS_META } from '../lib/analysis'

// chess.com-style quality badge, positioned on the to-square of the played move.
export default function MoveBadge({ square, boardWidth, flipped, klass }) {
  if (!square || !boardWidth || !klass) return null
  const meta = CLASS_META[klass]
  const file = square.charCodeAt(0) - 97 // a..h -> 0..7
  const rank = parseInt(square[1], 10) - 1 // 1..8 -> 0..7
  const sq = boardWidth / 8
  const col = flipped ? 7 - file : file
  const row = flipped ? rank : 7 - rank
  const size = Math.max(15, sq * 0.46)
  const left = col * sq + sq - size * 0.62
  const top = row * sq - size * 0.3
  return (
    <div
      className="movebadge"
      style={{ left, top, width: size, height: size, background: meta.color, fontSize: size * 0.52 }}
      title={meta.label}
    >
      {meta.glyph}
    </div>
  )
}
