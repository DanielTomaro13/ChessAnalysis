// Aggregate a player's record against each opponent across a set of games.

const DRAW_RESULTS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']

function outcome(side) {
  if (!side) return 'draw'
  if (side.result === 'win') return 'win'
  if (DRAW_RESULTS.includes(side.result)) return 'draw'
  return 'loss'
}

export function buildHeadToHead(games, username) {
  const lower = username.toLowerCase()
  const map = new Map()
  for (const g of games) {
    const userIsWhite = g.white?.username?.toLowerCase() === lower
    const opp = (userIsWhite ? g.black : g.white)?.username
    if (!opp) continue
    const out = outcome(userIsWhite ? g.white : g.black)
    const e = map.get(opp) || { opponent: opp, count: 0, win: 0, draw: 0, loss: 0 }
    e.count += 1
    e[out] += 1
    map.set(opp, e)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}
