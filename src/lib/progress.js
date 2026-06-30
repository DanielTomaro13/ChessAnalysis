import { lsSet } from './storage'
// Game-like progression: XP, levels, combo, a daily goal, theme stats, and
// achievements. All client-side in localStorage.

const K = {
  xp: 'chessanalysis:xp',
  combo: 'chessanalysis:combo',
  total: 'chessanalysis:totalSolves',
  daily: 'chessanalysis:daily',
  themes: 'chessanalysis:themeStats',
  achievements: 'chessanalysis:achievements',
}

const DAILY_GOAL = 10

const num = (k) => Number(localStorage.getItem(k)) || 0
const today = () => new Date().toISOString().slice(0, 10)

// Level curve: level n starts at 50*(n-1)^2 XP (so 1->0, 2->50, 3->200, ...).
export function levelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1
}
export function xpForLevel(level) {
  return 50 * (level - 1) ** 2
}

export const ACHIEVEMENTS = [
  { id: 'first', label: 'First Blood', icon: '🩸', test: (s) => s.total >= 1 },
  { id: 'streak5', label: 'On Fire', icon: '🔥', test: (s) => s.combo >= 5 },
  { id: 'streak10', label: 'Unstoppable', icon: '⚡', test: (s) => s.combo >= 10 },
  { id: 'level5', label: 'Rising Star', icon: '⭐', test: (s) => s.level >= 5 },
  { id: 'level10', label: 'Tactician', icon: '🎯', test: (s) => s.level >= 10 },
  { id: 'daily', label: 'Daily Goal', icon: '✅', test: (s) => s.daily.count >= s.daily.goal },
  { id: 'fifty', label: 'Half Ton', icon: '🏅', test: (s) => s.total >= 50 },
  { id: 'century', label: 'Centurion', icon: '🏆', test: (s) => s.total >= 100 },
]

function getDaily() {
  let d
  try {
    d = JSON.parse(localStorage.getItem(K.daily) || 'null')
  } catch {
    d = null
  }
  if (!d || d.date !== today()) d = { date: today(), count: 0, goal: DAILY_GOAL }
  return d
}

function getAchievements() {
  try {
    return new Set(JSON.parse(localStorage.getItem(K.achievements) || '[]'))
  } catch {
    return new Set()
  }
}

function getThemeStats() {
  try {
    return JSON.parse(localStorage.getItem(K.themes) || '{}')
  } catch {
    return {}
  }
}

export function getProgress() {
  const xp = num(K.xp)
  const level = levelFromXp(xp)
  return {
    xp,
    level,
    xpIntoLevel: xp - xpForLevel(level),
    xpToNext: xpForLevel(level + 1) - xpForLevel(level),
    combo: num(K.combo),
    total: num(K.total),
    daily: getDaily(),
    achievements: getAchievements(),
    themeStats: getThemeStats(),
  }
}

/**
 * Record a solved (or revealed) puzzle. Updates XP, combo, daily goal, theme
 * stats and achievements. Returns a summary for UI feedback.
 */
export function recordSolve({ clean, rating = 1200, themes = '' }) {
  // combo
  const combo = clean ? num(K.combo) + 1 : 0
  lsSet(K.combo, String(combo))

  // total
  const total = num(K.total) + 1
  lsSet(K.total, String(total))

  // xp (difficulty + combo bonus)
  const base = clean ? 10 : 3
  const diffBonus = clean ? Math.round(rating / 120) : 0
  const comboMult = 1 + Math.min(combo, 6) * 0.15
  const xpGained = Math.max(1, Math.round((base + diffBonus) * comboMult))
  const beforeLevel = levelFromXp(num(K.xp))
  const xp = num(K.xp) + xpGained
  lsSet(K.xp, String(xp))
  const level = levelFromXp(xp)

  // daily
  const daily = getDaily()
  daily.count += 1
  lsSet(K.daily, JSON.stringify(daily))

  // theme stats
  const stats = getThemeStats()
  for (const t of themes.split(/\s+/).filter(Boolean)) {
    const s = stats[t] || { seen: 0, solved: 0 }
    s.seen += 1
    if (clean) s.solved += 1
    stats[t] = s
  }
  lsSet(K.themes, JSON.stringify(stats))

  // achievements
  const have = getAchievements()
  const state = { total, combo, level, daily }
  const unlocked = []
  for (const a of ACHIEVEMENTS) {
    if (!have.has(a.id) && a.test(state)) {
      have.add(a.id)
      unlocked.push(a)
    }
  }
  lsSet(K.achievements, JSON.stringify([...have]))

  return {
    xpGained,
    combo,
    comboMult,
    leveledUp: level > beforeLevel,
    level,
    daily,
    unlocked,
  }
}
