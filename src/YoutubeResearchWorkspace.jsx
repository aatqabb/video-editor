import { useState } from 'react'
import {
  formatDurationLabel,
  looksLikeChannelInput,
  researchByChannel,
  researchByTopic,
} from './youtubeResearch'
import { getYoutubeApiKey, getYoutubeProviderStatus, saveYoutubeApiKey, clearYoutubeApiKey } from './youtubeApi'
import './ScriptWorkspace.css'
import './YoutubeResearchWorkspace.css'

function formatViews(count) {
  const value = Number(count) || 0
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function formatDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return '' }
}

export default function YoutubeResearchWorkspace({ notify }) {
  const [mode, setMode] = useState('topic')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getYoutubeApiKey())
  const providerStatus = getYoutubeProviderStatus()

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

  const runResearch = async () => {
    const clean = query.trim()
    if (!clean) return notify('Type a topic or paste a channel link first')
    if (!getYoutubeApiKey()) { setShowApiKey(true); return notify('Add your YouTube API key first') }

    setLoading(true); setError(''); setResult(null)
    try {
      const useChannel = mode === 'channel' || looksLikeChannelInput(clean)
      const data = useChannel ? await researchByChannel(clean, 30) : await researchByTopic(clean, 25)
      setResult(data)
      notify(`${data.count} video(s) analyzed`)
    } catch (requestError) {
      setError(requestError?.message || 'Research failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="script-workspace research-workspace">
      <div className="script-toolbar">
        <strong>🔎 YOUTUBE RESEARCH</strong>
        <button onClick={() => setShowApiKey((value) => !value)}>API Keys</button>
      </div>

      <div className="api-status-row">
        <span className={providerStatus.youtube ? 'api-ready' : 'api-missing'}>YouTube {providerStatus.youtube ? 'ready' : 'key missing'}</span>
        <span className="api-hint">Topic ya channel link do — views, outliers, title patterns aur keyword ideas nikalta hai. Free hai, sirf YouTube Data API key use hoti hai.</span>
      </div>

      {showApiKey && (
        <div className="api-key-panel">
          <label>
            <span>YouTube Data API v3 key</span>
            <input type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} autoComplete="off" placeholder="Same key used in Footage Finder" />
          </label>
          <div className="api-key-actions">
            <button className="api-save-btn" onClick={saveApiKey}>Save Key</button>
            <button onClick={clearApiKey}>Clear Saved</button>
            <button onClick={() => setShowApiKey(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="research-mode-row">
        <button className={mode === 'topic' ? 'active' : ''} onClick={() => setMode('topic')}>By Topic</button>
        <button className={mode === 'channel' ? 'active' : ''} onClick={() => setMode('channel')}>By Channel</button>
      </div>

      <div className="research-input-row">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && runResearch()}
          placeholder={mode === 'topic' ? 'e.g. "why people cant save money"' : 'Channel link, @handle, or channel name'}
        />
        <button className="primary" onClick={runResearch} disabled={loading}>{loading ? 'Researching…' : 'Research'}</button>
      </div>

      {error && <div className="stock-error">{error}</div>}

      {result && (
        <div className="research-results">
          <div className="research-summary-row">
            <div className="research-stat"><span>{result.mode === 'channel' ? 'Channel' : 'Topic'}</span><strong>{result.label}</strong></div>
            <div className="research-stat"><span>Videos analyzed</span><strong>{result.count}</strong></div>
            <div className="research-stat"><span>Median views</span><strong>{formatViews(result.medianViews)}</strong></div>
            <div className="research-stat"><span>Average views</span><strong>{formatViews(result.averageViews)}</strong></div>
            <div className="research-stat"><span>Outliers found</span><strong>{result.outliers.length}</strong></div>
          </div>

          <div className="research-panel">
            <h4>🔥 Outlier videos <small>(views well above this set's median — worth studying why)</small></h4>
            {!result.outliers.length && <p className="research-empty">Koi strong outlier nahi mila is batch mein.</p>}
            <div className="research-video-list">
              {result.outliers.map((video) => (
                <a className="research-video-card outlier" key={video.videoId} href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">
                  {video.thumbnail && <img src={video.thumbnail} alt="" />}
                  <div className="research-video-meta">
                    <span className="research-video-title">{video.title}</span>
                    <span className="research-video-sub">{video.channelTitle} · {formatViews(video.viewCount)} views · {video.outlierMultiple}× median</span>
                    <span className="research-video-sub muted">{formatDate(video.publishedAt)} · {formatDurationLabel(video.durationSeconds)}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="research-panel">
            <h4>📊 Title patterns</h4>
            <div className="research-pattern-row">
              <span className="research-pattern-chip">{result.titlePatterns.withNumbersPct}% titles use a number</span>
              <span className="research-pattern-chip">{result.titlePatterns.withQuestionPct}% titles ask a question</span>
              {result.titlePatterns.commonPowerWords.map((word) => <span className="research-pattern-chip highlight" key={word}>"{word}"</span>)}
            </div>
          </div>

          <div className="research-panel">
            <h4>🧩 Common keywords <small>(frequent angles across these titles — the ones missing from your own list are your content gap)</small></h4>
            <div className="research-keyword-list">
              {result.topKeywords.map(({ word, count }) => (
                <span className="research-keyword-chip" key={word}>{word} <small>×{count}</small></span>
              ))}
            </div>
          </div>

          <div className="research-panel">
            <h4>📺 All videos <small>(sorted by views)</small></h4>
            <div className="research-video-list">
              {result.ranked.map((video) => (
                <a className={`research-video-card ${video.isOutlier ? 'outlier' : ''}`} key={video.videoId} href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">
                  {video.thumbnail && <img src={video.thumbnail} alt="" />}
                  <div className="research-video-meta">
                    <span className="research-video-title">{video.title}</span>
                    <span className="research-video-sub">{video.channelTitle} · {formatViews(video.viewCount)} views</span>
                    <span className="research-video-sub muted">{formatDate(video.publishedAt)} · {formatDurationLabel(video.durationSeconds)}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
