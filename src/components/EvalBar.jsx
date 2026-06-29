import { winPercent, formatEval } from '../lib/analysis'

// Vertical advantage bar that sits next to the board. White fills from the
// side of the board white is on (bottom normally, top when flipped).
export default function EvalBar({ evalObj, flipped }) {
  if (!evalObj) return <div className="evalbar evalbar--empty" />

  const win = Math.max(1, Math.min(99, winPercent(evalObj.whiteCp)))
  const whiteStyle = flipped ? { top: 0, height: `${win}%` } : { bottom: 0, height: `${win}%` }
  const text = formatEval(evalObj)
  const whiteAhead = evalObj.whiteCp >= 0

  return (
    <div className="evalbar" title={`Evaluation: ${text}`}>
      <div className="evalbar__white" style={whiteStyle} />
      <span
        className={`evalbar__text ${whiteAhead ? 'on-white' : 'on-black'}`}
        style={flipped ? { top: 2 } : { bottom: 2 }}
      >
        {text}
      </span>
    </div>
  )
}
