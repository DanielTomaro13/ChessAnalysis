import { useEffect, useMemo, useRef, useState } from 'react'
import SolveBoard from './SolveBoard'
import { loadPuzzles, pickPuzzle } from '../lib/puzzles'

const DURATION = 180 // seconds
const MAX_STRIKES = 3
const BEST_KEY = 'chessanalysis:rushBest'

const ratingForScore = (s) => Math.min(2400, 800 + s * 30)
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

export default function PuzzleRush() {
  const [puzzles, setPuzzles] = useState(null)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'over'
  const [puzzle, setPuzzle] = useState(null)
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [remaining, setRemaining] = useState(DURATION)
  const [best, setBest] = useState(Number(localStorage.getItem(BEST_KEY)) || 0)
  const scoreRef = useRef(0)
  const strikesRef = useRef(0)
  const seenRef = useRef(new Set())
  const endRef = useRef(0)

  useEffect(() => {
    loadPuzzles().then(setPuzzles)
  }, [])

  const solution = useMemo(() => (puzzle ? puzzle.moves.split(' ') : []), [puzzle])
  const orientation = useMemo(
    () => (!puzzle ? 'white' : puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white'),
    [puzzle],
  )

  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) finish()
    }, 250)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function loadNext() {
    setPuzzle(pickPuzzle(puzzles, ratingForScore(scoreRef.current), seenRef.current))
  }

  function start() {
    seenRef.current = new Set()
    scoreRef.current = 0
    strikesRef.current = 0
    setScore(0)
    setStrikes(0)
    setRemaining(DURATION)
    endRef.current = Date.now() + DURATION * 1000
    setPhase('running')
    setPuzzle(pickPuzzle(puzzles, ratingForScore(0), seenRef.current))
  }

  function finish() {
    setPhase('over')
    if (scoreRef.current > best) {
      localStorage.setItem(BEST_KEY, String(scoreRef.current))
      setBest(scoreRef.current)
    }
  }

  function onSolved() {
    if (phase !== 'running') return
    if (puzzle) seenRef.current.add(puzzle.id)
    scoreRef.current += 1
    setScore(scoreRef.current)
    loadNext()
  }

  function onWrong() {
    if (phase !== 'running') return
    if (puzzle) seenRef.current.add(puzzle.id)
    strikesRef.current += 1
    setStrikes(strikesRef.current)
    if (strikesRef.current >= MAX_STRIKES) finish()
    else loadNext()
  }

  if (!puzzles) return <div className="puzzle muted">Loading puzzles…</div>

  if (phase !== 'running') {
    return (
      <div className="rush-intro">
        <h2>Puzzle Rush</h2>
        <p className="muted">
          Solve as many as you can in {DURATION / 60} minutes. Three wrong moves ends the run.
          Puzzles get harder as your score climbs.
        </p>
        {phase === 'over' && (
          <div className="rush-result">
            <div><span className="muted">Score</span><strong>{score}</strong></div>
            <div><span className="muted">Best</span><strong>{best}</strong></div>
          </div>
        )}
        <button className="analyze__btn rush-start" onClick={start}>
          {phase === 'over' ? 'Play again' : 'Start rush'}
        </button>
        {phase === 'idle' && best > 0 && <p className="muted">Best: {best}</p>}
      </div>
    )
  }

  return (
    <div className="puzzle">
      <div className="puzzle__main">
        <SolveBoard
          key={puzzle?.id}
          fen={puzzle.fen}
          solution={solution}
          autoFirst
          orientation={orientation}
          onSolved={onSolved}
          onWrong={onWrong}
        />
      </div>
      <div className="puzzle__side">
        <div className="rush-hud">
          <div className="rush-hud__time">{fmt(remaining)}</div>
          <div className="rush-hud__score"><span className="muted">Score</span><strong>{score}</strong></div>
          <div className="rush-hud__strikes">
            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
              <span key={i} className={i < strikes ? 'x used' : 'x'}>✗</span>
            ))}
          </div>
        </div>
        <p className="muted">Find the best move for <strong>{orientation}</strong>.</p>
        <button onClick={finish}>End run</button>
      </div>
    </div>
  )
}
