function fmt(sec) {
  if (sec == null) return '—'
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Remaining clock for a side (even plies = white) at the current position.
function remainingAt(clocks, ply, white, base) {
  let val = base
  for (let i = (white ? 0 : 1); i < ply; i += 2) val = clocks[i]
  return val
}

export default function Clocks({ clocks, tc, ply, flipped }) {
  if (!clocks || clocks.length === 0) return null
  const base = tc?.base ?? null
  const inc = tc?.inc ?? 0
  const white = { remaining: remainingAt(clocks, ply, true, base), label: 'White' }
  const black = { remaining: remainingAt(clocks, ply, false, base), label: 'Black' }

  // time spent on the move that reached this position
  let spent = null
  if (ply > 0) {
    const isWhite = (ply - 1) % 2 === 0
    const prev = ply - 3 >= 0 ? clocks[ply - 3] : base
    if (prev != null) spent = Math.max(0, prev - clocks[ply - 1] + inc)
    var spender = isWhite ? 'White' : 'Black'
  }

  const top = flipped ? white : black
  const bottom = flipped ? black : white
  return (
    <div className="clocks">
      <span className="clocks__c">⏱ {top.label} {fmt(top.remaining)}</span>
      {spent != null && (
        <span className="clocks__spent muted">{spender} spent {fmt(spent)}</span>
      )}
      <span className="clocks__c">⏱ {bottom.label} {fmt(bottom.remaining)}</span>
    </div>
  )
}
