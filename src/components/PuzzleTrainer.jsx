import { useEffect, useMemo, useRef, useState } from 'react'
import SolveBoard from './SolveBoard'
import RewardBar from './RewardBar'
import AchievementToast from './AchievementToast'
import {
  loadPuzzles,
  pickPuzzle,
  pickDailyPuzzle,
  getPuzzleRating,
  getSolvedCount,
  recordResult,
  THEMES,
} from '../lib/puzzles'
import { getProgress, recordSolve } from '../lib/progress'
import { playSound } from '../lib/sound'
import { buildPuzzleLink, copyLink } from '../lib/share'

const DIFFICULTIES = [
  { key: 'auto', label: 'Your level' },
  { key: 'easy', label: 'Easy', rating: 900 },
  { key: 'medium', label: 'Medium', rating: 1400 },
  { key: 'hard', label: 'Hard', rating: 1900 },
]

export default function PuzzleTrainer({ initialPuzzleId, initialTheme }) {
  const boardRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [puzzles, setPuzzles] = useState(null)
  const [puzzle, setPuzzle] = useState(null)
  const [difficulty, setDifficulty] = useState('auto')
  const themeKnown = initialTheme && initialTheme !== 'daily' && THEMES.some((t) => t.key === initialTheme)
  const [theme, setTheme] = useState(themeKnown ? initialTheme : 'all')
  const [rating, setRating] = useState(getPuzzleRating())
  const [solvedCount, setSolvedCount] = useState(getSolvedCount())
  const [feedback, setFeedback] = useState(null)
  const [progress, setProgress] = useState(getProgress())
  const [xpFlash, setXpFlash] = useState(null)
  const [toasts, setToasts] = useState([])
  const [seen] = useState(() => new Set())

  const solution = useMemo(() => (puzzle ? puzzle.moves.split(' ') : []), [puzzle])
  const orientation = useMemo(
    () => (!puzzle ? 'white' : puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white'),
    [puzzle],
  )

  useEffect(() => {
    loadPuzzles().then((p) => {
      setPuzzles(p)
      const shared = initialPuzzleId && p.find((x) => x.id === initialPuzzleId)
      const daily = initialTheme === 'daily' && pickDailyPuzzle(p)
      setPuzzle(shared || daily || pickPuzzle(p, getPuzzleRating(), seen, themeKnown ? initialTheme : 'all'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function targetRating(diff) {
    if (diff === 'auto') return getPuzzleRating()
    return DIFFICULTIES.find((d) => d.key === diff)?.rating ?? 1200
  }

  function next(diff = difficulty, th = theme) {
    setFeedback(null)
    setPuzzle(pickPuzzle(puzzles, targetRating(diff), seen, th))
  }

  function handleSolved(clean) {
    if (feedback === 'solved' || feedback === 'partial') return
    seen.add(puzzle.id)
    setRating(recordResult(puzzle.rating, clean))
    setSolvedCount(getSolvedCount())
    const summary = recordSolve({ clean, rating: puzzle.rating, themes: puzzle.themes })
    setProgress(getProgress())
    setXpFlash(summary.xpGained)
    setTimeout(() => setXpFlash(null), 1300)
    if (summary.leveledUp) playSound('level')
    if (summary.unlocked.length) setToasts((t) => [...t, ...summary.unlocked])
    setFeedback(clean ? 'solved' : 'partial')
  }

  if (!puzzles) return <div className="puzzle muted">Loading puzzles…</div>
  if (!puzzle) return <div className="puzzle muted">No puzzle for this filter.</div>

  const done = feedback === 'solved' || feedback === 'partial'

  return (
    <div className="puzzle" data-puzzle-id={puzzle.id}>
      <div className="puzzle__main">
        <SolveBoard
          ref={boardRef}
          key={puzzle.id}
          fen={puzzle.fen}
          solution={solution}
          autoFirst
          orientation={orientation}
          onSolved={handleSolved}
          onWrong={() => !feedback && setFeedback('wrong')}
        />
      </div>

      <div className="puzzle__side">
        <RewardBar progress={progress} flash={xpFlash} />

        <div className="puzzle__stats">
          <div><span className="muted">Puzzle rating</span><strong>{rating}</strong></div>
          <div><span className="muted">Streak</span><strong>{progress.combo}</strong></div>
          <div><span className="muted">Solved</span><strong>{solvedCount}</strong></div>
        </div>

        <div className="puzzle__filters">
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); next(e.target.value, theme) }}>
              {DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
          <label>
            Tactic
            <select value={theme} onChange={(e) => { setTheme(e.target.value); next(difficulty, e.target.value) }}>
              {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        </div>

        {!done && (
          <div className="puzzle__turn">
            Find the best move for <strong>{orientation}</strong>
          </div>
        )}

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
            {' · '}
            <button
              className="linklike"
              onClick={async () => {
                if (await copyLink(buildPuzzleLink(puzzle.id))) {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }
              }}
            >
              {copied ? 'Link copied ✓' : 'Share ⧉'}
            </button>
          </div>
        )}

        <div className="puzzle__actions">
          {!done ? (
            <>
              <button onClick={() => boardRef.current?.hint()}>💡 Hint</button>
              <button onClick={() => boardRef.current?.reveal()}>Show solution</button>
              <button className="analyze__btn" onClick={() => next()}>Skip →</button>
            </>
          ) : (
            <button className="analyze__btn puzzle__next" onClick={() => next()}>Next puzzle →</button>
          )}
        </div>
      </div>

      <AchievementToast toasts={toasts} onClear={() => setToasts([])} />
    </div>
  )
}
