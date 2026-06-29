// Lazy-loaded opening book (generated from the Lichess open openings dataset).
// A position is "theory" if its key is in the set.

let cache = null

export const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ')

export async function loadOpenings() {
  if (cache) return cache
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'openings.json')
    cache = new Set(await res.json())
  } catch {
    cache = new Set() // book is optional; degrade gracefully
  }
  return cache
}
