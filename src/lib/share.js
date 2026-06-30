// Hash-based deep links (works on GitHub Pages with no server routing).
//   #g/<user>/<YYYY-MM>/<encoded game url>/<ply>   — a game at a ply
//   #p/<puzzleId>                                  — a puzzle

const baseUrl = () => `${location.origin}${location.pathname}`

export function parseHash() {
  const h = location.hash.replace(/^#/, '')
  if (!h) return null
  const parts = h.split('/')
  if (parts[0] === 'g' && parts.length >= 5) {
    return {
      type: 'game',
      user: decodeURIComponent(parts[1]),
      month: parts[2],
      gameUrl: decodeURIComponent(parts[3]),
      ply: Number(parts[4]) || 0,
    }
  }
  if (parts[0] === 'p' && parts[1]) return { type: 'puzzle', id: parts[1] }
  return null
}

export function buildGameLink(user, endTime, gameUrl, ply) {
  const d = new Date((endTime || 0) * 1000)
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${baseUrl()}#g/${encodeURIComponent(user)}/${month}/${encodeURIComponent(gameUrl)}/${ply}`
}

export function archiveUrlFor(user, month) {
  return `https://api.chess.com/pub/player/${user.toLowerCase()}/games/${month.replace('-', '/')}`
}

export function buildPuzzleLink(id) {
  return `${baseUrl()}#p/${id}`
}

export async function copyLink(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
