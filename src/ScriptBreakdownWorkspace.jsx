import { useRef, useState } from 'react'
import { buildSceneBreakdown, formatSecondsLabel, totalScriptDuration } from './scriptBreakdown'
import { getLibrarySfx } from './sfxSuggestions'
import './ScriptWorkspace.css'
import './ScriptBreakdownWorkspace.css'

const SAMPLE_SCRIPT = `I used to wake up every morning already exhausted.
Alarm going off, straight to my phone, scrolling before I even sat up.
By the time I got to the office, I felt like I had already lost the day.
One decision changed everything — I started waking up an hour earlier.
Within a month, the difference was impossible to ignore.`

export default function ScriptBreakdownWorkspace({ notify, onAddSfx }) {
  const [script, setScript] = useState(SAMPLE_SCRIPT)
  const [scenes, setScenes] = useState(() => buildSceneBreakdown(SAMPLE_SCRIPT))
  const previewRef = useRef(null)

  const runBreakdown = (raw = script) => {
    const next = buildSceneBreakdown(raw)
    setScenes(next)
    notify(`${next.length} scene(s) broken down`)
    return next
  }

  const previewSfx = (sfx) => {
    if (!sfx) return
    try {
      previewRef.current?.pause()
      const audio = new Audio(sfx.url)
      previewRef.current = audio
      audio.play().catch(() => notify('Could not preview that SFX'))
    } catch {
      notify('Could not preview that SFX')
    }
  }

  const addSuggestedSfx = (scene) => {
    const sfx = getLibrarySfx(scene.sfx?.libraryId)
    if (!sfx) return notify('No built-in SFX for this scene — import one manually')
    if (!onAddSfx) return notify('Cannot add SFX from here')
    onAddSfx(sfx, scene.startSeconds)
    notify(`${sfx.name} added at ${formatSecondsLabel(scene.startSeconds)}`)
  }

  const totalDuration = totalScriptDuration(scenes)

  return (
    <div className="script-workspace breakdown-workspace">
      <div className="script-toolbar">
        <strong>🎬 SCRIPT BREAKDOWN</strong>
      </div>

      <div className="api-status-row">
        <span className="api-ready">Free — no API key needed</span>
        <span className="api-hint">Script paste karo → har line ko scene mein todta hai: narration, visual idea, b-roll keywords, SFX suggestion, aur estimated duration.</span>
      </div>

      <textarea
        className="full-script-input"
        value={script}
        onChange={(event) => setScript(event.target.value)}
        placeholder="Paste your full script here..."
      />

      <div className="script-actions">
        <button className="primary" onClick={() => runBreakdown(script)}>Break Down Script</button>
      </div>

      {!!scenes.length && (
        <div className="breakdown-summary-row">
          <div className="research-stat"><span>Scenes</span><strong>{scenes.length}</strong></div>
          <div className="research-stat"><span>Est. total length</span><strong>{formatSecondsLabel(totalDuration)}</strong></div>
        </div>
      )}

      <div className="breakdown-scene-list">
        {scenes.map((scene) => (
          <article className="breakdown-scene-card" key={scene.id}>
            <div className="breakdown-scene-head">
              <span className="script-line-number">{String(scene.index).padStart(2, '0')}</span>
              <span className="breakdown-scene-time">{formatSecondsLabel(scene.startSeconds)} · {formatSecondsLabel(scene.durationSeconds)}</span>
            </div>

            <p className="breakdown-narration">{scene.narration}</p>

            <div className="breakdown-field">
              <span className="breakdown-field-label">Visual</span>
              <div className="breakdown-chip-row">
                {scene.visual.map((concept) => <span className="breakdown-chip visual" key={concept}>{concept}</span>)}
              </div>
            </div>

            <div className="breakdown-field">
              <span className="breakdown-field-label">B-roll keywords</span>
              <div className="breakdown-chip-row">
                {scene.broll.map((word) => <span className="breakdown-chip broll" key={word}>{word}</span>)}
              </div>
            </div>

            <div className="breakdown-field">
              <span className="breakdown-field-label">SFX</span>
              {scene.sfx ? (
                <div className="breakdown-sfx-row">
                  <span className={`breakdown-chip sfx ${scene.sfx.libraryId ? '' : 'missing'}`}>
                    {scene.sfx.libraryId ? scene.sfx.libraryName : scene.sfx.label}
                  </span>
                  {scene.sfx.libraryId && (
                    <>
                      <button onClick={() => previewSfx(getLibrarySfx(scene.sfx.libraryId))}>▶ Preview</button>
                      <button onClick={() => addSuggestedSfx(scene)}>+ Add to Timeline</button>
                    </>
                  )}
                  {scene.sfx.note && <small className="breakdown-sfx-note">{scene.sfx.note}</small>}
                </div>
              ) : (
                <span className="breakdown-empty">No specific SFX cue detected for this line</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
