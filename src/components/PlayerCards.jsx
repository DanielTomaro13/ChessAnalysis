const DRAW_RESULTS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']
function outcome(side) {
  if (!side) return null
  if (side.result === 'win') return 'win'
  if (DRAW_RESULTS.includes(side.result)) return 'draw'
  return 'loss'
}
const RESULT_LABEL = { win: '1', draw: '½', loss: '0' }
const CLASSES = [
  { key: 'bullet', label: 'BUL' },
  { key: 'blitz', label: 'BLZ' },
  { key: 'rapid', label: 'RAP' },
]

function PlayerRow({ side, color, card, timeClass }) {
  const out = outcome(side)
  const initial = (side?.username || '?')[0].toUpperCase()
  return (
    <div className="player">
      <span className={`player__dot dot dot--${color}`} title={`Played ${color}`} />
      {card?.avatar ? (
        <img className="player__avatar" src={card.avatar} alt="" loading="lazy" />
      ) : (
        <span className="player__avatar player__avatar--fallback">{initial}</span>
      )}
      <div className="player__info">
        <a className="player__name" href={card?.url} target="_blank" rel="noreferrer">
          {card?.title && <em className="player__title">{card.title}</em>}
          {side?.username}
          {side?.rating ? <span className="muted"> ({side.rating})</span> : null}
          {card?.flag ? <span className="player__flag"> {card.flag}</span> : null}
        </a>
        {card && (
          <div className="player__ratings">
            {CLASSES.map((c) =>
              card.ratings[c.key] != null ? (
                <span key={c.key} className={`rt ${c.key === timeClass ? 'rt--active' : ''}`}>
                  {c.label} {card.ratings[c.key]}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
      {out && <span className={`player__result result--${out}`}>{RESULT_LABEL[out]}</span>}
    </div>
  )
}

export default function PlayerCards({ game, cards }) {
  return (
    <div className="players">
      <PlayerRow side={game.white} color="white" card={cards[game.white?.username?.toLowerCase()]} timeClass={game.time_class} />
      <PlayerRow side={game.black} color="black" card={cards[game.black?.username?.toLowerCase()]} timeClass={game.time_class} />
    </div>
  )
}
