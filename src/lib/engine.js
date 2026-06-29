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
    // `readyok`. So we skip setoption entirely and just sync with isready.
    this.send('isready')
    await this.waitFor((l) => (l.startsWith('readyok') ? true : false))
  }

  /**
   * Analyze a position to a fixed depth.
   * Score is returned from the side-to-move's perspective (UCI convention).
   * @returns {Promise<{scoreCp:number|null, mate:number|null, bestMove:string|null, pv:string[]}>}
   */
  async analyze(fen, depth = 14) {
    let last = null
    const collect = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const info = parseInfo(line)
        if (info) last = info
      }
    }
    this.listeners.push(collect)
    this.send('position fen ' + fen)
    this.send('go depth ' + depth)
    const bestMove = await this.waitFor((l) =>
      l.startsWith('bestmove') ? l.split(/\s+/)[1] : false,
    )
    this.listeners = this.listeners.filter((l) => l !== collect)
    return {
      scoreCp: last?.mate == null ? (last?.cp ?? 0) : null,
      mate: last?.mate ?? null,
      bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
      pv: last?.pv ?? [],
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
