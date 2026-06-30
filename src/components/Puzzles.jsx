import { useState } from 'react'
import PuzzleTrainer from './PuzzleTrainer'
import PuzzleRush from './PuzzleRush'
import MyMistakes from './MyMistakes'
import PuzzleStats from './PuzzleStats'
import { getMistakes } from '../lib/puzzles'

export default function Puzzles({ username, initialPuzzleId, initialTheme }) {
  const [tab, setTab] = useState('trainer')
  const mistakeCount = getMistakes(username).length

  return (
    <div className="puzzles">
      <div className="subtabs">
        <button className={tab === 'trainer' ? 'is-active' : ''} onClick={() => setTab('trainer')}>
          Trainer
        </button>
        <button className={tab === 'rush' ? 'is-active' : ''} onClick={() => setTab('rush')}>
          Rush
        </button>
        <button className={tab === 'mistakes' ? 'is-active' : ''} onClick={() => setTab('mistakes')}>
          My mistakes{mistakeCount ? ` (${mistakeCount})` : ''}
        </button>
        <button className={tab === 'stats' ? 'is-active' : ''} onClick={() => setTab('stats')}>
          Stats
        </button>
      </div>
      {tab === 'trainer' && <PuzzleTrainer initialPuzzleId={initialPuzzleId} initialTheme={initialTheme} />}
      {tab === 'rush' && <PuzzleRush />}
      {tab === 'mistakes' && <MyMistakes username={username} />}
      {tab === 'stats' && <PuzzleStats />}
    </div>
  )
}
