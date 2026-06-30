// Tiny Web Audio sound kit — synthesized so there are no binary assets to ship
// and it works offline. Sounds fire after user gestures (clicks/drags), so the
// AudioContext is allowed to start.

let ctx = null
let muted = localStorage.getItem('chessanalysis:muted') === '1'

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function isMuted() {
  return muted
}
export function setMuted(m) {
  muted = m
  localStorage.setItem('chessanalysis:muted', m ? '1' : '0')
}
export function toggleMuted() {
  setMuted(!muted)
  return muted
}

function tone({ freq, dur = 0.08, type = 'sine', gain = 0.15, slideTo = null, delay = 0 }) {
  const c = audio()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export function playSound(kind) {
  if (muted) return
  try {
    switch (kind) {
      case 'move':
        tone({ freq: 330, dur: 0.06, type: 'triangle', gain: 0.16 })
        break
      case 'capture':
        tone({ freq: 220, dur: 0.10, type: 'square', gain: 0.14 })
        tone({ freq: 150, dur: 0.10, type: 'square', gain: 0.10, delay: 0.012 })
        break
      case 'check':
        tone({ freq: 740, dur: 0.10, type: 'sine', gain: 0.16 })
        tone({ freq: 990, dur: 0.10, type: 'sine', gain: 0.10, delay: 0.06 })
        break
      case 'solve':
        tone({ freq: 523, dur: 0.11, gain: 0.18 })
        tone({ freq: 784, dur: 0.16, gain: 0.18, delay: 0.10 })
        break
      case 'fail':
        tone({ freq: 300, dur: 0.20, type: 'sawtooth', gain: 0.14, slideTo: 130 })
        break
      case 'level':
        tone({ freq: 523, dur: 0.10, gain: 0.18 })
        tone({ freq: 659, dur: 0.10, gain: 0.18, delay: 0.10 })
        tone({ freq: 880, dur: 0.22, gain: 0.18, delay: 0.20 })
        break
      default:
        break
    }
  } catch {
    /* audio not available — ignore */
  }
}

// Pick the sound for a chess.js move result.
export function moveSoundKind(move) {
  if (!move) return 'move'
  if (/[+#]/.test(move.san)) return 'check'
  if (move.captured) return 'capture'
  return 'move'
}
