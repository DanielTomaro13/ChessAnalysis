import { useEffect } from 'react'

// Transient "achievement unlocked" toasts.
export default function AchievementToast({ toasts, onClear }) {
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(onClear, 4000)
    return () => clearTimeout(t)
  }, [toasts, onClear])

  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map((a) => (
        <div key={a.id} className="toast">
          <span className="toast__icon">{a.icon}</span>
          <div>
            <div className="toast__title">Achievement unlocked</div>
            <div className="toast__label">{a.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
