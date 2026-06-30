import { lsSet } from './storage'
// A small saved-games library in localStorage. Stores enough of each game to
// reopen it (the whole game object, plus the username it was viewed under).

const KEY = 'chessanalysis:library'
const MAX = 100

export function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function isSaved(url) {
  return getSaved().some((e) => e.game.url === url)
}

export function saveGame(game, username) {
  if (!game?.url) return getSaved()
  const list = getSaved().filter((e) => e.game.url !== game.url)
  list.unshift({ game, username: username || '', savedAt: Date.now() })
  const trimmed = list.slice(0, MAX)
  lsSet(KEY, JSON.stringify(trimmed))
  return trimmed
}

export function removeSaved(url) {
  const list = getSaved().filter((e) => e.game.url !== url)
  lsSet(KEY, JSON.stringify(list))
  return list
}

export function toggleSaved(game, username) {
  return isSaved(game.url) ? (removeSaved(game.url), false) : (saveGame(game, username), true)
}
