// Compact progression display: level + XP bar, combo, and daily goal.
export default function RewardBar({ progress, flash }) {
  const { level, xpIntoLevel, xpToNext, combo, daily } = progress
  const pct = xpToNext ? Math.min(100, (xpIntoLevel / xpToNext) * 100) : 0
  const dailyPct = Math.min(100, (daily.count / daily.goal) * 100)
  return (
    <div className="reward">
      <div className="reward__row">
        <span className="reward__level">Lv {level}</span>
        <div className="reward__xpbar" title={`${xpIntoLevel}/${xpToNext} XP`}>
          <div className="reward__xpfill" style={{ width: `${pct}%` }} />
          {flash && <span className="reward__xpgain">+{flash}</span>}
        </div>
        {combo > 1 && <span className="reward__combo">🔥 {combo}×</span>}
      </div>
      <div className="reward__daily">
        <span className="muted">Daily goal</span>
        <div className="reward__dailybar">
          <div
            className="reward__dailyfill"
            style={{ width: `${dailyPct}%`, background: daily.count >= daily.goal ? 'var(--accent)' : 'var(--draw)' }}
          />
        </div>
        <span className="reward__dailynum">{Math.min(daily.count, daily.goal)}/{daily.goal}</span>
      </div>
    </div>
  )
}
