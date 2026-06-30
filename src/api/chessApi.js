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

/**
 * Fetch the player's most recent games across several monthly archives, for
 * aggregate insights. Newest-first, capped so we don't pull a whole career.
 * @returns {Promise<object[]>} standard-chess games, newest first
 */
export async function fetchRecentGames(username, { maxMonths = 6, maxGames = 800, onProgress } = {}) {
  const archives = await fetchArchives(username)
  if (!archives.length) return []
  const recent = archives.slice(-maxMonths).reverse() // newest month first
  const games = []
  for (let i = 0; i < recent.length; i++) {
    const monthGames = await fetchGamesForArchive(recent[i])
    games.push(...monthGames)
    onProgress?.(i + 1, recent.length, games.length)
    if (games.length >= maxGames) break
  }
  const standard = games.filter((g) => !g.rules || g.rules === 'chess')
  standard.sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
  return standard.slice(0, maxGames)
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

function countryToFlag(code) {
  if (!code || code.length !== 2) return null
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
}

const cardCache = new Map()

/**
 * Profile + current ratings for a player, for the profile cards.
 * Combines /player/{u} and /player/{u}/stats. Cached per username.
 */
export async function fetchPlayerCard(username) {
  const key = username.toLowerCase()
  if (cardCache.has(key)) return cardCache.get(key)
  const u = cleanUsername(username)
  const [profile, stats] = await Promise.all([
    fetch(`${BASE}/player/${u}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${BASE}/player/${u}/stats`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
  const countryCode = profile?.country ? profile.country.split('/').pop() : null
  const card = {
    username,
    name: profile?.name || null,
    title: profile?.title || null,
    avatar: profile?.avatar || null,
    flag: countryToFlag(countryCode),
    url: profile?.url || `https://www.chess.com/member/${username}`,
    ratings: {
      bullet: stats?.chess_bullet?.last?.rating ?? null,
      blitz: stats?.chess_blitz?.last?.rating ?? null,
      rapid: stats?.chess_rapid?.last?.rating ?? null,
    },
  }
  cardCache.set(key, card)
  return card
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
