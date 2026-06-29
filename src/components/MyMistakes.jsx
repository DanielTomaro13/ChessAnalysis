import { useEffect, useMemo, useState } from 'react'
import SolveBoard from './SolveBoard'
import { getMistakes, removeMistake } from '../lib/puzzles'
import { CLASS_META } from '../lib/analysis'

export default function MyMistakes({ username }) {
  const [mistakes, setMistakes] = useState([])
  const [idx, setIdx] = useState(0)
  const [feedback, setFeedback] = useState(null)

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

  const meta = CLASS_META[current.class]
  const done = feedback === 'solved' || feedback === 'partial'

  return (
    <div className="puzzle">
      <div className="puzzle__main">
        <SolveBoard
          key={current.fen}
          fen={current.fen}
          solution={solution}
          autoFirst={false}
          orientation={current.sideWhite ? 'white' : 'black'}
          onSolved={(clean) => !done && setFeedback(clean ? 'solved' : 'partial')}
          onWrong={() => !feedback && setFeedback('wrong')}
        />
      </div>

      <div className="puzzle__side">
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

        <div className={`puzzle__turn ${done ? 'is-hidden' : ''}`}>
          {!done && <>You went wrong here — find the best move for <strong>{current.sideWhite ? 'white' : 'black'}</strong></>}
        </div>

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
          <button className="analyze__btn" onClick={next}>Next →</button>
          <button onClick={drop}>Remove</button>
        </div>
      </div>
    </div>
  )
}
