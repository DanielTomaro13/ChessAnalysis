import { useEffect, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'

/**
 * Interactive puzzle board. The player drags pieces to play the solution line.
 *
 * @param fen        starting position
 * @param solution   array of UCI moves (the full line)
 * @param autoFirst  if true, solution[0] is the opponent's setup move (auto-played)
 * @param orientation 'white' | 'black'
 * @param onSolved(clean)  called when the line is completed; clean=false if hinted/wrong
 * @param onWrong()  called on a wrong (but legal) attempt
 */
export default function SolveBoard({ fen, solution, autoFirst, orientation, onSolved, onWrong }) {
  const gameRef = useRef(null)
  const cleanRef = useRef(true)
  const timerRef = useRef(null)
  const [position, setPosition] = useState(fen)
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState('solving') // 'solving' | 'solved'
  const [hint, setHint] = useState(null)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    const g = new Chess(fen)
    gameRef.current = g
    cleanRef.current = true
    setStatus('solving')
    setHint(null)
    setFlash(null)
    setPosition(fen)
    if (autoFirst && solution.length) {
      setStep(0)
      timerRef.current = setTimeout(() => {
        apply(solution[0])
        setStep(1)
      }, 450)
    } else {
      setStep(0)
    }
    return () => clearTimeout(timerRef.current)
  }, [fen, solution, autoFirst])

  function apply(uci) {
    const g = gameRef.current
    const move = { from: uci.slice(0, 2), to: uci.slice(2, 4) }
    if (uci.length > 4) move.promotion = uci[4]
    g.move(move)
    setPosition(g.fen())
  }

  function completePlayer(uci, curStep) {
    apply(uci)
    setHint(null)
    const oppIdx = curStep + 1
    if (oppIdx >= solution.length) {
      setStatus('solved')
      setStep(oppIdx)
      onSolved?.(cleanRef.current)
      return
    }
    timerRef.current = setTimeout(() => {
      apply(solution[oppIdx])
      setStep(oppIdx + 1)
    }, 350)
    setStep(oppIdx)
  }

  function onDrop(from, to, piece) {
    if (status !== 'solving') return false
    const g = gameRef.current
    const legal = g.moves({ verbose: true }).some((m) => m.from === from && m.to === to)
    if (!legal) return false
    const expected = solution[step]
    let uci = from + to
    const promo = piece && piece[1]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1')
    if (promo) uci += expected && expected.length > 4 ? expected[4] : 'q'
    if (uci !== expected) {
      cleanRef.current = false
      setFlash({ [to]: { background: 'rgba(197,82,74,0.55)' } })
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setFlash(null), 350)
      onWrong?.()
      return false
    }
    completePlayer(uci, step)
    return true
  }

  function showHint() {
    if (status !== 'solving') return
    cleanRef.current = false
    setHint(solution[step]?.slice(0, 2))
  }

  function revealSolution() {
    if (status !== 'solving') return
    cleanRef.current = false
    clearTimeout(timerRef.current)
    let s = step
    const playNext = () => {
      if (s >= solution.length) {
        setStatus('solved')
        onSolved?.(false)
        return
      }
      apply(solution[s])
      s += 1
      setStep(s)
      timerRef.current = setTimeout(playNext, 450)
    }
    playNext()
  }

  const squareStyles = {
    ...(flash || {}),
    ...(hint ? { [hint]: { background: 'rgba(240, 200, 60, 0.55)' } } : {}),
  }

  return (
    <div className="solveboard">
      <div className="solveboard__board">
        <Chessboard
          position={position}
          boardOrientation={orientation}
          arePiecesDraggable={status === 'solving'}
          onPieceDrop={onDrop}
          customSquareStyles={squareStyles}
          customDarkSquareStyle={{ backgroundColor: '#6f8d57' }}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
        />
      </div>
      {status === 'solving' && (
        <div className="solveboard__tools">
          <button onClick={showHint}>💡 Hint</button>
          <button onClick={revealSolution}>Show solution</button>
        </div>
      )}
    </div>
  )
}
