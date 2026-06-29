import { useState } from 'react'
import UsernameForm from './components/UsernameForm'
import GameList from './components/GameList'
import GameViewer from './components/GameViewer'
import { fetchArchives, fetchGamesForArchive } from './api/chessApi'

export default function App() {
  const [username, setUsername] = useState('')
  const [archives, setArchives] = useState([])
  const [selectedArchive, setSelectedArchive] = useState(null)
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [loadingGames, setLoadingGames] = useState(false)
  const [error, setError] = useState(null)

  async function loadArchive(url) {
    setSelectedArchive(url)
    setSelectedGame(null)
    setLoadingGames(true)
    setError(null)
    try {
      const g = await fetchGamesForArchive(url)
      // newest games first
      g.sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
      setGames(g)
    } catch (e) {
      setError(e.message)
      setGames([])
    } finally {
      setLoadingGames(false)
    }
  }

  async function handleUsername(name) {
    setLoadingUser(true)
    setError(null)
    setGames([])
    setSelectedGame(null)
    setArchives([])
    try {
      const list = await fetchArchives(name)
      setUsername(name)
      setArchives(list)
      if (list.length === 0) {
        setError(`"${name}" has no public games on chess.com.`)
        setSelectedArchive(null)
      } else {
        await loadArchive(list[list.length - 1]) // most recent month
      }
    } catch (e) {
      setError(e.message)
      setUsername('')
      setArchives([])
    } finally {
      setLoadingUser(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>♟ Chess Analysis</h1>
        <p className="tagline">
          Review any chess.com player’s games — free, no premium account needed.
        </p>
        <UsernameForm onSubmit={handleUsername} loading={loadingUser} />
        {error && <p className="error">{error}</p>}
      </header>

      {archives.length > 0 && (
        <main className="app__main">
          <aside className="app__sidebar">
            <GameList
              games={games}
              username={username}
              archives={archives}
              selectedArchive={selectedArchive}
              onSelectArchive={loadArchive}
              onSelectGame={setSelectedGame}
              selectedGameUrl={selectedGame?.url}
              loading={loadingGames}
            />
          </aside>
          <section className="app__viewer">
            <GameViewer game={selectedGame} username={username} />
          </section>
        </main>
      )}

      <footer className="app__footer muted">
        Data from the public Chess.com API. Not affiliated with Chess.com.
        Engine analysis &amp; puzzles coming next.
      </footer>
    </div>
  )
}
