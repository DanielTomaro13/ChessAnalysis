import { useState } from 'react'
import GameViewer from './GameViewer'
import { getSaved, removeSaved } from '../lib/library'

const DRAW_RESULTS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']
function describe(game, username) {
  const lower = (username || '').toLowerCase()
  const userIsWhite = game.white?.username?.toLowerCase() === lower
  const me = userIsWhite ? game.white : game.black
  let outcome = 'draw'
  if (lower && (game.white?.username?.toLowerCase() === lower || game.black?.username?.toLowerCase() === lower)) {
    outcome = me?.result === 'win' ? 'win' : DRAW_RESULTS.includes(me?.result) ? 'draw' : 'loss'
  } else {
    outcome = 'none'
  }
  return {
    white: game.white?.username || 'White',
    black: game.black?.username || 'Black',
    color: userIsWhite ? 'white' : 'black',
    outcome,
    meta: game.imported ? 'imported' : game.time_class,
  }
}

export default function SavedGames() {
  const [list, setList] = useState(getSaved())
  const [selected, setSelected] = useState(list[0] || null)

  function remove(url) {
    const next = removeSaved(url)
    setList(next)
    if (selected?.game.url === url) setSelected(next[0] || null)
  }

  if (!list.length) {
    return (
      <div className="viewer viewer--empty muted" style={{ margin: '1rem' }}>
        No saved games yet. Open a game and click <strong>★ Save</strong>.
      </div>
    )
  }

  return (
    <main className="app__main">
      <aside className="app__sidebar">
        <div className="game-list">
          <div className="game-list__header">
            <span>Saved games</span>
            <span className="muted">{list.length}</span>
          </div>
          <ul className="game-list__items">
            {list.map((e) => {
              const d = describe(e.game, e.username)
              const active = selected?.game.url === e.game.url
              return (
                <li key={e.game.url} className="saved__item">
                  <button
                    className={`game-row game-row--${d.outcome} ${active ? 'is-active' : ''}`}
                    onClick={() => setSelected(e)}
                  >
                    <span className={`dot dot--${d.color}`} />
                    <span className="game-row__opp">{d.white} – {d.black}</span>
                    <span className="game-row__meta">{d.meta}</span>
                  </button>
                  <button className="saved__rm" title="Remove" onClick={() => remove(e.game.url)}>✕</button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
      <section className="app__viewer">
        {selected && <GameViewer game={selected.game} username={selected.username} />}
      </section>
    </main>
  )
}
