// Eval timeline: white-POV evaluation across the whole game. Click to seek.
export default function EvalGraph({ evals, ply, onSeek }) {
  const N = evals.length
  if (N < 2) return null

  const W = 320
  const H = 64
  const CAP = 600 // clamp eval to ±6 pawns for display
  const x = (i) => (i / (N - 1)) * W
  const y = (cp) => {
    const c = Math.max(-CAP, Math.min(CAP, cp))
    return H / 2 - (c / CAP) * (H / 2 - 2)
  }

  const line = evals.map((e, i) => `${x(i).toFixed(1)},${y(e.whiteCp).toFixed(1)}`).join(' ')
  const area = `0,${H / 2} ${line} ${W},${H / 2}`

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    onSeek(Math.round(frac * (N - 1)))
  }

  return (
    <svg
      className="evalgraph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={handleClick}
      role="img"
      aria-label="Evaluation graph"
    >
      <rect x="0" y="0" width={W} height={H / 2} className="evalgraph__whitezone" />
      <rect x="0" y={H / 2} width={W} height={H / 2} className="evalgraph__blackzone" />
      <polygon points={area} className="evalgraph__fill" />
      <polyline points={line} className="evalgraph__line" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="evalgraph__mid" />
      <line x1={x(ply)} y1="0" x2={x(ply)} y2={H} className="evalgraph__cursor" />
    </svg>
  )
}
