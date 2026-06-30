import { useEffect, useRef, useState } from 'react'
import { fetchRecentGames, fetchPlayerCard } from '../api/chessApi'
import { computeInsights } from '../lib/insights'
import { getMistakes } from '../lib/puzzles'
import Sparkline from './Sparkline'
import RatingChips from './RatingChips'

// Small win/loss/draw stacked bar.
function WldBar({ rec }) {
  const total = rec.w + rec.l + rec.d || 1
  return (
    <div className="wld-bar" title={`${rec.w}W / ${rec.l}L / ${rec.d}D`}>
      <span className="wld-bar__w" style={{ width: `${(rec.w / total) * 100}%` }} />
      <span className="wld-bar__d" style={{ width: `${(rec.d / total) * 100}%` }} />
      <span className="wld-bar__l" style={{ width: `${(rec.l / total) * 100}%` }} />
    </div>
  )
}

function Wld({ rec }) {
  return (
    <span className="wld-nums">
      <b className="t-win">{rec.w}</b>/<b className="t-draw">{rec.d}</b>/<b className="t-loss">{rec.l}</b>
    </span>
  )
}

function scoreClass(s) {
  return s >= 55 ? 't-win' : s <= 45 ? 't-loss' : 't-draw'
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export default function Insights({ username, card: cardProp, onGoReview }) {
  const [data, setData] = useState(null)
  const [card, setCard] = useState(cardProp || null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const cacheRef = useRef({}) // username -> insights

  useEffect(() => {
    if (!username) return
    const key = username.toLowerCase()
    if (cacheRef.current[key]) {
      setData(cacheRef.current[key])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    if (cardProp && cardProp.username?.toLowerCase() === key) setCard(cardProp)
    else fetchPlayerCard(username).then((c) => !cancelled && setCard(c)).catch(() => {})
    fetchRecentGames(username, {
      maxMonths: 6,
      maxGames: 800,
      onProgress: (m, total, n) => !cancelled && setProgress({ m, total, n }),
    })
      .then((games) => {
        if (cancelled) return
        const insights = computeInsights(games, username)
        if (!insights) { setError('No standard games found for this player.'); return }
        cacheRef.current[key] = insights
        setData(insights)
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [username])

  if (!username) {
    return (
      <div className="insights insights--empty">
        <p className="muted">Load a chess.com player to see their insights.</p>
        <button className="analyze__btn" onClick={onGoReview}>← Go to Review</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="insights insights--empty">
        <p className="muted">
          Crunching <strong>{username}</strong>’s games…
          {progress ? ` ${progress.n} games from ${progress.m}/${progress.total} months` : ''}
        </p>
      </div>
    )
  }

  if (error) return <div className="insights insights--empty"><p className="error">{error}</p></div>
  if (!data) return null

  const r = data
  const mistakes = getMistakes(username)
  const maxWeekday = Math.max(...r.weekdays.map((d) => d.games), 1)

  return (
    <div className="insights">
      <div className="insights__top">
        <div className="insights__id">
          {card?.avatar && <img className="insights__avatar" src={card.avatar} alt="" />}
          <div>
            <h2 className="insights__name">
              {card?.flag ? card.flag + ' ' : ''}{card?.name || username}
            </h2>
            <p className="muted insights__sub">
              @{username} · {r.count} games
              {r.range ? ` · ${fmtDate(r.range.from)} – ${fmtDate(r.range.to)}` : ''}
            </p>
            <RatingChips ratings={card?.ratings} className="insights__ratings" />
          </div>
        </div>
        <div className="insights__record">
          <div className="bigstat">
            <span className={`bigstat__val ${scoreClass(r.overall.score)}`}>{r.overall.score}%</span>
            <span className="muted">score</span>
          </div>
          <div className="bigstat">
            <span className="bigstat__val"><b className="t-win">{r.overall.w}</b>·<b className="t-draw">{r.overall.d}</b>·<b className="t-loss">{r.overall.l}</b></span>
            <span className="muted">W · D · L</span>
          </div>
        </div>
      </div>

      {/* Strengths & weaknesses */}
      <div className="insights__grid insights__grid--2">
        <section className="card card--good">
          <h3>💪 Strengths</h3>
          <ul className="insight-list">
            {r.highlights.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
        <section className="card card--bad">
          <h3>🎯 Work on</h3>
          <ul className="insight-list">
            {r.highlights.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      </div>

      <div className="insights__grid">
        {/* Color */}
        <section className="card">
          <h3>By colour</h3>
          {['white', 'black'].map((c) => (
            <div className="row-stat" key={c}>
              <span className="row-stat__label">{c === 'white' ? '♔ White' : '♚ Black'}</span>
              <WldBar rec={r.byColor[c]} />
              <span className={`row-stat__val ${scoreClass(r.byColor[c].score)}`}>{r.byColor[c].score}%</span>
            </div>
          ))}
          <p className="muted card__foot">Bars show win / draw / loss. % is score (draw = ½).</p>
        </section>

        {/* Time control */}
        <section className="card">
          <h3>By time control</h3>
          {r.byTime.map((t) => (
            <div className="row-stat" key={t.timeClass}>
              <span className="row-stat__label">{t.timeClass}</span>
              <WldBar rec={t} />
              <span className={`row-stat__val ${scoreClass(t.score)}`}>{t.score}%</span>
            </div>
          ))}
        </section>

        {/* Rating history */}
        {r.ratingHistory.length > 2 && (
          <section className="card">
            <h3>Rating trend</h3>
            <Sparkline data={r.ratingHistory} width={300} height={70} />
            <p className="muted card__foot">
              {r.ratingHistory[0]} → {r.ratingHistory[r.ratingHistory.length - 1]} over {r.ratingHistory.length} rated games
            </p>
          </section>
        )}

        {/* Accuracy */}
        {r.accuracy != null && (
          <section className="card">
            <h3>Accuracy</h3>
            <div className="insights__acc">
              <div className="bigstat"><span className="bigstat__val">{r.accuracy}%</span><span className="muted">average</span></div>
              {r.accuracyByColor.white != null && <div className="bigstat"><span className="bigstat__val">{r.accuracyByColor.white}%</span><span className="muted">as White</span></div>}
              {r.accuracyByColor.black != null && <div className="bigstat"><span className="bigstat__val">{r.accuracyByColor.black}%</span><span className="muted">as Black</span></div>}
            </div>
            <p className="muted card__foot">From chess.com review data ({r.accuracyCoverage}% of games).</p>
          </section>
        )}
      </div>

      {/* Openings */}
      <section className="card">
        <h3>Openings <span className="muted">— your most-played, with results</span></h3>
        <div className="opening-table">
          <div className="opening-row opening-row--head">
            <span>Opening</span><span>Games</span><span>W/D/L</span><span>Score</span><span>Acc.</span>
          </div>
          {r.familyList.slice(0, 12).map((f) => (
            <div className="opening-row" key={f.family}>
              <span className="opening-row__name" title={f.example || ''}>{f.family}</span>
              <span>{f.games}</span>
              <span><Wld rec={f} /></span>
              <span className={scoreClass(f.score)}>{f.score}%</span>
              <span className="muted">{f.accuracy != null ? f.accuracy + '%' : '—'}</span>
            </div>
          ))}
        </div>
        {(r.bestOpening || r.worstOpening) && (
          <p className="muted card__foot">
            {r.bestOpening && <>Best: <b className="t-win">{r.bestOpening.family}</b> ({r.bestOpening.score}%). </>}
            {r.worstOpening && r.worstOpening.family !== r.bestOpening?.family && <>Toughest: <b className="t-loss">{r.worstOpening.family}</b> ({r.worstOpening.score}%).</>}
          </p>
        )}
      </section>

      <div className="insights__grid">
        {/* Repertoire */}
        <section className="card">
          <h3>Repertoire</h3>
          <p className="card__subhead muted">As White — first move</p>
          {r.whiteFirstMoves.slice(0, 5).map((m) => (
            <div className="row-stat" key={m.move}>
              <span className="row-stat__label">{m.move}</span>
              <WldBar rec={m} />
              <span className="row-stat__val muted">{m.games}g · <span className={scoreClass(m.score)}>{m.score}%</span></span>
            </div>
          ))}
          <p className="card__subhead muted">As Black — facing</p>
          <div className="row-stat"><span className="row-stat__label">1.e4</span><WldBar rec={r.vsE4} /><span className="row-stat__val muted">{r.vsE4.games}g · <span className={scoreClass(r.vsE4.score)}>{r.vsE4.score}%</span></span></div>
          <div className="row-stat"><span className="row-stat__label">1.d4</span><WldBar rec={r.vsD4} /><span className="row-stat__val muted">{r.vsD4.games}g · <span className={scoreClass(r.vsD4.score)}>{r.vsD4.score}%</span></span></div>
        </section>

        {/* How games end */}
        <section className="card">
          <h3>How games end</h3>
          <p className="card__subhead muted">Your wins</p>
          {r.winReasons.map((x) => (
            <div className="reason-row" key={x.reason}><span>by {x.reason}</span><b className="t-win">{x.count}</b></div>
          ))}
          <p className="card__subhead muted">Your losses</p>
          {r.lossReasons.length ? r.lossReasons.map((x) => (
            <div className="reason-row" key={x.reason}><span>by {x.reason}</span><b className="t-loss">{x.count}</b></div>
          )) : <p className="muted">No losses in this sample 🎉</p>}
        </section>

        {/* Opponent strength */}
        <section className="card">
          <h3>Opponent strength</h3>
          <div className="row-stat"><span className="row-stat__label">vs higher</span><WldBar rec={r.vsHigher} /><span className="row-stat__val muted">{r.vsHigher.games}g · <span className={scoreClass(r.vsHigher.score)}>{r.vsHigher.score}%</span></span></div>
          <div className="row-stat"><span className="row-stat__label">vs lower</span><WldBar rec={r.vsLower} /><span className="row-stat__val muted">{r.vsLower.games}g · <span className={scoreClass(r.vsLower.score)}>{r.vsLower.score}%</span></span></div>
          {r.bestUpset && <p className="muted card__foot">Biggest upset: beat <b>{r.bestUpset.opponent}</b> ({r.bestUpset.oppRating}), {r.bestUpset.oppRating - r.bestUpset.myRating} pts above you.</p>}
          {r.worstLoss && <p className="muted card__foot">Toughest result: lost to <b>{r.worstLoss.opponent}</b> ({r.worstLoss.oppRating}).</p>}
        </section>

        {/* Tendencies */}
        <section className="card">
          <h3>Tendencies</h3>
          <ul className="kv-list">
            <li><span>Avg. game length</span><b>{r.avgMoves} moves</b></li>
            <li><span>Castles kingside</span><b>{r.castle.kingside.games}× <span className={scoreClass(r.castle.kingside.score)}>{r.castle.kingside.score}%</span></b></li>
            <li><span>Castles queenside</span><b>{r.castle.queenside.games}× <span className={scoreClass(r.castle.queenside.score)}>{r.castle.queenside.score}%</span></b></li>
            <li><span>Losses in &lt;20 moves</span><b>{r.shortLossPct}%</b></li>
            <li><span>Losses on time</span><b>{r.onTimeLossPct}%</b></li>
            <li><span>Best win streak</span><b>{r.streaks.win}</b></li>
            {r.bestWeekday && <li><span>Best day</span><b>{r.bestWeekday.day} ({r.bestWeekday.score}%)</b></li>}
          </ul>
        </section>

        {/* Activity */}
        <section className="card">
          <h3>Activity by day</h3>
          <div className="weekday-bars">
            {r.weekdays.map((d) => (
              <div className="weekday-bars__col" key={d.day} title={`${d.games} games · ${d.score}%`}>
                <div className="weekday-bars__bar" style={{ height: `${(d.games / maxWeekday) * 100}%` }} />
                <span className="weekday-bars__lbl">{d.day[0]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Blunder positions */}
        {mistakes.length > 0 && (
          <section className="card">
            <h3>Your blunder positions</h3>
            <p className="muted">{mistakes.length} positions where you went wrong have been saved from games you reviewed.</p>
            <p className="muted card__foot">Train them under <b>Puzzles → My mistakes</b>.</p>
          </section>
        )}
      </div>

      <p className="muted insights__note">
        Insights are computed from up to your last 800 chess.com games (6 months). “Score” counts a draw as half a point.
      </p>
    </div>
  )
}
