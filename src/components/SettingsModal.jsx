import { useState } from 'react'
import { BOARD_THEMES, getSettings, setSettings } from '../lib/settings'
import { isMuted, setMuted } from '../lib/sound'

const DEPTHS = [
  { value: 10, label: 'Fast (10)' },
  { value: 13, label: 'Balanced (13)' },
  { value: 16, label: 'Deep (16)' },
]

export default function SettingsModal({ onClose }) {
  const [s, setS] = useState(getSettings())
  const [muted, setMutedState] = useState(isMuted())

  function update(patch) {
    setSettings(patch)
    setS(getSettings())
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Settings</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <label className="modal__field">
          <span>Board theme</span>
          <div className="theme-swatches">
            {Object.entries(BOARD_THEMES).map(([key, t]) => (
              <button
                key={key}
                className={`swatch ${s.boardTheme === key ? 'is-active' : ''}`}
                onClick={() => update({ boardTheme: key })}
                title={t.label}
              >
                <span style={{ background: t.light }} />
                <span style={{ background: t.dark }} />
              </button>
            ))}
          </div>
        </label>

        <label className="modal__field">
          <span>Default analysis depth</span>
          <select value={s.depth} onChange={(e) => update({ depth: Number(e.target.value) })}>
            {DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>

        <label className="modal__field modal__field--row">
          <span>Sound effects</span>
          <button
            className={`toggle ${muted ? '' : 'is-on'}`}
            onClick={() => { setMuted(!muted); setMutedState(!muted) }}
          >
            {muted ? 'Off' : 'On'}
          </button>
        </label>

        <p className="muted modal__note">
          Settings, puzzle progress and saved analysis are stored in this browser only.
        </p>
      </div>
    </div>
  )
}
