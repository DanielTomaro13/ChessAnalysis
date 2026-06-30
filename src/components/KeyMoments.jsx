import { CLASS_META } from '../lib/analysis'

const NOTABLE = ['blunder', 'mistake', 'miss', 'brilliant', 'great']

// Turning points: blunders/mistakes/brilliancies, sorted by where they happen,
// each a chip that jumps the board to that move.
export default function KeyMoments({ annotations, sans, currentPly, onJump }) {
  const moments = annotations
    .map((a, i) => ({ ...a, ply: i + 1, san: sans[i], white: i % 2 === 0 }))
    .filter((m) => NOTABLE.includes(m.class))

  if (!moments.length) return null

  return (
    <div className="moments">
      <div className="moments__head muted">Key moments</div>
      <div className="moments__list">
        {moments.map((m) => {
          const meta = CLASS_META[m.class]
          const num = Math.ceil(m.ply / 2)
          return (
            <button
              key={m.ply}
              className={`moment ${currentPly === m.ply ? 'is-current' : ''}`}
              style={{ borderColor: meta.color }}
              onClick={() => onJump(m.ply)}
              title={`${meta.label} · −${m.winLoss.toFixed(0)}% win`}
            >
              <span className="moment__num">{num}{m.white ? '.' : '…'}</span>
              <span style={{ color: meta.color }}>{m.san}{meta.symbol}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
