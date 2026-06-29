// Wraps the Stockfish Web Worker and speaks UCI.
// Single-threaded build (stockfish.js v10) so it runs on GitHub Pages without
// the COOP/COEP headers that SharedArrayBuffer / threaded WASM would require.

const ENGINE_URL = import.meta.env.BASE_URL + 'engine/stockfish.js'

function parseInfo(line) {
  const tokens = line.split(/\s+/)
  let cp = null
  let mate = null
  let pv = []
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'score') {
      if (tokens[i + 1] === 'cp') cp = parseInt(tokens[i + 2], 10)
      else if (tokens[i + 1] === 'mate') mate = parseInt(tokens[i + 2], 10)
    } else if (tokens[i] === 'pv') {
      pv = tokens.slice(i + 1)
      break
    }
  }
  if (cp === null && mate === null) return null
  return { cp, mate, pv }
}

export class Engine {
  constructor() {
    this.worker = new Worker(ENGINE_URL)
    this.listeners = []
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
      const remove = () => {
        this.listeners = this.listeners.filter((l) => l !== fn)
      }
      const timer = setTimeout(() => {
        remove()
        reject(new Error('Engine timed out'))
      }, timeout)
      const fn = (line) => {
        const result = predicate(line)
        if (result !== undefined && result !== false) {
          clearTimeout(timer)
          remove()
          resolve(result)
        }
      }
      this.listeners.push(fn)
    })
  }

  async init() {
    this.send('uci')
    await this.waitFor((l) => (l.startsWith('uciok') ? true : false))
    // NOTE: this Stockfish.js v10 build is hardwired to 1 thread / 16MB hash
    // (Threads + Hash report min==max), and sending a `setoption` for them
    // makes the engine swallow the following `isready` and never reply
    // `readyok`. So sync with isready FIRST, then set MultiPV and never
    // isready again (verified safe with this build).
    this.send('isready')
    await this.waitFor((l) => (l.startsWith('readyok') ? true : false))
    this.send('setoption name MultiPV value 2')
  }

  /**
   * Analyze a position to a fixed depth with MultiPV 2.
   * Scores are from the side-to-move's perspective (UCI convention).
   * Returns the best line plus the second-best line (for "only move" detection).
   */
  async analyze(fen, depth = 14) {
    const byMpv = {} // multipv index -> latest info at greatest depth
    const collect = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const m = line.match(/ multipv (\d+)/)
        const idx = m ? parseInt(m[1], 10) : 1
        const info = parseInfo(line)
        if (info) byMpv[idx] = info
      }
    }
    this.listeners.push(collect)
    this.send('position fen ' + fen)
    this.send('go depth ' + depth)
    const bestMove = await this.waitFor((l) =>
      l.startsWith('bestmove') ? l.split(/\s+/)[1] : false,
    )
    this.listeners = this.listeners.filter((l) => l !== collect)

    const l1 = byMpv[1]
    const l2 = byMpv[2]
    return {
      scoreCp: l1?.mate == null ? (l1?.cp ?? 0) : null,
      mate: l1?.mate ?? null,
      secondScoreCp: l2 ? (l2.mate == null ? l2.cp : null) : null,
      secondMate: l2 ? (l2.mate ?? null) : null,
      hasSecond: !!l2,
      bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
      pv: l1?.pv ?? [],
    }
  }

  quit() {
    try {
      this.send('quit')
    } catch {
      /* ignore */
    }
    this.worker.terminate()
  }
}
