import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { playSound, moveSoundKind } from '../lib/sound'

const DOT = 'radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 24%)'
const RING = 'radial-gradient(circle, transparent 54%, rgba(197,82,74,0.55) 56%, transparent 70%)'
const SELECTED = 'rgba(240, 200, 60, 0.45)'

/**
 * Interactive puzzle board: drag OR click-to-move (click a piece to see its
 * legal moves, click a target to play). Plays the solution line, auto-replies
 * for the opponent, and plays sounds. Exposes hint()/reveal() via ref.
 */
const SolveBoard = forwardRef(function SolveBoard(
  { fen, solution, autoFirst, orientation, onSolved, onWrong },
  ref,
) {
  const gameRef = useRef(null)
  const cleanRef = useRef(true)
  const timerRef = useRef(null)
  const [position, setPosition] = useState(fen)
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState('solving') // 'solving' | 'solved'
  const [selected, setSelected] = useState(null)
  const [targets, setTargets] = useState([])
  const [hint, setHint] = useState(null)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    const g = new Chess(fen)
    gameRef.current = g
    cleanRef.current = true
    setStatus('solving')
    setSelected(null)
    setTargets([])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, solution, autoFirst])

  function apply(uci) {
    const g = gameRef.current
    const move = { from: uci.slice(0, 2), to: uci.slice(2, 4) }
    if (uci.length > 4) move.promotion = uci[4]
    const result = g.move(move)
    setPosition(g.fen())
    playSound(moveSoundKind(result))
    return result
  }

  function completePlayer(uci, curStep) {
    apply(uci)
    setSelected(null)
    setTargets([])
    setHint(null)
    const oppIdx = curStep + 1
    if (oppIdx >= solution.length) {
      setStatus('solved')
      setStep(oppIdx)
      playSound('solve')
      onSolved?.(cleanRef.current)
      return
    }
    timerRef.current = setTimeout(() => {
      apply(solution[oppIdx])
      setStep(oppIdx + 1)
    }, 350)
    setStep(oppIdx)
  }

  // Attempt the player's move; true if it matched the solution.
  function tryMove(from, to, pieceCode) {
    if (status !== 'solving') return false
    const g = gameRef.current
    const legal = g.moves({ verbose: true }).some((m) => m.from === from && m.to === to)
    if (!legal) return false
    const expected = solution[step]
    let uci = from + to
    const isPromo = pieceCode && pieceCode[1]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1')
    if (isPromo) uci += expected && expected.length > 4 ? expected[4] : 'q'
    if (uci !== expected) {
      cleanRef.current = false
      setFlash({ [to]: { background: 'rgba(197,82,74,0.55)' } })
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setFlash(null), 350)
      playSound('fail')
      onWrong?.()
      return false
    }
    completePlayer(uci, step)
    return true
  }

  function onDrop(from, to, piece) {
    setSelected(null)
    setTargets([])
    return tryMove(from, to, piece)
  }

  function selectSquare(square) {
    const g = gameRef.current
    const piece = g.get(square)
    if (piece && piece.color === g.turn()) {
      setSelected(square)
      setTargets(g.moves({ square, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })))
    } else {
      setSelected(null)
      setTargets([])
    }
  }

  function onSquareClick(square) {
    if (status !== 'solving') return
    const g = gameRef.current
    if (!selected) {
      selectSquare(square)
      return
    }
    if (square === selected) {
      setSelected(null)
      setTargets([])
      return
    }
    const pieceCode = (() => {
      const p = g.get(selected)
      return p ? p.color + p.type.toUpperCase() : null
    })()
    if (targets.some((t) => t.to === square)) {
      tryMove(selected, square, pieceCode)
      setSelected(null)
      setTargets([])
    } else {
      selectSquare(square) // reselect or clear
    }
  }

  useImperativeHandle(ref, () => ({
    hint() {
      if (status !== 'solving') return
      cleanRef.current = false
      setHint(solution[step]?.slice(0, 2))
    },
    reveal() {
      if (status !== 'solving') return
      cleanRef.current = false
      clearTimeout(timerRef.current)
      let s = step
      const playNext = () => {
        if (s >= solution.length) {
          setStatus('solved')
          playSound('solve')
          onSolved?.(false)
          return
        }
        apply(solution[s])
        s += 1
        setStep(s)
        timerRef.current = setTimeout(playNext, 450)
      }
      playNext()
    },
  }))

  const squareStyles = {}
  for (const t of targets) squareStyles[t.to] = { background: t.capture ? RING : DOT }
  if (selected) squareStyles[selected] = { background: SELECTED }
  if (hint) squareStyles[hint] = { background: SELECTED }
  Object.assign(squareStyles, flash || {})

  return (
    <div className="solveboard">
      <div className="solveboard__board">
        <Chessboard
          position={position}
          boardOrientation={orientation}
          arePiecesDraggable={status === 'solving'}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={squareStyles}
          customDarkSquareStyle={{ backgroundColor: '#6f8d57' }}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
        />
      </div>
    </div>
  )
})

export default SolveBoard
