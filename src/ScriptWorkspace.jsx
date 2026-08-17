import { useState } from 'react'
import { getStockProviderStatus, makeSearchQuery, searchStockVideos, splitScriptText } from './stockApi'
import './ScriptWorkspace.css'

function makeLine(line, index = 0) {
  return {
    id: `script-line-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 6)}`,
    text: line,
    query: makeSearchQuery(line),
  }
}

export default function ScriptWorkspace({ notify, onImportStock }) {
  const initialScript = `Across history, people have worshipped mountains.
They've worshipped rivers.
Animals.
Stars.`

  const [script, setScript] = useState(initialScript)
  const [provider, setProvider] = useState('Both')
  const [lines, setLines] = useState(() => splitScriptText(initialScript).map(makeLine))
  const [searchState, setSearchState] = useState({})
  const [preview, setPreview] = useState(null)
  const providerStatus = getStockProviderStatus()

  const splitIntoLines = () => {
    const nextLines = splitScriptText(script).map(makeLine)
    setLines(nextLines)
    setSearchState({})
    setPreview(null)
    notify(`${nextLines.length} editable script lines created`)
  }

  const updateLine = (id, field, value) => {
    setLines((items) => items.map((line) => line.id === id ? { ...line, [field]: value } : line))
  }

  const regenerateQuery = (id) => {
    setLines((items) => items.map((line) => line.id === id ? { ...line, query: makeSearchQuery(line.text) } : line))
    notify('Search query regenerated')
  }

  const addLine = () => {
    setLines((items) => [...items, makeLine('', items.length)])
  }

  const deleteLine = (id) => {
    setLines((items) => items.filter((line) => line.id !== id))
    setSearchState((state) => {
      const next = { ...state }
      delete next[id]
      return next
    })
  }

  const moveLine = (id, direction) => {
    setLines((items) => {
      const index = items.findIndex((line) => line.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items
      const next = [...items]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const searchLine = async (line) => {
    const query = line.query.trim()
    if (!query) return notify('Add a search query first')

    setSearchState((state) => ({ ...state, [line.id]: { loading: true, items: [], error: '' } }))
    try {
      const items = await searchStockVideos(query, provider)
      const tagged = items.map((item) => ({ ...item, sourceLineId: line.id }))
      setSearchState((state) => ({ ...state, [line.id]: { loading: false, items: tagged, error: '' } }))
      notify(`${tagged.length} stock videos found`)
    } catch (error) {
      setSearchState((state) => ({
        ...state,
        [line.id]: { loading: false, items: [], error: error?.message || 'Stock search failed' },
      }))
    }
  }

  const searchAll = async () => {
    for (const line of lines) {
      if (line.query.trim()) {
        await searchLine(line)
        await new Promise((resolve) => window.setTimeout(resolve, 180))
      }
    }
  }

  const downloadResult = (result) => {
    const anchor = document.createElement('a')
    anchor.href = result.fileUrl
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    anchor.download = `${result.provider}-${result.sourceId}.mp4`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    notify('Download opened')
  }

  return (
    <div className="script-workspace">
      <div className="script-toolbar">
        <strong>SCRIPT → STOCK</strong>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option>Both</option>
          <option>Pexels</option>
          <option>Pixabay</option>
        </select>
        <button onClick={searchAll}>Search All</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.pexels ? 'api-ready' : 'api-missing'}>
          Pexels {providerStatus.pexels ? 'ready' : 'key missing'}
        </span>
        <span className={providerStatus.pixabay ? 'api-ready' : 'api-missing'}>
          Pixabay {providerStatus.pixabay ? 'ready' : 'key missing'}
        </span>
        <span className="api-hint">Keys go in .env.local — never commit them.</span>
      </div>

      <textarea
        className="full-script-input"
        value={script}
        onChange={(event) => setScript(event.target.value)}
        placeholder="Paste full script here..."
      />

      <div className="script-actions">
        <button onClick={splitIntoLines}>Split into Lines</button>
        <button onClick={addLine}>+ Add Line</button>
      </div>

      <div className="script-lines">
        {lines.map((line, index) => {
          const state = searchState[line.id] || {}
          return (
            <article className="script-line-card" key={line.id}>
              <div className="script-line-main">
                <span className="script-line-number">{index + 1}</span>
                <textarea
                  value={line.text}
                  onChange={(event) => updateLine(line.id, 'text', event.target.value)}
                  placeholder="Editable script line"
                />
                <div className="script-line-buttons">
                  <button onClick={() => moveLine(line.id, -1)} title="Move up">↑</button>
                  <button onClick={() => moveLine(line.id, 1)} title="Move down">↓</button>
                  <button onClick={() => deleteLine(line.id)} title="Delete line">✕</button>
                </div>
              </div>

              <div className="script-query-row">
                <input
                  value={line.query}
                  onChange={(event) => updateLine(line.id, 'query', event.target.value)}
                  placeholder="Editable stock search query"
                />
                <button onClick={() => regenerateQuery(line.id)} title="Regenerate from script line">↻</button>
                <button className="search-stock-btn" onClick={() => searchLine(line)}>Search</button>
              </div>

              {state.loading && <div className="stock-message">Searching {provider}…</div>}
              {state.error && <div className="stock-error">{state.error}</div>}

              {!!state.items?.length && (
                <div className="stock-results-strip">
                  {state.items.map((result) => (
                    <div
                      className="stock-result-card"
                      key={result.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData('application/x-video-editor-stock', JSON.stringify(result))
                        event.dataTransfer.setData('text/plain', `stock:${result.id}`)
                      }}
                    >
                      <button className="stock-thumb-button" onClick={() => setPreview(result)}>
                        {result.thumbnail
                          ? <img src={result.thumbnail} alt="" />
                          : <span className="stock-thumb-placeholder">▶</span>}
                        <span className="stock-provider">{result.provider}</span>
                        <span className="stock-duration">{Math.round(result.duration)}s</span>
                      </button>
                      <div className="stock-card-actions">
                        <button onClick={() => setPreview(result)}>Preview</button>
                        <button onClick={() => onImportStock(result, line.id)}>Import</button>
                        <button onClick={() => downloadResult(result)}>Download</button>
                      </div>
                      <button
                        className="stock-source-link"
                        onClick={() => window.open(result.pageUrl, '_blank', 'noopener,noreferrer')}
                      >
                        {result.author} · {result.provider}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {preview && (
        <div className="stock-preview-dock">
          <div className="stock-preview-head">
            <strong>{preview.provider} preview</strong>
            <button onClick={() => setPreview(null)}>✕</button>
          </div>
          <video key={preview.fileUrl} src={preview.fileUrl} poster={preview.thumbnail} controls autoPlay />
          <div className="stock-preview-meta">
            <span>{preview.author}</span>
            <span>{preview.width}×{preview.height}</span>
            <button onClick={() => onImportStock(preview, preview.sourceLineId)}>Import to Timeline</button>
          </div>
        </div>
      )}
    </div>
  )
}
