import { useState } from 'react'
import PuzzleTrainer from './PuzzleTrainer'
import MyMistakes from './MyMistakes'
import { getMistakes } from '../lib/puzzles'

export default function Puzzles({ username }) {
  const [tab, setTab] = useState('trainer')
  const mistakeCount = getMistakes(username).length

  return (
    <div className="puzzles">
      <div className="subtabs">
        <button className={tab === 'trainer' ? 'is-active' : ''} onClick={() => setTab('trainer')}>
          Trainer
        </button>
        <button className={tab === 'mistakes' ? 'is-active' : ''} onClick={() => setTab('mistakes')}>
          My mistakes{mistakeCount ? ` (${mistakeCount})` : ''}
        </button>
      </div>
      {tab === 'trainer' ? <PuzzleTrainer /> : <MyMistakes username={username} />}
    </div>
  )
}
