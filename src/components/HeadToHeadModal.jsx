import { useMemo } from 'react'
import { buildHeadToHead } from '../lib/headToHead'

export default function HeadToHeadModal({ games, username, onPick, onClose }) {
  const rows = useMemo(() => buildHeadToHead(games, username), [games, username])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Opponents this month</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <p className="muted modal__note">Your record vs each opponent — click to filter the list.</p>
        <ul className="rep__list">
          {rows.map((r) => (
            <li key={r.opponent}>
              <button className="h2h__row" onClick={() => onPick(r.opponent)}>
                <span className="rep__name" title={r.opponent}>{r.opponent}</span>
                <span className="h2h__rec">
                  <span className="result--win">{r.win}</span>/
                  <span className="result--draw">{r.draw}</span>/
                  <span className="result--loss">{r.loss}</span>
                </span>
                <span className="rep__bar">
                  <span className="rep__w" style={{ width: `${(r.win / r.count) * 100}%` }} />
                  <span className="rep__d" style={{ width: `${(r.draw / r.count) * 100}%` }} />
                  <span className="rep__l" style={{ width: `${(r.loss / r.count) * 100}%` }} />
                </span>
                <span className="rep__pct">{Math.round((r.win / r.count) * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
