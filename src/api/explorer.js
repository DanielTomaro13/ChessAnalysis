// Opening name (from the chess.com PGN headers) + a local, offline opening
// tree built from the Lichess open openings dataset (public/explorer.json).
// (The hosted Lichess explorer API now requires auth, and local data also works
// offline — a win for the PWA.)

export function openingName(headers) {
  if (headers?.Opening) return headers.Opening
  const url = headers?.ECOUrl
  if (url) {
    const slug = url.split('/').pop()
    if (slug) return decodeURIComponent(slug).replace(/[-_]+/g, ' ')
  }
  return headers?.ECO || null
}

const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ')

let dataPromise = null
function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(import.meta.env.BASE_URL + 'explorer.json')
      .then((r) => r.json())
      .catch(() => ({ names: {}, moves: {} }))
  }
  return dataPromise
}

/**
 * Theory continuations from a position.
 * Returns { opening, moves: [{san, uci, count, pct, name}] }.
 */
export async function getExplorer(fen) {
  const data = await loadData()
  const key = posKey(fen)
  const list = data.moves[key] || []
  const total = list.reduce((s, m) => s + m.n, 0) || 1
  return {
    opening: data.names[key] || null,
    moves: list.map((m) => ({
      san: m.s,
      uci: m.u,
      count: m.n,
      pct: Math.round((m.n / total) * 100),
      name: m.o,
    })),
  }
}
