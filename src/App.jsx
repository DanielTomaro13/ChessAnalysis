import { useEffect, useState } from 'react'
import UsernameForm from './components/UsernameForm'
import GameList from './components/GameList'
import GameViewer from './components/GameViewer'
import Puzzles from './components/Puzzles'
import Landing from './components/Landing'
import SavedGames from './components/SavedGames'
import SettingsModal from './components/SettingsModal'
import ImportModal from './components/ImportModal'
import { fetchArchives, fetchGamesForArchive } from './api/chessApi'
import { isMuted, toggleMuted } from './lib/sound'
import { parseHash, archiveUrlFor } from './lib/share'
import { lsSet } from './lib/storage'

const USERNAME_KEY = 'chessanalysis:username'

export default function App() {
  const [view, setView] = useState('review')
  const [muted, setMuted] = useState(isMuted())
  const [showSettings, setShowSettings] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importedGame, setImportedGame] = useState(null)
  const [username, setUsername] = useState('')
  const [savedName] = useState(() => localStorage.getItem(USERNAME_KEY) || '')
  const [archives, setArchives] = useState([])
  const [selectedArchive, setSelectedArchive] = useState(null)
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [initialPly, setInitialPly] = useState(0)
  const [puzzleId, setPuzzleId] = useState(null)
  const [puzzleTheme, setPuzzleTheme] = useState(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [loadingGames, setLoadingGames] = useState(false)
  const [error, setError] = useState(null)

  function selectGame(game) {
    setInitialPly(0)
    setSelectedGame(game)
  }

  // Restore state from a shared deep link on first load, otherwise reload the
  // last player this browser looked up so returning visitors skip re-entering.
  useEffect(() => {
    const link = parseHash()
    if (!link) {
      const saved = localStorage.getItem(USERNAME_KEY)
      if (saved) handleUsername(saved, { silent: true })
      return
    }
    if (link.type === 'puzzle') {
      setPuzzleId(link.id)
      setView('puzzles')
      return
    }
    if (link.type === 'game') {
      ;(async () => {
        setLoadingUser(true)
        try {
          const list = await fetchArchives(link.user)
          setUsername(link.user)
          setArchives(list)
          const archiveUrl = archiveUrlFor(link.user, link.month)
          const g = await fetchGamesForArchive(archiveUrl)
          g.sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
          setSelectedArchive(archiveUrl)
          setGames(g)
          const target = g.find((x) => x.url === link.gameUrl)
          if (target) {
            setInitialPly(link.ply)
            setSelectedGame(target)
          }
        } catch (e) {
          setError(e.message)
        } finally {
          setLoadingUser(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleUsername(name, { silent = false } = {}) {
    setLoadingUser(true)
    setError(null)
    setGames([])
    setSelectedGame(null)
    setArchives([])
    try {
      const list = await fetchArchives(name)
      setUsername(name)
      setArchives(list)
      lsSet(USERNAME_KEY, name) // remember for next visit
      if (list.length === 0) {
        setError(`"${name}" has no public games on chess.com.`)
        setSelectedArchive(null)
      } else {
        await loadArchive(list[list.length - 1]) // most recent month
      }
    } catch (e) {
      setUsername('')
      setArchives([])
      // A silent auto-load (saved username) shouldn't surface an error or keep
      // a now-broken name around — just fall back to the landing page.
      if (silent) localStorage.removeItem(USERNAME_KEY)
      else setError(e.message)
    } finally {
      setLoadingUser(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__titlebar">
          <h1>♟ Chess Analysis</h1>
          <nav className="app__nav">
            <button className={view === 'review' ? 'is-active' : ''} onClick={() => setView('review')}>
              Review
            </button>
            <button className={view === 'puzzles' ? 'is-active' : ''} onClick={() => { setPuzzleTheme(null); setView('puzzles') }}>
              Puzzles
            </button>
            <button className={view === 'saved' ? 'is-active' : ''} onClick={() => setView('saved')}>
              Saved
            </button>
            <button
              className="app__mute"
              title={muted ? 'Unmute sounds' : 'Mute sounds'}
              onClick={() => setMuted(toggleMuted())}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="app__mute" title="Settings" onClick={() => setShowSettings(true)}>
              ⚙
            </button>
          </nav>
        </div>
        {view === 'review' && !importedGame && (
          <>
            <p className="tagline">
              Review any chess.com player’s games — free, no premium account needed.
            </p>
            <div className="review-entry">
              <UsernameForm onSubmit={handleUsername} loading={loadingUser} initialValue={savedName} />
              <button className="import-btn" onClick={() => setShowImport(true)}>⬆ Import PGN</button>
            </div>
            {error && <p className="error">{error}</p>}
          </>
        )}
      </header>

      {view === 'review' && importedGame && (
        <main className="app__imported">
          <div className="imported-bar">
            <span className="muted">{importedGame.title || 'Imported game'}</span>
            <button onClick={() => setShowImport(true)}>Import another</button>
            <button onClick={() => setImportedGame(null)}>✕ Clear</button>
          </div>
          <GameViewer game={importedGame} username="" />
        </main>
      )}

      {view === 'review' && !importedGame && archives.length === 0 && (
        <Landing
          onPlayGame={(g) => { setImportedGame(g); setView('review') }}
          onOpenPuzzles={(theme) => { setPuzzleTheme(theme); setView('puzzles') }}
        />
      )}

      {view === 'review' && !importedGame && archives.length > 0 && (
        <main className="app__main">
          <aside className="app__sidebar">
            <GameList
              games={games}
              username={username}
              archives={archives}
              selectedArchive={selectedArchive}
              onSelectArchive={loadArchive}
              onSelectGame={selectGame}
              selectedGameUrl={selectedGame?.url}
              loading={loadingGames}
            />
          </aside>
          <section className="app__viewer">
            <GameViewer game={selectedGame} username={username} initialPly={initialPly} />
          </section>
        </main>
      )}

      {view === 'puzzles' && <Puzzles username={username} initialPuzzleId={puzzleId} initialTheme={puzzleTheme} />}

      {view === 'saved' && <SavedGames />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(g) => { setImportedGame(g); setShowImport(false); setView('review') }}
        />
      )}

      <footer className="app__footer muted">
        <p className="app__kofi">
          Enjoying this? <a className="kofi-link" href="https://ko-fi.com/danieltomaro" target="_blank" rel="noopener noreferrer">☕ Buy me a coffee on Ko-fi</a>
        </p>
        <p>
          Game data from the public Chess.com API; puzzles from the open Lichess
          database. Not affiliated with Chess.com or Lichess.
        </p>
      </footer>
    </div>
  )
}
