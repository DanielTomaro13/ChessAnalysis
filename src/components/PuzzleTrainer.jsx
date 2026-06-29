import { useEffect, useMemo, useState } from 'react'
import SolveBoard from './SolveBoard'
import { loadPuzzles, pickPuzzle, getPuzzleRating, getSolvedCount, recordResult } from '../lib/puzzles'

const DIFFICULTIES = [
  { key: 'auto', label: 'Your level' },
  { key: 'easy', label: 'Easy', rating: 900 },
  { key: 'medium', label: 'Medium', rating: 1400 },
  { key: 'hard', label: 'Hard', rating: 1900 },
]

export default function PuzzleTrainer() {
  const [puzzles, setPuzzles] = useState(null)
  const [puzzle, setPuzzle] = useState(null)
  const [difficulty, setDifficulty] = useState('auto')
  const [rating, setRating] = useState(getPuzzleRating())
  const [solvedCount, setSolvedCount] = useState(getSolvedCount())
  const [streak, setStreak] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'wrong' | 'solved' | 'partial'
  const [seen] = useState(() => new Set())

  const solution = useMemo(() => (puzzle ? puzzle.moves.split(' ') : []), [puzzle])
  const orientation = useMemo(() => {
    if (!puzzle) return 'white'
    return puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white' // opponent moves first
  }, [puzzle])

  useEffect(() => {
    loadPuzzles().then((p) => {
      setPuzzles(p)
      setPuzzle(pickPuzzle(p, targetRating('auto'), seen))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function targetRating(diff) {
    if (diff === 'auto') return getPuzzleRating()
    return DIFFICULTIES.find((d) => d.key === diff)?.rating ?? 1200
  }

  function next(diff = difficulty) {
    setFeedback(null)
    setPuzzle(pickPuzzle(puzzles, targetRating(diff), seen))
  }

  function handleSolved(clean) {
    if (feedback === 'solved' || feedback === 'partial') return
    seen.add(puzzle.id)
    const newRating = recordResult(puzzle.rating, clean)
    setRating(newRating)
    setSolvedCount(getSolvedCount())
    setStreak((s) => (clean ? s + 1 : 0))
    setFeedback(clean ? 'solved' : 'partial')
  }

  function handleWrong() {
    if (!feedback) setFeedback('wrong')
  }

  function changeDifficulty(diff) {
    setDifficulty(diff)
    next(diff)
  }

  if (!puzzles) return <div className="puzzle muted">Loading puzzles…</div>
  if (!puzzle) return <div className="puzzle muted">No puzzle found.</div>

  const done = feedback === 'solved' || feedback === 'partial'

  return (
    <div className="puzzle" data-puzzle-id={puzzle.id}>
      <div className="puzzle__main">
        <SolveBoard
          key={puzzle.id}
          fen={puzzle.fen}
          solution={solution}
          autoFirst
          orientation={orientation}
          onSolved={handleSolved}
          onWrong={handleWrong}
        />
      </div>

      <div className="puzzle__side">
        <div className="puzzle__stats">
          <div><span className="muted">Your rating</span><strong>{rating}</strong></div>
          <div><span className="muted">Streak</span><strong>{streak}</strong></div>
          <div><span className="muted">Solved</span><strong>{solvedCount}</strong></div>
        </div>

        <label className="puzzle__difficulty">
          Difficulty{' '}
          <select value={difficulty} onChange={(e) => changeDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>

        <div className={`puzzle__turn ${done ? 'is-hidden' : ''}`}>
          {!done && <>Find the best move for <strong>{orientation}</strong></>}
        </div>

        {feedback === 'wrong' && <p className="puzzle__fb fb--wrong">✗ Not the move — try again</p>}
        {feedback === 'solved' && <p className="puzzle__fb fb--ok">✓ Solved!</p>}
        {feedback === 'partial' && <p className="puzzle__fb fb--partial">Solved (with help)</p>}

        {done && (
          <div className="puzzle__solved-info">
            <p className="muted">
              Puzzle rating {puzzle.rating}
              {puzzle.themes ? ` · ${puzzle.themes.split(' ').slice(0, 3).join(', ')}` : ''}
            </p>
            <a href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer" className="viewer__link">
              View on Lichess ↗
            </a>
          </div>
        )}

        <button className="puzzle__next analyze__btn" onClick={() => next()}>
          {done ? 'Next puzzle →' : 'Skip →'}
        </button>
      </div>
    </div>
  )
}
