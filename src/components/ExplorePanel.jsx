import { useEffect, useState } from 'react'
import { getExplorer } from '../api/explorer'

// Opening explorer: the theory continuations from this position (local data),
// ranked by how many named lines pass through each move. Click to play it.
export default function ExplorePanel({ fen, onPlay }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getExplorer(fen).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fen])

  return (
    <div className="explorer">
      <div className="explorer__head">
        <span className="muted">Opening explorer</span>
        {data?.opening && <span className="explorer__name">{data.opening}</span>}
      </div>
      {loading ? (
        <p className="muted explorer__empty">Loading…</p>
      ) : !data || !data.moves.length ? (
        <p className="muted explorer__empty">Out of book — no theory from here.</p>
      ) : (
        <ul className="explorer__moves">
          {data.moves.map((m) => (
            <li key={m.uci}>
              <button className="explorer__move" onClick={() => onPlay(m.uci)}>
                <span className="explorer__san">{m.san}</span>
                <span className="explorer__bar"><span style={{ width: `${m.pct}%` }} /></span>
                <span className="explorer__freq">{m.pct}%</span>
                {m.name && <span className="explorer__op muted">{m.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
