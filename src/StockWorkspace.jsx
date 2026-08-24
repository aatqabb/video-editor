import { useMemo, useState } from 'react'
import { getStockApiKeys, getStockProviderStatus, registerStockDownload, saveStockApiKeys, searchStockVideos } from './stockApi'
import './ScriptWorkspace.css'

export default function StockWorkspace({ notify, onImportStock }) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('All')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [showKeys, setShowKeys] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => getStockApiKeys())
  const [statusVersion, setStatusVersion] = useState(0)
  const providerStatus = useMemo(() => getStockProviderStatus(), [statusVersion])
  const providerCounts = useMemo(() => items.reduce((counts, item) => ({ ...counts, [item.provider]: (counts[item.provider] || 0) + 1 }), {}), [items])

  const runSearch = async () => {
    const clean = query.trim(); if (!clean) return notify('Type a stock search query first')
    setLoading(true); setError('')
    try {
      const results = await searchStockVideos(clean, provider)
      setItems(results); setPreview(results[0] || null); notify(`${results.length} stock items found`)
    } catch (searchError) {
      const message = searchError?.message || 'Stock search failed'
      setError(message); setItems([]); setPreview(null); notify(message)
    } finally { setLoading(false) }
  }

  const saveKeys = () => {
    saveStockApiKeys(apiKeys); setStatusVersion((value) => value + 1); setShowKeys(false); notify('Stock API keys saved on this browser')
  }

  const importResult = async (result) => {
    await registerStockDownload(result)
    onImportStock(result)
  }

  const downloadResult = async (result) => {
    await registerStockDownload(result)
    const anchor = document.createElement('a'); anchor.href = result.downloadUrl || result.fileUrl; anchor.target = '_blank'; anchor.rel = 'noreferrer'
    anchor.download = `${result.provider}-${result.sourceId}.${result.mediaType === 'image' ? 'jpg' : 'mp4'}`
    document.body.appendChild(anchor); anchor.click(); anchor.remove()
  }

  return (
    <div className="script-workspace stock-only-workspace">
      <div className="script-toolbar">
        <strong>PEXELS + PIXABAY + COVERR + UNSPLASH</strong>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option>All</option><option>Pexels</option><option>Pixabay</option><option>Coverr</option><option>Unsplash</option>
        </select>
        <button onClick={() => setShowKeys((value) => !value)}>API Keys</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.pexels ? 'api-ready' : 'api-missing'}>Pexels {providerStatus.pexels ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.pixabay ? 'api-ready' : 'api-missing'}>Pixabay {providerStatus.pixabay ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.coverr ? 'api-ready' : 'api-missing'}>Coverr {providerStatus.coverr ? 'ready' : 'key missing'}</span>
        <span className={providerStatus.unsplash ? 'api-ready' : 'api-missing'}>Unsplash {providerStatus.unsplash ? 'ready' : 'key missing'}</span>
      </div>

      {showKeys && (
        <div className="api-key-panel">
          <label><span>Pexels API key</span><input type="password" value={apiKeys.pexels || ''} onChange={(e) => setApiKeys((k) => ({ ...k, pexels: e.target.value }))} /></label>
          <label><span>Pixabay API key</span><input type="password" value={apiKeys.pixabay || ''} onChange={(e) => setApiKeys((k) => ({ ...k, pixabay: e.target.value }))} /></label>
          <label><span>Coverr API key</span><input type="password" value={apiKeys.coverr || ''} onChange={(e) => setApiKeys((k) => ({ ...k, coverr: e.target.value }))} /></label>
          <label><span>Unsplash Access Key</span><input type="password" value={apiKeys.unsplash || ''} onChange={(e) => setApiKeys((k) => ({ ...k, unsplash: e.target.value }))} /></label>
          <div className="api-key-actions"><button className="api-save-btn" onClick={saveKeys}>Save Keys</button><button onClick={() => setShowKeys(false)}>Cancel</button></div>
        </div>
      )}

      <div className="script-query-row stock-search-row">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} placeholder="Search stock media" />
        <button className="search-stock-btn" onClick={runSearch} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </div>
      {error && <div className="stock-error">{error}</div>}
      {!!items.length && <div className="api-status-row">{Object.entries(providerCounts).map(([name, count]) => <span className="api-ready" key={name}>{name}: {count}</span>)}</div>}

      {!!items.length && <div className="stock-results-strip">{items.map((result) => (
        <div className="stock-result-card" key={result.id} draggable onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-video-editor-stock', JSON.stringify(result)); event.dataTransfer.setData('text/plain', `stock:${result.id}`)
        }}>
          <button className="stock-thumb-button" onClick={() => setPreview(result)}>
            {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span className="stock-thumb-placeholder">▶</span>}
            <span className="stock-provider">{result.provider}</span><span className="stock-duration">{result.mediaType === 'image' ? 'PHOTO' : `${Math.round(result.duration)}s`}</span>
          </button>
          <div className="stock-card-actions"><button onClick={() => setPreview(result)}>Preview</button><button onClick={() => importResult(result)}>Import</button><button onClick={() => downloadResult(result)}>Download</button></div>
          {result.pageUrl && <a className="stock-source-link" href={result.pageUrl} target="_blank" rel="noreferrer">{result.author} · {result.provider}</a>}
        </div>
      ))}</div>}

      {preview && <div className="stock-preview-dock">
        <div className="stock-preview-head"><strong>{preview.provider} preview</strong><button onClick={() => setPreview(null)}>✕</button></div>
        {preview.mediaType === 'image' ? <img src={preview.fileUrl} alt={preview.title || ''} /> : <video key={preview.fileUrl} src={preview.fileUrl} poster={preview.thumbnail} controls autoPlay />}
        <div className="stock-preview-meta"><span>{preview.author}</span><span>{preview.width}×{preview.height}</span><button onClick={() => importResult(preview)}>Import to Timeline</button></div>
      </div>}
    </div>
  )
}
