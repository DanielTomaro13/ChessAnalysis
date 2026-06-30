import { getProgress, ACHIEVEMENTS } from '../lib/progress'
import { getPuzzleRating, getSolvedCount, getRatingHistory } from '../lib/puzzles'

function Sparkline({ data }) {
  if (data.length < 2) return null
  const W = 280, H = 60
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 6) - 3}`)
    .join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function PuzzleStats() {
  const p = getProgress()
  const rating = getPuzzleRating()
  const solved = getSolvedCount()
  const history = getRatingHistory()

  const themes = Object.entries(p.themeStats)
    .filter(([, s]) => s.seen >= 2)
    .sort((a, b) => b[1].seen - a[1].seen)
    .slice(0, 12)

  return (
    <div className="stats">
      <div className="stats__top">
        <div className="stats__card">
          <span className="muted">Level</span>
          <strong>{p.level}</strong>
          <small className="muted">{p.xp} XP</small>
        </div>
        <div className="stats__card">
          <span className="muted">Puzzle rating</span>
          <strong>{rating}</strong>
          <Sparkline data={history} />
        </div>
        <div className="stats__card">
          <span className="muted">Solved</span>
          <strong>{solved}</strong>
          <small className="muted">{p.total} attempts</small>
        </div>
        <div className="stats__card">
          <span className="muted">Today</span>
          <strong>{Math.min(p.daily.count, p.daily.goal)}/{p.daily.goal}</strong>
          <small className="muted">daily goal</small>
        </div>
      </div>

      <h3 className="stats__h">Tactics accuracy</h3>
      {themes.length === 0 ? (
        <p className="muted">Solve a few puzzles to build your theme breakdown.</p>
      ) : (
        <div className="stats__themes">
          {themes.map(([key, s]) => {
            const pct = Math.round((s.solved / s.seen) * 100)
            return (
              <div key={key} className="themebar">
                <span className="themebar__name">{key}</span>
                <div className="themebar__track">
                  <div className="themebar__fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="themebar__pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="stats__h">Achievements</h3>
      <div className="stats__achievements">
        {ACHIEVEMENTS.map((a) => {
          const got = p.achievements.has(a.id)
          return (
            <div key={a.id} className={`ach ${got ? 'is-unlocked' : ''}`} title={a.label}>
              <span className="ach__icon">{got ? a.icon : '🔒'}</span>
              <span className="ach__label">{a.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
