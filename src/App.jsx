import { useEffect, useRef, useState } from 'react'
import './App.css'

const leftTabs = ['Project', 'Effect Controls', 'Effects', 'Tools', 'Text', 'Properties']
const centerTabs = ['Source', 'Script', 'Stock', 'SFX', 'Transitions', 'Essential Sound']

const mediaItems = [
  ['Voiceover.mp3', '01:09:14', 'audio'],
  ['Main Sequence', '00:43:24', 'sequence'],
  ['Music.wav', '03:35:23', 'audio'],
  ['Black Texture', '05:01', 'image'],
  ['B-roll 01.mp4', '00:02:22', 'video'],
  ['B-roll 02.mp4', '00:07:06', 'video'],
  ['Portrait.png', 'Still', 'image'],
  ['Adjustment Layer', '00:04:29', 'image'],
  ['B-roll 03.mp4', '00:06:11', 'video'],
]

const shortcuts = [
  ['Space', 'Play / Pause preview'],
  ['V', 'Cursor / Selection tool'],
  ['C', 'Cut / Razor tool'],
  ['Q', 'Backward cut / ripple trim'],
  ['W', 'Forward cut / ripple trim'],
  ['K', 'Split selected clip at playhead'],
  ['Delete', 'Delete selected clip'],
  ['+ / -', 'Timeline zoom in / out'],
  ['[ / ]', 'Make tracks shorter / taller'],
  ['M', 'Add marker'],
  ['← / →', 'Move playhead frame by frame'],
  ['Ctrl + Z', 'Undo'],
  ['Ctrl + Shift + Z', 'Redo'],
  ['Ctrl + S', 'Save project'],
  ['Ctrl + D', 'Duplicate selected clip'],
]

function App() {
  const [leftTab, setLeftTab] = useState('Project')
  const [centerTab, setCenterTab] = useState('Source')
  const [toast, setToast] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(4)
  const [selectedClip, setSelectedClip] = useState('clip-v1')
  const [leftWidth, setLeftWidth] = useState(32)
  const [rightWidth, setRightWidth] = useState(33)
  const [timelineHeight, setTimelineHeight] = useState(42)
  const [zoom, setZoom] = useState(100)
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(window.__videoEditorToast)
    window.__videoEditorToast = window.setTimeout(() => setToast(''), 1400)
  }

  const startVerticalResize = (side, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startLeft = leftWidth
    const startRight = rightWidth

    const onMove = (moveEvent) => {
      const width = editorRef.current?.getBoundingClientRect().width || window.innerWidth
      const delta = ((moveEvent.clientX - startX) / width) * 100
      if (side === 'left') setLeftWidth(Math.min(48, Math.max(18, startLeft + delta)))
      if (side === 'right') setRightWidth(Math.min(48, Math.max(18, startRight - delta)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startTimelineResize = (event) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = timelineHeight
    const onMove = (moveEvent) => {
      const delta = ((startY - moveEvent.clientY) / window.innerHeight) * 100
      setTimelineHeight(Math.min(70, Math.max(25, startHeight + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return
      if (event.key === 'Escape') setShowShortcuts(false)
      if (event.code === 'Space') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'v') notify('Cursor tool active')
      if (event.key.toLowerCase() === 'c') notify('Cut tool active')
      if (event.key.toLowerCase() === 'q') notify('Backward cut to playhead')
      if (event.key.toLowerCase() === 'w') notify('Forward cut to playhead')
      if (event.key.toLowerCase() === 'k') notify('Split clip at playhead')
      if (event.key.toLowerCase() === 'm') notify('Marker added')
      if (event.key === 'Delete') notify('Selected clip deleted')
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        notify('Project saved')
      }
      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        notify('Undo')
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        notify('Redo')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const renderLeftBody = () => {
    if (leftTab === 'Project') {
      return (
        <>
          <div className="project-row">
            <button className="small-icon" onClick={() => notify('Project bin opened')}>▣</button>
            <span>Untitled Project</span>
            <span className="item-count">17 items</span>
          </div>
          <div className="project-search-row">
            <input placeholder="Search project" />
            <button onClick={() => fileInputRef.current?.click()}>＋</button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={() => notify('Media selected for import')} />
          </div>
          <div className="media-grid">
            {mediaItems.map(([name, meta, type], index) => (
              <button
                key={name}
                className={`media-card ${selectedMedia === index ? 'selected' : ''}`}
                onClick={() => { setSelectedMedia(index); notify(`${name} selected`) }}
              >
                <div className={`media-thumb ${type}`}><span>{type === 'audio' ? '▥' : type === 'sequence' ? '▦' : '▶'}</span></div>
                <div className="media-name">{name}</div>
                <div className="media-meta">{meta}</div>
              </button>
            ))}
          </div>
        </>
      )
    }

    if (leftTab === 'Effects') {
      return <OptionGrid title="VIDEO EFFECTS" options={['Blur', 'Sharpen', 'Vignette', 'Film Grain', 'Exposure', 'Contrast', 'Transform', 'Crop', 'Glow']} onClick={notify} />
    }

    if (leftTab === 'Tools') {
      return <OptionGrid title="EDITING TOOLS" options={['Cursor (V)', 'Cut (C)', 'Backward Cut (Q)', 'Forward Cut (W)', 'Marker (M)', 'Freeze Frame']} onClick={notify} />
    }

    if (leftTab === 'Text') {
      return <OptionGrid title="TEXT" options={['Title', 'Subtitle', 'Caption', 'Lower Third', 'Poppins', 'Montserrat', 'Fade In', 'Zoom In', 'Typewriter']} onClick={notify} />
    }

    return (
      <div className="property-body">
        <div className="section-label">{leftTab.toUpperCase()}</div>
        {['Position X / Y', 'Scale 100%', 'Rotation 0°', 'Opacity 100%', 'Speed 1.0x'].map((item) => <button key={item} onClick={() => notify(item)}>{item}</button>)}
      </div>
    )
  }

  const renderCenterBody = () => {
    if (centerTab === 'Source') {
      return <Monitor title="Source: (no clips)" playing={playing} setPlaying={setPlaying} notify={notify} empty />
    }
    if (centerTab === 'Script') {
      return (
        <div className="script-panel">
          <textarea defaultValue={'Paste full script here.\nEach sentence will become its own editable line.'} />
          <button onClick={() => notify('Script split into editable lines')}>Split into Lines</button>
          <div className="script-line-demo">
            <span>1</span><input defaultValue="example script line" /><input defaultValue="editable stock search query" /><button onClick={() => notify('Pexels + Pixabay search')}>Search</button>
          </div>
        </div>
      )
    }
    if (centerTab === 'Stock') return <OptionGrid title="PEXELS + PIXABAY" options={['Search Videos', 'Preview Result 1', 'Preview Result 2', 'Preview Result 3', 'Download', 'Drag to Timeline']} onClick={notify} />
    if (centerTab === 'SFX') return <OptionGrid title="SFX LIBRARY" options={['Whoosh', 'Impact Hit', 'Pop', 'Rise', 'Glitch', 'Bass Drop', 'Swipe', 'Boom', 'Typing']} onClick={notify} />
    if (centerTab === 'Transitions') return <OptionGrid title="TRANSITIONS" options={['Cross Dissolve', 'Fade', 'Slide', 'Zoom In', 'Zoom Out', 'Light Leak Warm', 'Light Leak Cool', 'Whip Pan', 'Flash']} onClick={notify} />
    return <OptionGrid title="ESSENTIAL SOUND" options={['Dialogue', 'Music', 'SFX', 'Ambience', 'Volume', 'Fade In', 'Fade Out', 'Auto Ducking']} onClick={notify} />
  }

  return (
    <div className="editor" ref={editorRef}>
      <header className="topbar">
        <button className="home-btn" onClick={() => notify('Home')}>⌂</button>
        <nav className="workspace-nav">
          {['Import', 'Edit', 'Export'].map((item) => <button key={item} className={item === 'Edit' ? 'active' : ''} onClick={() => notify(`${item} workspace`)}>{item}</button>)}
        </nav>
        <div className="project-title">Untitled Project</div>
        <div className="top-actions">
          <button onClick={() => setShowShortcuts(true)}>⌨</button>
          <button onClick={() => notify('Layout options')}>☷</button>
          <button onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
        </div>
      </header>

      <main className="workspace-shell">
        <section className="upper-workspace" style={{ height: `${100 - timelineHeight}%` }}>
          <section className="panel left-panel" style={{ width: `${leftWidth}%` }}>
            <div className="tab-strip">
              {leftTabs.map((tab) => <button key={tab} className={leftTab === tab ? 'active' : ''} onClick={() => setLeftTab(tab)}>{tab}</button>)}
            </div>
            <div className="panel-body">{renderLeftBody()}</div>
          </section>

          <div className="resize-handle vertical" onMouseDown={(event) => startVerticalResize('left', event)} />

          <section className="panel center-panel">
            <div className="tab-strip">
              {centerTabs.map((tab) => <button key={tab} className={centerTab === tab ? 'active' : ''} onClick={() => setCenterTab(tab)}>{tab}</button>)}
            </div>
            <div className="panel-body center-body">{renderCenterBody()}</div>
          </section>

          <div className="resize-handle vertical" onMouseDown={(event) => startVerticalResize('right', event)} />

          <section className="panel right-panel" style={{ width: `${rightWidth}%` }}>
            <div className="tab-strip"><button className="active" onClick={() => notify('Program monitor')}>Program: Untitled Project</button></div>
            <div className="panel-body center-body"><Monitor title="Program" playing={playing} setPlaying={setPlaying} notify={notify} /></div>
          </section>
        </section>

        <div className="resize-handle horizontal" onMouseDown={startTimelineResize} />

        <Timeline
          height={timelineHeight}
          zoom={zoom}
          setZoom={setZoom}
          selectedClip={selectedClip}
          setSelectedClip={setSelectedClip}
          notify={notify}
        />
      </main>

      <footer className="statusbar"><span>Ready</span><span>GPU: Auto</span><span>Preview: 1/2</span><span>Tool: Cursor</span></footer>

      {showShortcuts && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowShortcuts(false)}>
          <div className="shortcut-modal">
            <div className="modal-head"><strong>⌨ Keyboard Shortcuts</strong><button onClick={() => setShowShortcuts(false)}>✕ Close</button></div>
            {shortcuts.map(([key, description]) => <div className="shortcut-row" key={key}><kbd>{key}</kbd><span>{description}</span></div>)}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Monitor({ playing, setPlaying, notify, empty = false }) {
  return (
    <div className="monitor">
      <div className={`monitor-screen ${empty ? 'empty' : 'program'}`}>
        <span>{empty ? 'SOURCE MONITOR' : 'PROGRAM PREVIEW'}</span>
      </div>
      <div className="monitor-info"><span>00:00:05:11</span><button onClick={() => notify('Fit menu')}>Fit ▾</button><button onClick={() => notify('Full resolution')}>Full ▾</button></div>
      <div className="monitor-controls">
        {['|◀', '◀', playing ? '❚❚' : '▶', '▶', '▶|', '▣'].map((label, index) => (
          <button key={`${label}-${index}`} onClick={() => index === 2 ? setPlaying((value) => !value) : notify(`Monitor control ${label}`)}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function OptionGrid({ title, options, onClick }) {
  return (
    <div className="option-panel">
      <div className="section-label">{title}</div>
      <input className="option-search" placeholder={`Search ${title.toLowerCase()}`} />
      <div className="option-grid">{options.map((option) => <button key={option} onClick={() => onClick(option)}>{option}</button>)}</div>
    </div>
  )
}

function Timeline({ height, zoom, setZoom, selectedClip, setSelectedClip, notify }) {
  const tracks = ['V5', 'V4', 'V3', 'V2', 'V1', 'A1', 'A2', 'A3']
  return (
    <section className="timeline" style={{ height: `${height}%` }}>
      <div className="timeline-titlebar">
        <strong>Untitled Project</strong>
        <span className="timeline-time">00:00:05:11</span>
        <div className="timeline-zoom"><span>−</span><input type="range" min="60" max="180" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span>+</span></div>
      </div>
      <div className="timeline-body">
        <div className="track-controls">
          <div className="ruler-spacer" />
          {tracks.map((track) => (
            <div className="track-control" key={track}>
              <button onClick={() => notify(`${track} lock toggled`)}>🔒</button>
              <strong>{track}</strong>
              <button onClick={() => notify(`${track} visibility / mute toggled`)}>{track.startsWith('V') ? '◉' : 'M'}</button>
              {!track.startsWith('V') && <button onClick={() => notify(`${track} solo toggled`)}>S</button>}
            </div>
          ))}
        </div>
        <div className="timeline-scroll">
          <div className="time-ruler" style={{ width: `${1500 * zoom / 100}px` }}>
            {['00:00', '00:16', '00:32', '00:48', '01:04', '01:20', '01:36', '01:52'].map((time, index) => <span key={time} style={{ left: `${index * 185}px` }}>{time}</span>)}
          </div>
          <div className="track-lanes" style={{ width: `${1500 * zoom / 100}px` }}>
            <div className="playhead" />
            {tracks.map((track, index) => (
              <div className="track-lane" key={track}>
                {index === 2 && <Clip id="clip-title" className="title-clip" label="Title" selectedClip={selectedClip} setSelectedClip={setSelectedClip} />}
                {index === 3 && <Clip id="clip-v2" className="purple-clip" label="B-roll.mp4" selectedClip={selectedClip} setSelectedClip={setSelectedClip} />}
                {index === 4 && <Clip id="clip-v1" className="blue-clip" label="Interview.mp4" selectedClip={selectedClip} setSelectedClip={setSelectedClip} />}
                {index === 5 && <Clip id="clip-a1" className="green-clip audio-clip" label="Voiceover.mp3" selectedClip={selectedClip} setSelectedClip={setSelectedClip} />}
                {index === 6 && <Clip id="clip-a2" className="yellow-clip audio-clip" label="Music.wav" selectedClip={selectedClip} setSelectedClip={setSelectedClip} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Clip({ id, className, label, selectedClip, setSelectedClip }) {
  return <button className={`timeline-clip ${className} ${selectedClip === id ? 'selected' : ''}`} onClick={() => setSelectedClip(id)}>{label}</button>
}

export default App