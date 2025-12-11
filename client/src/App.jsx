import { useEffect, useMemo, useState } from 'react'
import './App.css'

const storageKey = 'harmonix.bookmarks'
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/$/, '')

const chordTokenRegex = /^(?:N\.C\.|x\d+|[A-G](?:#|b)?(?:maj|Maj|M|m|dim|aug|sus|add|mMaj)?[0-9#b()/+\-]*?(?:\/[A-G](?:#|b)?)?)$/i

const isChordLine = (line = '') => {
  const sanitized = line.replace(/\t/g, '    ').trim()
  if (!sanitized) return false
  const tokens = sanitized.split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  return tokens.every((token) => chordTokenRegex.test(token))
}

const parseChordSheet = (text = '') => {
  if (!text) return []
  const rows = text.replace(/\r/g, '').split('\n')
  const sections = []
  let currentSection = null
  let pendingChords = null
  let autoIndex = 0

  const ensureSection = () => {
    if (!currentSection) {
      autoIndex += 1
      currentSection = { label: `Section ${autoIndex}`, lines: [] }
    }
  }

  rows.forEach((row) => {
    const rawLine = row.replace(/\t/g, '    ')
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (currentSection && currentSection.lines.length) {
        sections.push(currentSection)
      }
      const label = trimmed.slice(1, -1).trim() || `Section ${autoIndex + 1}`
      currentSection = { label, lines: [] }
      pendingChords = null
      return
    }

    if (!trimmed) {
      if (pendingChords) {
        ensureSection()
        currentSection.lines.push({ chords: pendingChords, lyrics: '' })
        pendingChords = null
      }
      ensureSection()
      currentSection.lines.push({ chords: '', lyrics: '', spacer: true })
      return
    }

    if (isChordLine(rawLine)) {
      ensureSection()
      if (pendingChords) {
        currentSection.lines.push({ chords: pendingChords, lyrics: '' })
      }
      pendingChords = rawLine
      return
    }

    ensureSection()
    if (pendingChords) {
      currentSection.lines.push({ chords: pendingChords, lyrics: rawLine })
      pendingChords = null
    } else {
      currentSection.lines.push({ chords: '', lyrics: rawLine })
    }
  })

  if (pendingChords) {
    ensureSection()
    currentSection.lines.push({ chords: pendingChords, lyrics: '' })
  }

  if (currentSection && currentSection.lines.length) {
    sections.push(currentSection)
  }

  return sections
}

const normalizeSongPayload = (payload = {}, fallbackTitle = 'Untitled Sheet') => {
  const baseBody = payload.body || payload.sheet || payload.lyrics || ''
  const body = typeof baseBody === 'string' ? baseBody : ''
  const hasSections = Array.isArray(payload.sections) && payload.sections.length > 0
  const sections = hasSections ? payload.sections : parseChordSheet(body)

  return {
    id: payload.id || `song-${Date.now()}`,
    title: payload.title || fallbackTitle,
    artist: payload.artist || payload.author || 'Unknown Artist',
    source: payload.source || 'Scraped',
    key: payload.key || payload.metadata?.key || '—',
    bpm: payload.bpm || payload.metadata?.bpm || '—',
    tuning: payload.tuning || payload.metadata?.tuning || 'Standard',
    tags: payload.tags || payload.metadata?.tags || [],
    lastSynced: payload.lastSynced || 'just now',
    notes: payload.notes || payload.summary || '',
    body,
    sections,
    chords: Array.isArray(payload.chords) ? payload.chords : [],
  }
}

function App() {
  const [activeSong, setActiveSong] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchState, setSearchState] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [bookmarks, setBookmarks] = useState([])
  const [bookmarksHydrated, setBookmarksHydrated] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiState, setAiState] = useState('idle')
  const [aiError, setAiError] = useState('')
  const [aiVersion, setAiVersion] = useState(null)
  const [arrangementSource, setArrangementSource] = useState('original')
  const [chordFocus, setChordFocus] = useState(null)
  const [chordCache, setChordCache] = useState({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          const hydrated = parsed.map((song) => normalizeSongPayload(song, song.title))
          setBookmarks(hydrated)
        }
      }
    } catch (error) {
      console.error('Failed to load bookmarks', error)
    }
    setBookmarksHydrated(true)
  }, [])

  useEffect(() => {
    if (!bookmarksHydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(bookmarks))
    } catch (error) {
      console.error('Failed to persist bookmarks', error)
    }
  }, [bookmarks, bookmarksHydrated])

  const displayedSong = arrangementSource === 'ai' && aiVersion ? aiVersion : activeSong
  const displayedSongId = displayedSong?.id ?? null

  const isBookmarked = useMemo(() => {
    if (!displayedSongId) return false
    return bookmarks.some((song) => song.id === displayedSongId)
  }, [bookmarks, displayedSongId])

  const handleSearch = async (event) => {
    event.preventDefault()
    if (!searchQuery.trim()) return

    setSearchState('loading')
    setSearchError('')
    setAiVersion(null)
    setArrangementSource('original')

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/songs?query=${encodeURIComponent(searchQuery.trim())}`,
      )

      if (!response.ok) {
        throw new Error('Unable to scrape chords right now')
      }

      const payload = await response.json()
      const normalized = normalizeSongPayload(payload?.song || payload, searchQuery.trim())

      setActiveSong(normalized)
      setChordFocus(null)
    } catch (error) {
      setSearchError(error.message || 'Scrape failed. Try another query.')
    } finally {
      setSearchState('idle')
    }
  }

  const toggleBookmark = () => {
    if (!displayedSong) return
    setBookmarks((prev) => {
      if (isBookmarked) {
        return prev.filter((song) => song.id !== displayedSong.id)
      }
      return [...prev, displayedSong]
    })
  }

  const loadBookmark = (song) => {
    const normalized = normalizeSongPayload(song, song.title)
    setActiveSong(normalized)
    setArrangementSource('original')
    setAiVersion(null)
    setChordFocus(null)
  }

  const handleAiEnhance = async () => {
    const sourceSong = arrangementSource === 'ai' && aiVersion ? aiVersion : activeSong
    if (!aiPrompt.trim() || !sourceSong) return

    setAiState('loading')
    setAiError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: aiPrompt.trim(), song: sourceSong }),
      })

      if (!response.ok) {
        throw new Error('AI service is unavailable')
      }

      const payload = await response.json()
      const normalized = normalizeSongPayload(
        payload?.song || payload,
        `${sourceSong.title} · AI`,
      )

      setAiVersion(normalized)
      setArrangementSource('ai')
    } catch (error) {
      setAiError(error.message || 'AI enhancement failed. Try again shortly.')
    } finally {
      setAiState('idle')
    }
  }

  const revertToOriginal = () => {
    setArrangementSource('original')
  }

  const tokenizeChordLine = (text = '') =>
    text
      .split(/(\s+)/)
      .filter((token) => token.length > 0)
      .map((token) => ({ text: token, isWhitespace: /^\s+$/.test(token) }))

  const handleChordClick = async (rawChord) => {
    const chordName = rawChord.trim()
    if (!chordName) return

    if (chordCache[chordName]) {
      setChordFocus({ ...chordCache[chordName], status: 'ready', error: '' })
      return
    }

    setChordFocus({ chord: chordName, status: 'loading', notes: [], diagram: '', error: '' })

    try {
      const response = await fetch(`${apiBaseUrl}/api/chords/diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chord: chordName }),
      })

      if (!response.ok) {
        let message = 'Unable to fetch chord diagram'
        try {
          const errorPayload = await response.json()
          message = errorPayload?.detail || message
        } catch (parseError) {
          // ignore
        }
        throw new Error(message)
      }

      const payload = await response.json()
      const entry = {
        chord: chordName,
        notes: payload.notes || [],
        diagram: payload.diagram || '',
      }
      setChordCache((prev) => ({ ...prev, [chordName]: entry }))
      setChordFocus({ ...entry, status: 'ready', error: '' })
    } catch (error) {
      setChordFocus({ chord: chordName, status: 'error', notes: [], diagram: '', error: error.message })
    }
  }

  const renderChordTokens = (text = '') =>
    tokenizeChordLine(text).map((token, idx) =>
      token.isWhitespace ? (
        <span className="chord-space" aria-hidden="true" key={`space-${idx}`}>
          {token.text.replace(/ /g, '\u00a0')}
        </span>
      ) : (
        <button
          type="button"
          className="chord-token"
          key={`chord-${token.text}-${idx}`}
          onClick={() => handleChordClick(token.text)}
        >
          {token.text}
        </button>
      ),
    )

  const metaValue = (value, fallback = '—') => (value && value !== '' ? value : fallback)

  const hasSections = Boolean(displayedSong?.sections?.length)
  const chordPalette = useMemo(() => {
    if (!displayedSong?.chords) return []
    const seen = new Set()
    return displayedSong.chords.filter((chord) => {
      const normalized = chord?.trim()
      if (!normalized || seen.has(normalized)) {
        return false
      }
      seen.add(normalized)
      return true
    })
  }, [displayedSong?.chords])

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <div className="logo-mark">HX</div>
          <div>
            <p className="eyebrow">HarmoniX Studio</p>
            <h1>Chord Intelligence</h1>
          </div>
        </div>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search artist, song, or riff..."
            aria-label="Search song to scrape"
          />
          <button type="submit" className="action primary" disabled={searchState === 'loading'}>
            {searchState === 'loading' ? 'Scraping...' : 'Scrape'}
          </button>
        </form>
      </header>

      {searchError && <p className="status-pill error">{searchError}</p>}

      <div className="content-grid">
        <section className="sheet-panel">
          <div className="sheet-header">
            <div>
              <p className="eyebrow">
                Chord Sheet{displayedSong?.source ? ` · ${displayedSong.source}` : ''}
              </p>
              <h2 className="song-title">{displayedSong?.title || 'Waiting for a scrape'}</h2>
              <p className="subtitle">
                {displayedSong?.artist || 'Search for a song or load a bookmark to get started.'}
              </p>
            </div>
            <div className="sheet-actions">
              {arrangementSource === 'ai' && aiVersion && (
                <span className="status-pill accent">AI arrangement</span>
              )}
              <button className="action ghost" type="button" onClick={toggleBookmark} disabled={!displayedSong}>
                {isBookmarked ? 'Remove bookmark' : 'Save to bookmarks'}
              </button>
              {arrangementSource === 'ai' && aiVersion && (
                <button className="action text" type="button" onClick={revertToOriginal}>
                  Back to original
                </button>
              )}
            </div>
          </div>

          <div className="meta-chips">
            <span>Key · {metaValue(displayedSong?.key)}</span>
            <span>BPM · {metaValue(displayedSong?.bpm)}</span>
            <span>Tuning · {metaValue(displayedSong?.tuning, 'Standard')}</span>
            <span>Updated · {metaValue(displayedSong?.lastSynced, '—')}</span>
          </div>

          <div className="tag-row">
            {displayedSong?.tags?.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>

          <div className={`sheet-body ${hasSections ? '' : 'sheet-empty'}`}>
            {hasSections ? (
              displayedSong.sections.map((section, sectionIdx) => (
                <div className="sheet-section" key={`${section.label}-${sectionIdx}`}>
                  <p className="section-label">{section.label}</p>
                  {section.lines?.map((line, idx) => (
                    <div className="line-block" key={`${section.label}-${sectionIdx}-${idx}`}>
                      {line.chords && (
                        <div className="line-chords" role="text">
                          {renderChordTokens(line.chords)}
                        </div>
                      )}
                      {line.lyrics && <pre className="line-lyrics">{line.lyrics}</pre>}
                      {!line.chords && !line.lyrics && <div className="line-spacer" aria-hidden="true" />}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="muted sheet-placeholder">
                Scrape a song or load one of your bookmarks to see chords and lyrics.
              </p>
            )}
          </div>

          {displayedSong?.notes && <p className="notes">{displayedSong.notes}</p>}

          {(chordPalette.length > 0 || chordFocus) && (
            <div className="chord-helper">
              <div className="helper-header">
                <div>
                  <p className="eyebrow">Chord Explorer</p>
                  <p className="helper-title">{chordFocus?.chord || 'Tap a chord'}</p>
                </div>
                {chordFocus && (
                  <button className="action text" type="button" onClick={() => setChordFocus(null)}>
                    Clear
                  </button>
                )}
              </div>
              {chordPalette.length > 0 && (
                <div className="chord-palette">
                  {chordPalette.slice(0, 12).map((chord) => (
                    <button
                      className="chord-pill"
                      type="button"
                      key={chord}
                      onClick={() => handleChordClick(chord)}
                    >
                      {chord}
                    </button>
                  ))}
                </div>
              )}
              {chordFocus?.status === 'loading' && (
                <p className="muted helper-status">Rendering {chordFocus.chord}...</p>
              )}
              {chordFocus?.status === 'error' && (
                <p className="status-pill error compact">{chordFocus.error}</p>
              )}
              {chordFocus?.status === 'ready' && (
                <div className="helper-body">
                  {chordFocus.notes?.length > 0 && (
                    <p className="helper-notes">Notes: {chordFocus.notes.join(', ')}</p>
                  )}
                  {chordFocus.diagram && (
                    <img
                      src={`data:image/png;base64,${chordFocus.diagram}`}
                      alt={`Piano voicing for ${chordFocus.chord}`}
                    />
                  )}
                </div>
              )}
              {!chordFocus && <p className="muted helper-status">Tap any chord to preview a voicing.</p>}
            </div>
          )}

          <div className="bookmark-drawer">
            <div className="drawer-header">
              <p className="eyebrow">Bookmarks</p>
              <span>{bookmarks.length} saved</span>
            </div>
            <div className="bookmark-stack">
              {bookmarks.length === 0 && <p className="muted">Nothing saved yet.</p>}
              {bookmarks.map((song) => (
                <button
                  className="bookmark-card"
                  key={song.id}
                  type="button"
                  onClick={() => loadBookmark(song)}
                >
                  <div>
                    <p className="bookmark-title">{song.title}</p>
                    <p className="bookmark-artist">{song.artist}</p>
                  </div>
                  <span className="bookmark-meta">{song.key}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="ai-panel">
          <p className="eyebrow">AI Enhancement</p>
          <h3>Reharmonize or re-arrange</h3>
          <p className="muted">
            Ask HarmoniX to reharmonize, change genre, simplify chords, or tailor it for your band setup.
          </p>

          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="e.g. Turn this into a bossa nova ballad in Gmaj7 with lush passing chords."
            rows={6}
          />

          <button
            className="action primary full"
            type="button"
            onClick={handleAiEnhance}
            disabled={aiState === 'loading' || !activeSong}
          >
            {aiState === 'loading' ? 'Composing...' : 'Generate AI take'}
          </button>

          {aiError && <p className="status-pill error compact">{aiError}</p>}

          {aiVersion && (
            <div className="ai-preview">
              <div className="preview-header">
                <div>
                  <p className="eyebrow">AI Draft</p>
                  <p className="preview-title">{aiVersion.title}</p>
                </div>
                <button className="action ghost" type="button" onClick={() => setArrangementSource('ai')}>
                  Apply
                </button>
              </div>
              <div className="preview-body">
                {aiVersion.sections?.slice(0, 2).map((section, sectionIdx) => (
                  <div className="preview-section" key={`${section.label}-${sectionIdx}`}>
                    <p className="preview-label">{section.label}</p>
                    {section.lines?.slice(0, 2).map((line, lineIdx) => (
                      <pre key={`${section.label}-${sectionIdx}-preview-${lineIdx}`}>
                        {line.chords}
                        {line.chords && line.lyrics ? ' — ' : ''}
                        {line.lyrics}
                      </pre>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App
