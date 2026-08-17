import { useMemo, useRef, useState } from 'react'
import { formatMediaDuration, processMediaFiles } from './mediaProcessing'
import './MediaLibrary.css'

const filters = ['All', 'Video', 'Audio', 'Image']

function Waveform({ peaks = [] }) {
  if (!peaks.length) return <span className="media-waveform-empty">▥</span>
  return (
    <span className="media-waveform" aria-hidden="true">
      {peaks.slice(0, 48).map((peak, index) => <i key={index} style={{ height: `${Math.max(8, peak * 92)}%` }} />)}
    </span>
  )
}

export default function MediaLibrary({ items, setItems, onAddMedia, notify }) {
  const fileRef = useRef(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [processing, setProcessing] = useState('')
  const [preview, setPreview] = useState(null)

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesText = item.name.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All' || item.type === filter.toLowerCase()
    return matchesText && matchesFilter
  }), [items, query, filter])

  const importFiles = async (files) => {
    if (!files?.length) return
    setProcessing(`Processing 0 / ${files.length}`)
    const imported = await processMediaFiles(files, (done, total) => setProcessing(`Processing ${done} / ${total}`))
    setItems((current) => [...current, ...imported])
    setProcessing('')
    notify(`${imported.length} media file${imported.length === 1 ? '' : 's'} imported`)
  }

  const removeItem = (item) => {
    if (item.localUrl?.startsWith('blob:')) URL.revokeObjectURL(item.localUrl)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    if (preview?.id === item.id) setPreview(null)
  }

  return (
    <div
      className="real-media-library"
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files?.length) {
          event.preventDefault()
          importFiles(event.dataTransfer.files)
        }
      }}
    >
      <div className="media-library-head">
        <strong>MEDIA</strong>
        <button onClick={() => fileRef.current?.click()}>＋ Import</button>
        <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" hidden onChange={(event) => importFiles(event.target.files)} />
      </div>

      <div className="media-library-search">
        <input placeholder="Search media" value={query} onChange={(event) => setQuery(event.target.value)} />
        <span>{items.length} items</span>
      </div>

      <div className="media-filter-row">
        {filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
      </div>

      {processing && <div className="media-processing">{processing} · thumbnails/waveforms generating…</div>}

      {!items.length && (
        <button className="media-drop-zone" onClick={() => fileRef.current?.click()}>
          <strong>Drop video, audio or images here</strong>
          <span>or click to choose multiple files</span>
        </button>
      )}

      <div className="real-media-grid">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="real-media-card"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData('application/x-video-editor-media', JSON.stringify(item))
              event.dataTransfer.setData('text/plain', `media:${item.id}`)
            }}
            onDoubleClick={() => onAddMedia(item)}
          >
            <button className={`real-media-thumb ${item.type}`} onClick={() => setPreview(item)} title="Preview">
              {item.type === 'video' && item.thumbnail && <img src={item.thumbnail} alt="" />}
              {item.type === 'image' && item.thumbnail && <img src={item.thumbnail} alt="" />}
              {item.type === 'audio' && <Waveform peaks={item.waveform} />}
              {!item.thumbnail && item.type !== 'audio' && <span className="media-type-placeholder">{item.type === 'video' ? '▶' : '▧'}</span>}
              <span className="real-media-type">{item.type}</span>
            </button>
            <div className="real-media-info">
              <span title={item.name}>{item.name}</span>
              <small>{formatMediaDuration(item.duration)}{item.width ? ` · ${item.width}×${item.height}` : ''}</small>
            </div>
            <div className="real-media-actions">
              <button onClick={() => onAddMedia(item)}>Add</button>
              <button onClick={() => setPreview(item)}>Preview</button>
              <button onClick={() => removeItem(item)}>✕</button>
            </div>
            {item.processingError && <div className="media-card-warning" title={item.processingError}>metadata warning</div>}
          </article>
        ))}
      </div>

      {preview && (
        <div className="media-preview-dock">
          <div className="media-preview-head"><strong>{preview.name}</strong><button onClick={() => setPreview(null)}>✕</button></div>
          {preview.type === 'video' && <video key={preview.localUrl} src={preview.localUrl} controls autoPlay />}
          {preview.type === 'audio' && <audio key={preview.localUrl} src={preview.localUrl} controls autoPlay />}
          {preview.type === 'image' && <img src={preview.localUrl} alt="" />}
          <div className="media-preview-actions"><span>{formatMediaDuration(preview.duration)}</span><button onClick={() => onAddMedia(preview)}>Add to Timeline</button></div>
        </div>
      )}
    </div>
  )
}
