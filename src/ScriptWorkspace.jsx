import { useRef, useState } from 'react'
import {
  clearStockApiKeys,
  getStockApiKeys,
  getStockProviderStatus,
  makeSearchQuery,
  saveStockApiKeys,
  searchStockVideos,
  splitScriptText,
} from './stockApi'
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
  const [provider, setProvider] = useState('All')
  const [lines, setLines] = useState(() => splitScriptText(initialScript).map(makeLine))
  const [searchState, setSearchState] = useState({})
  const [preview, setPreview] = useState(null)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => getStockApiKeys())
  const autoSplitTimerRef = useRef(null)
  const providerStatus = getStockProviderStatus()

  const saveApiSettings = () => {
    const status = saveStockApiKeys(apiKeys)
    setApiKeys(getStockApiKeys())
    setShowApiKeys(false)
    notify(`Stock APIs saved: ${status.pexels ? 'Pexels ' : ''}${status.pixabay ? 'Pixabay' : ''}`.trim())
  }

  const clearApiSettings = () => {
    clearStockApiKeys()
    setApiKeys({ pexels: '', pixabay: '', coverr: '', unsplash: '' })
    notify('Saved stock API keys cleared')
  }

  const updateLine = (id, field, value) => {
    setLines((items) => items.map((line) => line.id === id ? { ...line, [field]: value } : line))
  }

  const regenerateQuery = (id) => {
    setLines((items) => items.map((line) => line.id === id ? { ...line, query: makeSearchQuery(line.text) } : line))
    notify('Search query regenerated')
  }

  const addLine = () => setLines((items) => [...items, makeLine('', items.length)])

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

  const searchLine = async (line, quiet = false) => {
    const query = line.query.trim()
    if (!query) {
      if (!quiet) notify('Add a search query first')
      return
    }

    setSearchState((state) => ({ ...state, [line.id]: { loading: true, items: [], error: '' } }))
    try {
      const items = await searchStockVideos(query, provider)
      const tagged = items.map((item) => ({ ...item, sourceLineId: line.id }))
      setSearchState((state) => ({ ...state, [line.id]: { loading: false, items: tagged, error: '' } }))
      if (!quiet) notify(`${tagged.length} stock items found`)
    } catch (error) {
      setSearchState((state) => ({
        ...state,
        [line.id]: { loading: false, items: [], error: error?.message || 'Stock search failed' },
      }))
    }
  }

  const searchLinesSequentially = async (items, quiet = true) => {
    for (const line of items) {
      if (!line.query.trim()) continue
      await searchLine(line, quiet)
      await new Promise((resolve) => window.setTimeout(resolve, 120))
    }
  }

  const splitIntoLines = (raw = script, autoSearch = false) => {
    const nextLines = splitScriptText(raw).map(makeLine)
    setLines(nextLines)
    setSearchState({})
    setPreview(null)
    notify(`${nextLines.length} editable script lines created${autoSearch ? ' · stock search started' : ''}`)
    if (autoSearch && nextLines.length) void searchLinesSequentially(nextLines, true)
    return nextLines
  }

  const handleScriptChange = (value) => {
    setScript(value)
    window.clearTimeout(autoSplitTimerRef.current)
    autoSplitTimerRef.current = window.setTimeout(() => {
      splitIntoLines(value, true)
    }, 500)
  }

  const searchAll = async () => {
    await searchLinesSequentially(lines, true)
    notify(`Search started for ${lines.filter((line) => line.query.trim()).length} lines`)
  }

  const downloadResult = (result) => {
    const anchor = document.createElement('a')
    anchor.href = result.downloadUrl || result.fileUrl
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    anchor.download = `${result.provider}-${result.sourceId}.${result.mediaType === 'image' ? 'jpg' : 'mp4'}`
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
          <option>All</option>
          <option>Both</option>
          <option>Pexels</option>
          <option>Pixabay</option>
          <option>Coverr</option>
          <option>Unsplash</option>
        </select>
        <button onClick={() => setShowApiKeys((value) => !value)}>API Keys</button>
        <button onClick={searchAll}>Search All</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.pexels ? 'api-ready' : 'api-missing'}>Pexels {providerStatus.pexels ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.pixabay ? 'api-ready' : 'api-missing'}>Pixabay {providerStatus.pixabay ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.coverr ? 'api-ready' : 'api-missing'}>Coverr {providerStatus.coverr ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.unsplash ? 'api-ready' : 'api-missing'}>Unsplash {providerStatus.unsplash ? 'ready' : 'key missing'}</span>
        <span className="api-hint">Paste/edit script → lines split and search automatically.</span>
      </div>

      {showApiKeys && (
        <div className="api-key-panel">
          <label><span>Pexels API key</span><input type="password" value={apiKeys.pexels || ''} onChange={(event) => setApiKeys((keys) => ({ ...keys, pexels: event.target.value }))} autoComplete="off" /></label>
          <label><span>Pixabay API key</span><input type="password" value={apiKeys.pixabay || ''} onChange={(event) => setApiKeys((keys) => ({ ...keys, pixabay: event.target.value }))} autoComplete="off" /></label>
          <label><span>Coverr API key</span><input type="password" value={apiKeys.coverr || ''} onChange={(event) => setApiKeys((keys) => ({ ...keys, coverr: event.target.value }))} autoComplete="off" /></label>
          <label><span>Unsplash Access Key</span><input type="password" value={apiKeys.unsplash || ''} onChange={(event) => setApiKeys((keys) => ({ ...keys, unsplash: event.target.value }))} autoComplete="off" /></label>
          <div className="api-key-actions">
            <button className="api-save-btn" onClick={saveApiSettings}>Save Keys</button>
            <button onClick={clearApiSettings}>Clear Saved</button>
            <button onClick={() => setShowApiKeys(false)}>Cancel</button>
          </div>
        </div>
      )}

      <textarea
        className="full-script-input"
        value={script}
        onChange={(event) => handleScriptChange(event.target.value)}
        placeholder="Paste full script here — it will auto split and start searching..."
      />

      <div className="script-actions">
        <button onClick={() => splitIntoLines(script, true)}>Split + Auto Search</button>
        <button onClick={addLine}>+ Add Line</button>
      </div>

      <div className="script-lines">
        {lines.map((line, index) => {
          const state = searchState[line.id] || {}
          return (
            <article className="script-line-card" key={line.id}>
              <div className="script-line-main">
                <span className="script-line-number">{index + 1}</span>
                <textarea value={line.text} onChange={(event) => updateLine(line.id, 'text', event.target.value)} placeholder="Editable script line" />
                <div className="script-line-buttons">
                  <button onClick={() => moveLine(line.id, -1)} title="Move up">↑</button>
                  <button onClick={() => moveLine(line.id, 1)} title="Move down">↓</button>
                  <button onClick={() => deleteLine(line.id)} title="Delete line">✕</button>
                </div>
              </div>

              <div className="script-query-row">
                <input value={line.query} onChange={(event) => updateLine(line.id, 'query', event.target.value)} placeholder="Editable stock search query" />
                <button onClick={() => regenerateQuery(line.id)} title="Regenerate from script line">↻</button>
                <button className="search-stock-btn" onClick={() => searchLine(line)}>Search</button>
              </div>

              {state.loading && <div className="stock-message">Searching {provider}…</div>}
              {state.error && <div className="stock-error">{state.error}</div>}

              {!!state.items?.length && (
                <div className="stock-results-strip">
                  {state.items.map((result) => (
                    <div className="stock-result-card" key={result.id} draggable onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy'
                      event.dataTransfer.setData('application/x-video-editor-stock', JSON.stringify(result))
                      event.dataTransfer.setData('text/plain', `stock:${result.id}`)
                    }}>
                      <button className="stock-thumb-button" onClick={() => setPreview(result)}>
                        {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span className="stock-thumb-placeholder">▶</span>}
                        <span className="stock-provider">{result.provider}</span>
                        <span className="stock-duration">{result.mediaType === 'image' ? 'PHOTO' : `${Math.round(result.duration)}s`}</span>
                      </button>
                      <div className="stock-card-actions">
                        <button onClick={() => setPreview(result)}>Preview</button>
                        <button onClick={() => onImportStock(result, line.id)}>Import</button>
                        <button onClick={() => downloadResult(result)}>Download</button>
                      </div>
                      <button className="stock-source-link" onClick={() => window.open(result.pageUrl, '_blank', 'noopener,noreferrer')}>
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
          <div className="stock-preview-head"><strong>{preview.provider} preview</strong><button onClick={() => setPreview(null)}>✕</button></div>
          {preview.mediaType === 'image'
            ? <img src={preview.fileUrl} alt={preview.title || ''} />
            : <video key={preview.fileUrl} src={preview.fileUrl} poster={preview.thumbnail} controls autoPlay />}
          <div className="stock-preview-meta">
            <span>{preview.author}</span><span>{preview.width}×{preview.height}</span>
            <button onClick={() => onImportStock(preview, preview.sourceLineId)}>Import to Timeline</button>
          </div>
        </div>
      )}
    </div>
  )
}
