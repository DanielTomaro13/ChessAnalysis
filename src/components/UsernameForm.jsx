import { useState } from 'react'

export default function UsernameForm({ onSubmit, loading, initialValue = '' }) {
  const [value, setValue] = useState(initialValue)

  function handleSubmit(e) {
    e.preventDefault()
    const name = value.trim()
    if (name) onSubmit(name)
  }

  return (
    <form className="username-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="chess.com username (e.g. hikaru)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button type="submit" disabled={loading || !value.trim()}>
        {loading ? 'Loading…' : 'Load games'}
      </button>
    </form>
  )
}
