import { useRef, useState } from 'react'
import { splitScriptText } from './stockApi'
import {
  clearYoutubeApiKey,
  findFootageForLine,
  getYoutubeApiKey,
  getYoutubeProviderStatus,
  saveYoutubeApiKey,
} from './youtubeApi'
import './ScriptWorkspace.css'
import './FootageFinderWorkspace.css'

function makeLine(text, index = 0) {
  return {
    id: `footage-line-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 6)}`,
    text,
  }
}

export default function FootageFinderWorkspace({ notify, onAddFootage }) {
  const initialScript = `In 1929, the stock market collapsed.
Thousands of people waited outside banks as they struggled to withdraw their savings.
Within a few years, unemployment had spread across the country.`

  const [script, setScript] = useState(initialScript)
  const [lines, setLines] = useState(() => splitScriptText(initialScript).map(makeLine))
  const [lineState, setLineState] = useState({})
  const [preview, setPreview] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getYoutubeApiKey())
  const providerStatus = getYoutubeProviderStatus()
  const autoSplitTimerRef = useRef(null)

  const saveApiKey = () => {
    saveYoutubeApiKey(apiKeyDraft)
    setShowApiKey(false)
    notify('YouTube API key saved on this browser')
  }

  const clearApiKey = () => {
    clearYoutubeApiKey()
    setApiKeyDraft('')
    notify('Saved YouTube API key cleared')
  }

  const splitIntoLines = (raw = script) => {
    const nextLines = splitScriptText(raw).map(makeLine)
    setLines(nextLines)
    setLineState({})
    setPreview(null)
    notify(`${nextLines.length} scene lines created`)
    return nextLines
  }

  const handleScriptChange = (value) => {
    setScript(value)
    window.clearTimeout(autoSplitTimerRef.current)
    autoSplitTimerRef.current = window.setTimeout(() => splitIntoLines(value), 500)
  }

  const findFootage = async (line) => {
    if (!getYoutubeApiKey()) {
      notify('Add your YouTube API key first')
      setShowApiKey(true)
      return
    }
    setLineState((state) => ({ ...state, [line.id]: { loading: true, results: [], concepts: [], error: '' } }))
    try {
      const { concepts, results } = await findFootageForLine(line.text)
      setLineState((state) => ({ ...state, [line.id]: { loading: false, results, concepts, error: '' } }))
      notify(results.length ? `${results.length} footage source(s) found` : 'No footage found for this line')
    } catch (error) {
      setLineState((state) => ({ ...state, [line.id]: { loading: false, results: [], concepts: [], error: error?.message || 'Footage search failed' } }))
    }
  }

  const findAll = async () => {
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop
      await findFootage(line)
    }
  }

  return (
    <div className="script-workspace footage-finder-workspace">
      <div className="script-toolbar">
        <strong>🔎 AI FOOTAGE FINDER</strong>
        <button onClick={() => setShowApiKey((value) => !value)}>API Keys</button>
        <button onClick={findAll}>Find All</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.youtube ? 'api-ready' : 'api-missing'}>YouTube {providerStatus.youtube ? 'ready' : 'key missing'}</span>
        <span className="api-hint">Paste script → scenes split automatically. Matching is free keyword/concept-based, no AI API cost.</span>
      </div>

      {showApiKey && (
        <div className="api-key-panel">
          <label>
            <span>YouTube Data API v3 key</span>
            <input type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} autoComplete="off" placeholder="Free key from Google Cloud Console" />
          </label>
          <div className="api-key-actions">
            <button className="api-save-btn" onClick={saveApiKey}>Save Key</button>
            <button onClick={clearApiKey}>Clear Saved</button>
            <button onClick={() => setShowApiKey(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="footage-disclaimer">
        Results are research references only — timestamps point at footage on YouTube. Download/license actual footage from a lawful source before using it in a final export.
      </div>

      <textarea
        className="full-script-input"
        value={script}
        onChange={(event) => handleScriptChange(event.target.value)}
        placeholder="Paste script here — it will auto-split into scenes..."
      />

      <div className="script-actions">
        <button onClick={() => splitIntoLines(script)}>Split Into Scenes</button>
      </div>

      <div className="script-lines">
        {lines.map((line, index) => {
          const state = lineState[line.id] || {}
          return (
            <article className="script-line-card footage-line-card" key={line.id}>
              <div className="footage-line-head">
                <span className="script-line-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="footage-line-text">{line.text}</div>
                <button className="search-stock-btn" onClick={() => findFootage(line)} disabled={state.loading}>
                  {state.loading ? 'Searching…' : 'Find Footage'}
                </button>
              </div>

              {!!state.concepts?.length && (
                <div className="footage-concepts">
                  {state.concepts.map((concept) => <span className="footage-concept-chip" key={concept}>{concept}</span>)}
                </div>
              )}

              {state.error && <div className="stock-error">{state.error}</div>}

              {!!state.results?.length && (
                <div className="footage-results-list">
                  {state.results.map((result, resultIndex) => (
                    <div className="footage-result-card" key={`${result.videoId}-${resultIndex}`}>
                      <button className="footage-result-thumb" onClick={() => setPreview(result)}>
                        {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span className="stock-thumb-placeholder">▶</span>}
                        <span className={`footage-match-badge ${result.matchScore >= 70 ? 'high' : result.matchScore >= 45 ? 'mid' : 'low'}`}>⭐ {result.matchScore}%</span>
                      </button>
                      <div className="footage-result-meta">
                        <span className="footage-source-label">Source {resultIndex + 1} — {result.channelTitle}</span>
                        <span className="footage-result-title">{result.title}</span>
                        <span className={result.hasTranscript ? 'footage-timestamp' : 'footage-timestamp footage-timestamp-muted'}>{result.timestampLabel}</span>
                      </div>
                      <div className="footage-result-actions">
                        <button onClick={() => setPreview(result)}>▶ Preview</button>
                        <button onClick={() => window.open(result.pageUrl, '_blank', 'noopener,noreferrer')}>↗ Open at timestamp</button>
                        <button onClick={() => onAddFootage(result, line.id)}>＋ Add to Project</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {preview && (
        <div className="stock-preview-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}>
          <div className="stock-preview-modal stock-preview-dock" role="dialog" aria-modal="true" aria-label="YouTube footage preview">
            <div className="stock-preview-head"><strong>{preview.channelTitle} · {preview.timestampLabel}</strong><button onClick={() => setPreview(null)}>✕</button></div>
            <div className="stock-preview-stage">
              <iframe
                title={preview.title}
                src={`https://www.youtube.com/embed/${preview.videoId}?start=${Math.round(preview.start || 0)}&autoplay=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <div className="stock-preview-meta">
              <span>{preview.title}</span>
              <button onClick={() => onAddFootage(preview, preview.sourceLineId)}>Add to Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
