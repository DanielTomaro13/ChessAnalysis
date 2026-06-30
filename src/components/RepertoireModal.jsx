import { useMemo } from 'react'
import { buildRepertoire } from '../lib/repertoire'

function Column({ title, rows }) {
  return (
    <div className="rep__col">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">No games.</p>
      ) : (
        <ul className="rep__list">
          {rows.map((r) => {
            const winPct = Math.round((r.win / r.count) * 100)
            return (
              <li key={r.name} className="rep__row">
                <span className="rep__name" title={r.name}>{r.name}</span>
                <span className="rep__count">{r.count}</span>
                <span className="rep__bar">
                  <span className="rep__w" style={{ width: `${(r.win / r.count) * 100}%` }} />
                  <span className="rep__d" style={{ width: `${(r.draw / r.count) * 100}%` }} />
                  <span className="rep__l" style={{ width: `${(r.loss / r.count) * 100}%` }} />
                </span>
                <span className="rep__pct">{winPct}%</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function RepertoireModal({ games, username, onClose }) {
  const rep = useMemo(() => buildRepertoire(games, username), [games, username])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Openings this month</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <p className="muted modal__note">Win / draw / loss for your most-played openings.</p>
        <div className="rep">
          <Column title="As White" rows={rep.white} />
          <Column title="As Black" rows={rep.black} />
        </div>
      </div>
    </div>
  )
}
