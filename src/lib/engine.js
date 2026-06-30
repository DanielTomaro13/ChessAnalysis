// Wraps the Stockfish Web Worker and speaks UCI.
// Single-threaded build (stockfish.js v10) so it runs on GitHub Pages without
// the COOP/COEP headers that SharedArrayBuffer / threaded WASM would require.

const ENGINE_URL = import.meta.env.BASE_URL + 'engine/stockfish.js'

function parseInfo(line) {
  // Ignore aspiration-window fail-high/low scores; they aren't final.
  if (/\b(lowerbound|upperbound)\b/.test(line)) return null
  const tokens = line.split(/\s+/)
  let cp = null
  let mate = null
  let pv = []
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'depth') depth = parseInt(tokens[i + 1], 10) || 0
    else if (tokens[i] === 'score') {
      if (tokens[i + 1] === 'cp') cp = parseInt(tokens[i + 2], 10)
      else if (tokens[i + 1] === 'mate') mate = parseInt(tokens[i + 2], 10)
    } else if (tokens[i] === 'pv') {
      pv = tokens.slice(i + 1)
      break
    }
  }
  if (cp === null && mate === null) return null
  return { cp, mate, pv, depth }
}

export class Engine {
  constructor() {
    this.worker = new Worker(ENGINE_URL)
    this.listeners = []
    this.pending = new Set() // active waitFor rejecters, so quit() can unblock them
    this.dead = false
    this.chain = Promise.resolve() // serializes analyze() calls on the one worker
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data ?? ''
      for (const fn of this.listeners) fn(line)
    }
  }

  send(cmd) {
    this.worker.postMessage(cmd)
  }

  waitFor(predicate, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (this.dead) {
        reject(new Error('Engine stopped'))
        return
      }
      const settle = () => {
        clearTimeout(timer)
        this.listeners = this.listeners.filter((l) => l !== fn)
        this.pending.delete(rejecter)
      }
      const timer = setTimeout(() => {
        settle()
        reject(new Error('Engine timed out'))
      }, timeout)
      const fn = (line) => {
        const result = predicate(line)
        if (result !== undefined && result !== false) {
          settle()
          resolve(result)
        }
      }
      const rejecter = (err) => {
        settle()
        reject(err)
      }
      this.pending.add(rejecter)
      this.listeners.push(fn)
    })
  }

  async init(multiPV = 2) {
    this.send('uci')
    await this.waitFor((l) => (l.startsWith('uciok') ? true : false))
    // NOTE: this Stockfish.js v10 build is hardwired to 1 thread / 16MB hash
    // (Threads + Hash report min==max), and sending a `setoption` for them
    // makes the engine swallow the following `isready` and never reply
    // `readyok`. So sync with isready FIRST, then set MultiPV and never
    // isready again (verified safe with this build).
    this.send('isready')
    await this.waitFor((l) => (l.startsWith('readyok') ? true : false))
    this.send('setoption name MultiPV value ' + multiPV)
  }

  /**
   * Analyze a position to a fixed depth with MultiPV. Calls are serialized on
   * the single worker (a new search waits for the previous bestmove) so the UCI
   * streams never interleave. Scores are from the side-to-move's perspective.
   */
  analyze(fen, depth = 14) {
    const run = () => this._analyze(fen, depth)
    this.chain = this.chain.then(run, run)
    return this.chain
  }

  async _analyze(fen, depth) {
    if (this.dead) throw new Error('Engine stopped')
    const byMpv = {} // multipv index -> deepest info seen
    const collect = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const m = line.match(/ multipv (\d+)/)
        const idx = m ? parseInt(m[1], 10) : 1
        const info = parseInfo(line)
        if (info && info.depth >= (byMpv[idx]?.depth ?? -1)) byMpv[idx] = info
      }
    }
    this.listeners.push(collect)
    try {
      this.send('position fen ' + fen)
      this.send('go depth ' + depth)
      const bestMove = await this.waitFor((l) =>
        l.startsWith('bestmove') ? l.split(/\s+/)[1] : false,
      )
      const l1 = byMpv[1]
      const l2 = byMpv[2]
      const lines = Object.keys(byMpv)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => ({ scoreCp: byMpv[i].mate == null ? byMpv[i].cp : null, mate: byMpv[i].mate ?? null, pv: byMpv[i].pv }))
      return {
        scoreCp: l1?.mate == null ? (l1?.cp ?? 0) : null,
        mate: l1?.mate ?? null,
        secondScoreCp: l2 ? (l2.mate == null ? l2.cp : null) : null,
        secondMate: l2 ? (l2.mate ?? null) : null,
        hasSecond: !!l2,
        bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
        pv: l1?.pv ?? [],
        lines,
      }
    } finally {
      this.listeners = this.listeners.filter((l) => l !== collect)
    }
  }

  quit() {
    this.dead = true
    // Unblock anything awaiting a reply so callers don't hang on the dead worker.
    for (const reject of [...this.pending]) reject(new Error('Engine stopped'))
    this.pending.clear()
    try {
      this.send('quit')
    } catch {
      /* ignore */
    }
    this.worker.terminate()
  }
}
