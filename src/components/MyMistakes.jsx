import { useEffect, useMemo, useRef, useState } from 'react'
import SolveBoard from './SolveBoard'
import RewardBar from './RewardBar'
import AchievementToast from './AchievementToast'
import { getMistakes, removeMistake } from '../lib/puzzles'
import { getProgress, recordSolve } from '../lib/progress'
import { playSound } from '../lib/sound'
import { CLASS_META } from '../lib/analysis'

export default function MyMistakes({ username }) {
  const boardRef = useRef(null)
  const [mistakes, setMistakes] = useState([])
  const [idx, setIdx] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [progress, setProgress] = useState(getProgress())
  const [xpFlash, setXpFlash] = useState(null)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    setMistakes(getMistakes(username))
    setIdx(0)
    setFeedback(null)
  }, [username])

  const current = mistakes[idx]
  const solution = useMemo(() => (current ? current.solution : []), [current])

  if (!username) {
    return (
      <div className="puzzle puzzle--empty muted">
        Search your username in the <strong>Review</strong> tab first.
      </div>
    )
  }
  if (!mistakes.length) {
    return (
      <div className="puzzle puzzle--empty muted">
        No saved mistakes yet. Open one of your games in <strong>Review</strong> and click
        <strong> Analyze game</strong> — your mistakes and blunders are collected here to retrain.
      </div>
    )
  }

  function next() {
    setFeedback(null)
    setIdx((i) => (i + 1) % mistakes.length)
  }

  function drop() {
    removeMistake(username, current.fen)
    const remaining = getMistakes(username)
    setMistakes(remaining)
    setIdx((i) => (remaining.length ? i % remaining.length : 0))
    setFeedback(null)
  }

  function handleSolved(clean) {
    if (feedback === 'solved' || feedback === 'partial') return
    const summary = recordSolve({ clean, rating: 1300, themes: current.class })
    setProgress(getProgress())
    setXpFlash(summary.xpGained)
    setTimeout(() => setXpFlash(null), 1300)
    if (summary.leveledUp) playSound('level')
    if (summary.unlocked.length) setToasts((t) => [...t, ...summary.unlocked])
    setFeedback(clean ? 'solved' : 'partial')
  }

  const meta = CLASS_META[current.class]
  const done = feedback === 'solved' || feedback === 'partial'

  return (
    <div className="puzzle">
      <div className="puzzle__main">
        <SolveBoard
          ref={boardRef}
          key={current.fen}
          fen={current.fen}
          solution={solution}
          autoFirst={false}
          orientation={current.sideWhite ? 'white' : 'black'}
          onSolved={handleSolved}
          onWrong={() => !feedback && setFeedback('wrong')}
        />
      </div>

      <div className="puzzle__side">
        <RewardBar progress={progress} flash={xpFlash} />

        <div className="puzzle__stats">
          <div><span className="muted">Mistake</span><strong>{idx + 1}/{mistakes.length}</strong></div>
          <div>
            <span className="muted">Type</span>
            <strong style={{ color: meta?.color }}>{meta?.label}</strong>
          </div>
        </div>

        <p className="puzzle__from muted">
          vs {current.opponent || '—'}
          {current.gameUrl && (
            <>
              {' · '}
              <a className="viewer__link" href={current.gameUrl} target="_blank" rel="noreferrer">game ↗</a>
            </>
          )}
        </p>

        {!done && (
          <div className="puzzle__turn">
            You went wrong here — find the best move for <strong>{current.sideWhite ? 'white' : 'black'}</strong>
          </div>
        )}

        {feedback === 'wrong' && <p className="puzzle__fb fb--wrong">✗ Try again</p>}
        {done && (
          <div className="puzzle__solved-info">
            <p className={`puzzle__fb ${feedback === 'solved' ? 'fb--ok' : 'fb--partial'}`}>
              {feedback === 'solved' ? '✓ Correct!' : 'Solved with help'}
            </p>
            <p className="muted">
              You played <strong>{current.playedSan}</strong>; best was <strong>{current.bestSan}</strong>.
            </p>
          </div>
        )}

        <div className="puzzle__actions">
          {!done && (
            <>
              <button onClick={() => boardRef.current?.hint()}>💡 Hint</button>
              <button onClick={() => boardRef.current?.reveal()}>Show solution</button>
            </>
          )}
          <button className="analyze__btn" onClick={next}>Next →</button>
          <button onClick={drop}>Remove</button>
        </div>
      </div>

      <AchievementToast toasts={toasts} onClear={() => setToasts([])} />
    </div>
  )
}
