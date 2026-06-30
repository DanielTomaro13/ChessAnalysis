// Aggregate the openings a player reaches across a set of games (from the PGN
// headers — cheap regex, no full parse).

const DRAW_RESULTS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']

function outcome(side) {
  if (!side) return 'draw'
  if (side.result === 'win') return 'win'
  if (DRAW_RESULTS.includes(side.result)) return 'draw'
  return 'loss'
}

function openingOf(pgn) {
  const url = pgn.match(/\[ECOUrl\s+"[^"]*\/openings\/([^"]+)"\]/)
  if (url) {
    return decodeURIComponent(url[1])
      .replace(/[-_.]+/g, ' ')
      .replace(/\s+\d.*$/, '') // drop the "...4...Nf6" move tail
      .trim()
  }
  const op = pgn.match(/\[Opening\s+"([^"]+)"\]/)
  if (op) return op[1]
  const eco = pgn.match(/\[ECO\s+"([^"]+)"\]/)
  return eco ? eco[1] : 'Unknown'
}

export function buildRepertoire(games, username) {
  const lower = username.toLowerCase()
  const byColor = { white: new Map(), black: new Map() }
  for (const g of games) {
    if (!g.pgn) continue
    const userIsWhite = g.white?.username?.toLowerCase() === lower
    const color = userIsWhite ? 'white' : 'black'
    const out = outcome(userIsWhite ? g.white : g.black)
    const name = openingOf(g.pgn)
    const map = byColor[color]
    const e = map.get(name) || { name, count: 0, win: 0, draw: 0, loss: 0 }
    e.count += 1
    e[out] += 1
    map.set(name, e)
  }
  const top = (map) =>
    [...map.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  return { white: top(byColor.white), black: top(byColor.black) }
}
