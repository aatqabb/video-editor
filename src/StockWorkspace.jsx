import { useMemo, useState } from 'react'
import {
  getStockApiKeys,
  getStockProviderStatus,
  saveStockApiKeys,
  searchStockVideos,
} from './stockApi'
import './ScriptWorkspace.css'

export default function StockWorkspace({ notify, onImportStock }) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('Both')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [showKeys, setShowKeys] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => getStockApiKeys())
  const [statusVersion, setStatusVersion] = useState(0)
  const providerStatus = useMemo(() => getStockProviderStatus(), [statusVersion])

  const runSearch = async () => {
    const clean = query.trim()
    if (!clean) return notify('Type a stock search query first')
    setLoading(true)
    setError('')
    try {
      const results = await searchStockVideos(clean, provider)
      setItems(results)
      setPreview(results[0] || null)
      notify(`${results.length} stock videos found`)
    } catch (searchError) {
      const message = searchError?.message || 'Stock search failed'
      setError(message)
      setItems([])
      setPreview(null)
      notify(message)
    } finally {
      setLoading(false)
    }
  }

  const saveKeys = () => {
    saveStockApiKeys(apiKeys)
    setStatusVersion((value) => value + 1)
    setShowKeys(false)
    notify('Stock API keys saved on this browser')
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
  }

  return (
    <div className="script-workspace stock-only-workspace">
      <div className="script-toolbar">
        <strong>PEXELS + PIXABAY</strong>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option>Both</option>
          <option>Pexels</option>
          <option>Pixabay</option>
        </select>
        <button onClick={() => setShowKeys((value) => !value)}>API Keys</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.pexels ? 'api-ready' : 'api-missing'}>Pexels {providerStatus.pexels ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.pixabay ? 'api-ready' : 'api-missing'}>Pixabay {providerStatus.pixabay ? 'ready' : 'key missing'}</span>
      </div>

      {showKeys && (
        <div className="api-key-panel">
          <label><span>Pexels API key</span><input type="password" value={apiKeys.pexels} onChange={(event) => setApiKeys((keys) => ({ ...keys, pexels: event.target.value }))} autoComplete="off" /></label>
          <label><span>Pixabay API key</span><input type="password" value={apiKeys.pixabay} onChange={(event) => setApiKeys((keys) => ({ ...keys, pixabay: event.target.value }))} autoComplete="off" /></label>
          <div className="api-key-actions"><button className="api-save-btn" onClick={saveKeys}>Save Keys</button><button onClick={() => setShowKeys(false)}>Cancel</button></div>
        </div>
      )}

      <div className="script-query-row stock-search-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} placeholder="Search Pexels + Pixabay" />
        <button className="search-stock-btn" onClick={runSearch} disabled={loading}>{loading ? 'Searching…' : 'Search Videos'}</button>
      </div>

      {error && <div className="stock-error">{error}</div>}

      {!!items.length && (
        <div className="stock-results-strip">
          {items.map((result) => (
            <div className="stock-result-card" key={result.id} draggable onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData('application/x-video-editor-stock', JSON.stringify(result))
              event.dataTransfer.setData('text/plain', `stock:${result.id}`)
            }}>
              <button className="stock-thumb-button" onClick={() => setPreview(result)}>
                {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span className="stock-thumb-placeholder">▶</span>}
                <span className="stock-provider">{result.provider}</span>
                <span className="stock-duration">{Math.round(result.duration)}s</span>
              </button>
              <div className="stock-card-actions">
                <button onClick={() => setPreview(result)}>Preview</button>
                <button onClick={() => onImportStock(result)}>Import</button>
                <button onClick={() => downloadResult(result)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="stock-preview-dock">
          <div className="stock-preview-head"><strong>{preview.provider} preview</strong><button onClick={() => setPreview(null)}>✕</button></div>
          <video key={preview.fileUrl} src={preview.fileUrl} poster={preview.thumbnail} controls autoPlay />
          <div className="stock-preview-meta"><span>{preview.author}</span><span>{preview.width}×{preview.height}</span><button onClick={() => onImportStock(preview)}>Import to Timeline</button></div>
        </div>
      )}
    </div>
  )
}
