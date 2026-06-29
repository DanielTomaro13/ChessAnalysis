// Thin wrapper around the free, public, no-auth Chess.com Published-Data API.
// Docs: https://www.chess.com/news/view/published-data-api
// CORS is enabled on these endpoints, so they work directly from the browser.

const BASE = 'https://api.chess.com/pub'

function cleanUsername(username) {
  return encodeURIComponent(String(username).trim().toLowerCase())
}

/**
 * List a player's monthly game archives.
 * @returns {Promise<string[]>} archive URLs, oldest -> newest
 */
export async function fetchArchives(username) {
  const res = await fetch(`${BASE}/player/${cleanUsername(username)}/games/archives`)
  if (res.status === 404) throw new Error(`No chess.com player named "${username}".`)
  if (!res.ok) throw new Error(`Chess.com API error (${res.status}).`)
  const data = await res.json()
  return data.archives || []
}

/**
 * Fetch all games for one monthly archive URL.
 * Each game includes: url, pgn, time_control, time_class, end_time, rated,
 * eco, white {username, rating, result}, black {username, rating, result}.
 */
export async function fetchGamesForArchive(archiveUrl) {
  const res = await fetch(archiveUrl)
  if (!res.ok) throw new Error(`Failed to load games (${res.status}).`)
  const data = await res.json()
  return data.games || []
}

/** Public profile (avatar, name, country, etc.). Returns null if unavailable. */
export async function fetchProfile(username) {
  try {
    const res = await fetch(`${BASE}/player/${cleanUsername(username)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Turn an archive URL (".../games/2024/03") into a friendly label ("March 2024").
 */
export function archiveLabel(archiveUrl) {
  const m = archiveUrl.match(/\/(\d{4})\/(\d{2})$/)
  if (!m) return archiveUrl
  const [, year, month] = m
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
