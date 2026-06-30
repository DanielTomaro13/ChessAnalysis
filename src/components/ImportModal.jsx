import { useState } from 'react'
import { buildGameFromPgn } from '../lib/importPgn'

export default function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  function submit(pgn) {
    try {
      const game = buildGameFromPgn(pgn)
      onImport(game)
    } catch (e) {
      setError(e.message || 'Could not read that PGN.')
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => submit(String(reader.result))
    reader.readAsText(file)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Import a game (PGN)</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <p className="muted modal__note">
          Paste a PGN from Lichess, an OTB game, anywhere — and review it with the engine.
        </p>
        <textarea
          className="import__textarea"
          placeholder={'[Event "..."]\n\n1. e4 e5 2. Nf3 ...'}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null) }}
          rows={9}
        />
        {error && <p className="error">{error}</p>}
        <div className="import__actions">
          <label className="import__file">
            Upload .pgn
            <input type="file" accept=".pgn,text/plain" onChange={onFile} hidden />
          </label>
          <button className="analyze__btn" disabled={!text.trim()} onClick={() => submit(text)}>
            Review game →
          </button>
        </div>
      </div>
    </div>
  )
}
