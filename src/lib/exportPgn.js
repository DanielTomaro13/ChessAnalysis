// Build a PGN annotated with the engine's evals and move classifications
// (NAGs + [%eval] comments) so the review can be exported / opened elsewhere.

const NAG = {
  brilliant: '$3',
  great: '$1',
  inaccuracy: '$6',
  mistake: '$2',
  miss: '$2',
  blunder: '$4',
}

const HEADER_ORDER = [
  'Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result',
  'WhiteElo', 'BlackElo', 'TimeControl', 'ECO',
]

function evalComment(e) {
  if (!e) return ''
  if (e.mate != null) return ` {[%eval #${e.mate}]}`
  return ` {[%eval ${(e.whiteCp / 100).toFixed(2)}]}`
}

export function buildAnnotatedPgn(parsed, analysis) {
  const h = parsed.headers
  let pgn = ''
  for (const k of HEADER_ORDER) if (h[k]) pgn += `[${k} "${h[k]}"]\n`
  pgn += '\n'

  const parts = []
  for (let i = 0; i < parsed.sans.length; i++) {
    const num = Math.floor(i / 2) + 1
    const prefix = i % 2 === 0 ? `${num}.` : `${num}...`
    const nag = analysis?.annotations[i] ? NAG[analysis.annotations[i].class] || '' : ''
    parts.push(`${prefix} ${parsed.sans[i]}${nag ? ` ${nag}` : ''}${evalComment(analysis?.evals[i + 1])}`)
  }
  pgn += parts.join(' ') + ' ' + (h.Result || '*') + '\n'
  return pgn
}

export function downloadPgn(parsed, analysis) {
  const text = buildAnnotatedPgn(parsed, analysis)
  const h = parsed.headers
  const name = `${(h.White || 'white').replace(/\W+/g, '')}-vs-${(h.Black || 'black').replace(/\W+/g, '')}.pgn`
  const blob = new Blob([text], { type: 'application/x-chess-pgn' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
