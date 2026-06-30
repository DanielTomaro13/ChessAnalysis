import { lsSet } from './storage'
// Lightweight settings store (localStorage) with a subscribe hook.
import { useEffect, useState } from 'react'

const KEY = 'chessanalysis:settings'

export const BOARD_THEMES = {
  green: { label: 'Green', light: '#eeeed2', dark: '#6f8d57' },
  brown: { label: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  blue: { label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  gray: { label: 'Gray', light: '#dcdcdc', dark: '#8f8f8f' },
}

const DEFAULTS = { boardTheme: 'green', depth: 13 }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

let current = load()
const listeners = new Set()

export function getSettings() {
  return current
}
export function setSettings(patch) {
  current = { ...current, ...patch }
  lsSet(KEY, JSON.stringify(current))
  listeners.forEach((l) => l(current))
}
export function boardColors(theme = current.boardTheme) {
  return BOARD_THEMES[theme] || BOARD_THEMES.green
}

export function useSettings() {
  const [s, setS] = useState(current)
  useEffect(() => {
    const fn = (next) => setS(next)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return s
}
