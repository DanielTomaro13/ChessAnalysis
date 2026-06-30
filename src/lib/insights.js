// Compute a detailed analytics profile from a player's chess.com games.
// Everything here is derived from the game metadata + PGN movetext (no engine),
// so it's instant across hundreds of games. Chess.com already ships per-game
// `accuracies` and result codes that say *how* each game ended, which we lean on.

const DRAW_RESULTS = new Set([
  'agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient',
])

// Map a chess.com result code to a human "how it ended" bucket.
const REASON_LABEL = {
  win: 'won', checkmated: 'checkmate', resigned: 'resignation', timeout: 'on time',
  abandoned: 'abandonment', agreed: 'agreement', repetition: 'repetition',
  stalemate: 'stalemate', insufficient: 'insufficient material', '50move': '50-move rule',
  timevsinsufficient: 'timeout vs insufficient', lose: 'loss',
}

function outcomeOf(meResult) {
  if (meResult === 'win') return 'win'
  if (DRAW_RESULTS.has(meResult)) return 'draw'
  return 'loss'
}

// Strip headers + clock/eval comments and return the SAN move list in order.
function sanTokens(pgn) {
  if (!pgn) return []
  const blank = pgn.indexOf('\n\n')
  let mt = blank >= 0 ? pgn.slice(blank + 2) : pgn
  mt = mt.replace(/\{[^}]*\}/g, ' ') // clocks/comments
    .replace(/\$\d+/g, ' ') // NAGs
    .replace(/\d+\.(\.\.)?/g, ' ') // move numbers "12." / "12..."
  return mt.trim().split(/\s+/).filter(
    (t) => t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t),
  )
}

// "https://www.chess.com/openings/Italian-Game-Two-Knights...8.Re1" -> "Italian Game Two Knights"
function openingName(url) {
  if (!url) return null
  let seg = url.split('/').pop()
  seg = seg.split('...')[0] // drop appended move text
  seg = seg.replace(/-\d+\.\S*$/, '') // drop trailing "-3.Bb5" style chunks
  const name = seg.replace(/[-_]/g, ' ').trim()
  return name || null
}

// Coarse family = first two words ("Sicilian Defense", "Italian Game", "Kings Indian").
function openingFamily(name) {
  if (!name) return 'Unknown'
  return name.split(' ').slice(0, 2).join(' ')
}

const castleSide = (sans) => {
  for (const s of sans) {
    if (s.startsWith('O-O-O')) return 'queenside'
    if (s.startsWith('O-O')) return 'kingside'
  }
  return null
}

function pct(n, d) {
  return d ? Math.round((n / d) * 100) : 0
}

// Win% counting draws as half a point (a "score %"), which is the fairer
// single number for openings/colors.
function scorePct(rec) {
  const total = rec.w + rec.l + rec.d
  return total ? Math.round(((rec.w + rec.d / 2) / total) * 100) : 0
}

function emptyRec() {
  return { w: 0, l: 0, d: 0, games: 0 }
}
function tally(rec, outcome) {
  rec.games++
  rec[outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd']++
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function computeInsights(games, username) {
  const user = username.toLowerCase()
  const per = games
    .map((g) => {
      const white = (g.white?.username || '').toLowerCase() === user
      const me = white ? g.white : g.black
      const opp = white ? g.black : g.white
      if (!me || !opp) return null
      const outcome = outcomeOf(me.result)
      const sans = sanTokens(g.pgn)
      const name = openingName(g.eco)
      return {
        white,
        color: white ? 'white' : 'black',
        outcome,
        meResult: me.result,
        oppResult: opp.result,
        myRating: me.rating || null,
        oppRating: opp.rating || null,
        timeClass: g.time_class || 'other',
        endTime: g.end_time ? g.end_time * 1000 : null,
        accuracy: g.accuracies ? g.accuracies[white ? 'white' : 'black'] ?? null : null,
        opening: name,
        family: openingFamily(name),
        plies: sans.length,
        firstWhiteMove: sans[0] || null,
        myFirstMove: white ? sans[0] : sans[1] || null,
        castle: castleSide(white ? sans.filter((_, i) => i % 2 === 0) : sans.filter((_, i) => i % 2 === 1)),
        url: g.url,
        opponent: opp.username,
      }
    })
    .filter(Boolean)

  if (!per.length) return null

  const overall = emptyRec()
  const byColor = { white: emptyRec(), black: emptyRec() }
  const byTime = {}
  const families = {} // family -> { rec, white, black, accSum, accN }
  const whiteFirst = {} // White's 1st move -> rec (only my games as White)
  const vsE4 = emptyRec(), vsD4 = emptyRec() // my responses as Black
  const winReasons = {}, lossReasons = {}
  const byCastle = { kingside: emptyRec(), queenside: emptyRec(), none: emptyRec() }
  const byWeekday = Array.from({ length: 7 }, emptyRec)
  const byHour = Array.from({ length: 24 }, emptyRec)
  let pliesSum = 0, pliesN = 0
  let shortLosses = 0
  let accSum = 0, accN = 0
  const accByColor = { white: { s: 0, n: 0 }, black: { s: 0, n: 0 } }
  let vsHigher = emptyRec(), vsLower = emptyRec()
  let bestUpset = null, worstLoss = null

  for (const p of per) {
    tally(overall, p.outcome)
    tally(byColor[p.color], p.outcome)
    ;(byTime[p.timeClass] ||= emptyRec()), tally(byTime[p.timeClass], p.outcome)

    if (p.family && p.family !== 'Unknown') {
      const f = (families[p.family] ||= { rec: emptyRec(), white: emptyRec(), black: emptyRec(), accSum: 0, accN: 0, name: p.opening })
      tally(f.rec, p.outcome)
      tally(f[p.color], p.outcome)
      if (p.accuracy != null) { f.accSum += p.accuracy; f.accN++ }
    }

    if (p.color === 'white' && p.firstWhiteMove) {
      ;(whiteFirst[p.firstWhiteMove] ||= emptyRec()), tally(whiteFirst[p.firstWhiteMove], p.outcome)
    }
    if (p.color === 'black' && p.firstWhiteMove === 'e4') tally(vsE4, p.outcome)
    if (p.color === 'black' && p.firstWhiteMove === 'd4') tally(vsD4, p.outcome)

    if (p.outcome === 'win') {
      const r = REASON_LABEL[p.oppResult] || p.oppResult
      winReasons[r] = (winReasons[r] || 0) + 1
    } else if (p.outcome === 'loss') {
      const r = REASON_LABEL[p.meResult] || p.meResult
      lossReasons[r] = (lossReasons[r] || 0) + 1
    }

    tally(byCastle[p.castle || 'none'], p.outcome)

    if (p.plies) { pliesSum += p.plies; pliesN++; if (p.outcome === 'loss' && p.plies <= 40) shortLosses++ }
    if (p.accuracy != null) {
      accSum += p.accuracy; accN++
      accByColor[p.color].s += p.accuracy; accByColor[p.color].n++
    }

    if (p.myRating && p.oppRating) {
      if (p.oppRating >= p.myRating + 25) {
        tally(vsHigher, p.outcome)
        if (p.outcome === 'win' && (!bestUpset || p.oppRating > bestUpset.oppRating)) bestUpset = p
      } else if (p.oppRating <= p.myRating - 25) {
        tally(vsLower, p.outcome)
        if (p.outcome === 'loss' && (!worstLoss || p.oppRating < worstLoss.oppRating)) worstLoss = p
      }
    }

    if (p.endTime) {
      const d = new Date(p.endTime)
      tally(byWeekday[d.getDay()], p.outcome)
      tally(byHour[d.getHours()], p.outcome)
    }
  }

  // Ordered family list with score% + accuracy.
  const familyList = Object.entries(families)
    .map(([family, f]) => ({
      family,
      example: f.name,
      ...f.rec,
      score: scorePct(f.rec),
      whiteScore: scorePct(f.white),
      blackScore: scorePct(f.black),
      accuracy: f.accN ? Math.round((f.accSum / f.accN) * 10) / 10 : null,
    }))
    .sort((a, b) => b.games - a.games)

  const MIN = Math.max(4, Math.round(per.length * 0.03)) // min games to call an opening "best/worst"
  const ranked = familyList.filter((f) => f.games >= MIN)
  const bestOpening = ranked.length ? [...ranked].sort((a, b) => b.score - a.score)[0] : null
  const worstOpening = ranked.length ? [...ranked].sort((a, b) => a.score - b.score)[0] : null

  // Date range
  const times = per.map((p) => p.endTime).filter(Boolean)
  const range = times.length ? { from: Math.min(...times), to: Math.max(...times) } : null

  // Rating history (chronological, oldest -> newest) for a sparkline.
  const ratingHistory = [...per]
    .filter((p) => p.myRating && p.endTime)
    .sort((a, b) => a.endTime - b.endTime)
    .map((p) => p.myRating)

  // Streaks (chronological).
  const chron = [...per].filter((p) => p.endTime).sort((a, b) => a.endTime - b.endTime)
  let curW = 0, bestW = 0, curL = 0, bestL = 0
  for (const p of chron) {
    if (p.outcome === 'win') { curW++; bestW = Math.max(bestW, curW); curL = 0 }
    else if (p.outcome === 'loss') { curL++; bestL = Math.max(bestL, curL); curW = 0 }
    else { curW = 0; curL = 0 }
  }

  const bestWeekday = byWeekday
    .map((r, i) => ({ day: WEEKDAYS[i], ...r, score: scorePct(r) }))
    .filter((r) => r.games >= 3)
    .sort((a, b) => b.score - a.score)[0] || null

  const onTimeLosses = lossReasons['on time'] || 0
  const totalLosses = overall.l

  const result = {
    count: per.length,
    range,
    overall: { ...overall, winPct: pct(overall.w, overall.games), score: scorePct(overall) },
    byColor: {
      white: { ...byColor.white, score: scorePct(byColor.white) },
      black: { ...byColor.black, score: scorePct(byColor.black) },
    },
    byTime: Object.entries(byTime)
      .map(([k, r]) => ({ timeClass: k, ...r, score: scorePct(r) }))
      .sort((a, b) => b.games - a.games),
    familyList,
    bestOpening,
    worstOpening,
    whiteFirstMoves: Object.entries(whiteFirst)
      .map(([move, r]) => ({ move, ...r, score: scorePct(r) }))
      .sort((a, b) => b.games - a.games),
    vsE4: { ...vsE4, score: scorePct(vsE4) },
    vsD4: { ...vsD4, score: scorePct(vsD4) },
    winReasons: Object.entries(winReasons).map(([k, v]) => ({ reason: k, count: v })).sort((a, b) => b.count - a.count),
    lossReasons: Object.entries(lossReasons).map(([k, v]) => ({ reason: k, count: v })).sort((a, b) => b.count - a.count),
    castle: {
      kingside: { ...byCastle.kingside, score: scorePct(byCastle.kingside) },
      queenside: { ...byCastle.queenside, score: scorePct(byCastle.queenside) },
    },
    avgPlies: pliesN ? Math.round(pliesSum / pliesN) : null,
    avgMoves: pliesN ? Math.round(pliesSum / pliesN / 2) : null,
    shortLossPct: pct(shortLosses, overall.l),
    accuracy: accN ? Math.round((accSum / accN) * 10) / 10 : null,
    accuracyCoverage: pct(accN, per.length),
    accuracyByColor: {
      white: accByColor.white.n ? Math.round((accByColor.white.s / accByColor.white.n) * 10) / 10 : null,
      black: accByColor.black.n ? Math.round((accByColor.black.s / accByColor.black.n) * 10) / 10 : null,
    },
    vsHigher: { ...vsHigher, score: scorePct(vsHigher) },
    vsLower: { ...vsLower, score: scorePct(vsLower) },
    bestUpset,
    worstLoss,
    ratingHistory,
    streaks: { win: bestW, loss: bestL },
    weekdays: byWeekday.map((r, i) => ({ day: WEEKDAYS[i], ...r, score: scorePct(r) })),
    bestWeekday,
    onTimeLossPct: pct(onTimeLosses, totalLosses),
  }

  result.highlights = buildHighlights(result)
  return result
}

// Turn the numbers into plain-English strengths / weaknesses with sample-size guards.
function buildHighlights(r) {
  const strengths = []
  const weaknesses = []

  // Colour
  const w = r.byColor.white, b = r.byColor.black
  if (w.games >= 8 && b.games >= 8 && Math.abs(w.score - b.score) >= 6) {
    const strong = w.score > b.score ? 'White' : 'Black'
    const weak = w.score > b.score ? 'Black' : 'White'
    strengths.push(`Stronger with ${strong} (${Math.max(w.score, b.score)}% vs ${Math.min(w.score, b.score)}% as ${weak}).`)
    weaknesses.push(`Weaker with ${weak} — only ${Math.min(w.score, b.score)}% there. Shore up your ${weak} openings.`)
  }

  // Best / worst opening
  if (r.bestOpening) strengths.push(`Your best opening: ${r.bestOpening.family} — ${r.bestOpening.score}% over ${r.bestOpening.games} games.`)
  if (r.worstOpening && (!r.bestOpening || r.worstOpening.family !== r.bestOpening.family) && r.worstOpening.score <= 45)
    weaknesses.push(`Struggles in the ${r.worstOpening.family} — ${r.worstOpening.score}% over ${r.worstOpening.games} games.`)

  // Time control
  const times = r.byTime.filter((t) => t.games >= 8)
  if (times.length >= 2) {
    const bestT = [...times].sort((a, b) => b.score - a.score)[0]
    const worstT = [...times].sort((a, b) => a.score - b.score)[0]
    if (bestT.score - worstT.score >= 8) {
      strengths.push(`Best in ${bestT.timeClass} (${bestT.score}%).`)
      weaknesses.push(`Weakest in ${worstT.timeClass} (${worstT.score}%).`)
    }
  }

  // Upsets / giving away points
  if (r.vsHigher.games >= 8 && r.vsHigher.score >= 45) strengths.push(`Punches up — ${r.vsHigher.score}% against higher-rated opponents.`)
  if (r.vsLower.games >= 8 && r.vsLower.score <= 60) weaknesses.push(`Drops points to lower-rated players (${r.vsLower.score}% when favoured).`)

  // Clock
  if (r.overall.l >= 10 && r.onTimeLossPct >= 25) weaknesses.push(`${r.onTimeLossPct}% of losses are on time — clock management is costing you games.`)
  else if (r.overall.l >= 10 && r.onTimeLossPct <= 10) strengths.push(`Rarely loses on time (${r.onTimeLossPct}% of losses).`)

  // Opening prep / short losses
  if (r.overall.l >= 10 && r.shortLossPct >= 25) weaknesses.push(`${r.shortLossPct}% of losses come inside 20 moves — tighten your opening prep.`)

  // Decisiveness
  const drawPct = pct(r.overall.d, r.overall.games)
  if (drawPct >= 25) weaknesses.push(`High draw rate (${drawPct}%) — look for ways to play for a win.`)

  // Accuracy
  if (r.accuracy != null && r.accuracyCoverage >= 30) {
    if (r.accuracy >= 80) strengths.push(`High average accuracy (${r.accuracy}%) across reviewed games.`)
    else if (r.accuracy <= 65) weaknesses.push(`Average accuracy is ${r.accuracy}% — fewer blunders would lift your rating fast.`)
  }

  // Streaks / form
  if (r.streaks.win >= 5) strengths.push(`Capable of long runs — best streak ${r.streaks.win} wins.`)

  if (!strengths.length) strengths.push('Play a few more games to surface clear strengths.')
  if (!weaknesses.length) weaknesses.push('No glaring weaknesses — nicely balanced results.')
  return { strengths, weaknesses }
}
