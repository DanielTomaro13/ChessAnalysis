// Puzzle data + progress, all client-side.
// Lichess puzzle set is bundled in public/puzzles.json; "my mistakes" puzzles
// are harvested from analyzed games and kept in localStorage.

const LS = {
  rating: 'chessanalysis:puzzleRating',
  solved: 'chessanalysis:puzzlesSolved',
  history: 'chessanalysis:ratingHistory',
  mistakes: (u) => `chessanalysis:mistakes:${u.toLowerCase()}`,
}

let cache = null
export async function loadPuzzles() {
  if (cache) return cache
  const res = await fetch(import.meta.env.BASE_URL + 'puzzles.json')
  cache = await res.json()
  return cache
}

/**
 * Pick a random puzzle near `rating`, optionally filtered to a tactic theme,
 * widening the rating window until one is found.
 */
export function pickPuzzle(puzzles, rating, excludeIds = new Set(), theme = null) {
  const matchesTheme = (p) => !theme || theme === 'all' || p.themes.split(' ').includes(theme)
  for (const window of [150, 300, 500, 9999]) {
    const pool = puzzles.filter(
      (p) => matchesTheme(p) && Math.abs(p.rating - rating) <= window && !excludeIds.has(p.id),
    )
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)]
  }
  const any = puzzles.filter(matchesTheme)
  return any.length ? any[Math.floor(Math.random() * any.length)] : null
}

// Popular tactic themes offered in the trainer filter.
export const THEMES = [
  { key: 'all', label: 'All tactics' },
  { key: 'mate', label: 'Checkmate' },
  { key: 'mateIn1', label: 'Mate in 1' },
  { key: 'mateIn2', label: 'Mate in 2' },
  { key: 'fork', label: 'Fork' },
  { key: 'pin', label: 'Pin' },
  { key: 'skewer', label: 'Skewer' },
  { key: 'sacrifice', label: 'Sacrifice' },
  { key: 'discoveredAttack', label: 'Discovered attack' },
  { key: 'hangingPiece', label: 'Hanging piece' },
  { key: 'deflection', label: 'Deflection' },
  { key: 'backRankMate', label: 'Back-rank mate' },
  { key: 'endgame', label: 'Endgame' },
  { key: 'promotion', label: 'Promotion' },
]

// ---- player puzzle rating (Elo-style) ----
export function getPuzzleRating() {
  return Number(localStorage.getItem(LS.rating)) || 1200
}
export function getSolvedCount() {
  return Number(localStorage.getItem(LS.solved)) || 0
}
export function recordResult(puzzleRating, solvedClean) {
  const user = getPuzzleRating()
  const expected = 1 / (1 + 10 ** ((puzzleRating - user) / 400))
  const next = Math.max(400, Math.min(2900, Math.round(user + 32 * ((solvedClean ? 1 : 0) - expected))))
  localStorage.setItem(LS.rating, String(next))
  if (solvedClean) localStorage.setItem(LS.solved, String(getSolvedCount() + 1))
  const hist = getRatingHistory()
  hist.push(next)
  localStorage.setItem(LS.history, JSON.stringify(hist.slice(-120)))
  return next
}

export function getRatingHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS.history) || '[]')
  } catch {
    return []
  }
}

// ---- "my mistakes" store ----
export function getMistakes(username) {
  if (!username) return []
  try {
    return JSON.parse(localStorage.getItem(LS.mistakes(username)) || '[]')
  } catch {
    return []
  }
}

/** Merge newly-found mistakes (dedup by fen), keep the most recent 300. */
export function addMistakes(username, list) {
  if (!username || !list.length) return
  const existing = getMistakes(username)
  const seen = new Set(existing.map((m) => m.fen))
  const merged = [...list.filter((m) => !seen.has(m.fen)), ...existing].slice(0, 300)
  localStorage.setItem(LS.mistakes(username), JSON.stringify(merged))
}

export function removeMistake(username, fen) {
  const next = getMistakes(username).filter((m) => m.fen !== fen)
  localStorage.setItem(LS.mistakes(username), JSON.stringify(next))
}
