// Compact chess.com rating chips (bullet / blitz / rapid).
const ITEMS = [
  ['bullet', '⚡', 'Bullet'],
  ['blitz', '⏱', 'Blitz'],
  ['rapid', '♞', 'Rapid'],
]

export default function RatingChips({ ratings, className = '' }) {
  if (!ratings) return null
  const shown = ITEMS.filter(([k]) => ratings[k] != null)
  if (!shown.length) return null
  return (
    <div className={`ratingchips ${className}`}>
      {shown.map(([k, icon, label]) => (
        <span className="ratingchip" key={k}>
          <span className="ratingchip__icon">{icon}</span>
          <span className="ratingchip__label">{label}</span>
          <b>{ratings[k]}</b>
        </span>
      ))}
    </div>
  )
}
