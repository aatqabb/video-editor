import './App.css'

function App() {
  return (
    <div className="editor">
      <header className="topbar">
        <div className="logo">VIDEO EDITOR</div>

        <div className="top-menu">
          <button>File</button>
          <button>Edit</button>
          <button>Clip</button>
          <button>Sequence</button>
          <button>Window</button>
        </div>

        <button className="export-btn">Export</button>
      </header>

      <main className="workspace">

        <section className="media-panel">
          <div className="panel-tabs">
            <button>Media</button>
            <button>Script</button>
            <button>Stock</button>
          </div>

          <div className="media-content">
            <h3>Media Library</h3>
            <button className="import-btn">+ Import Media</button>
            <p>Videos, images and audio will appear here.</p>
          </div>
        </section>

        <section className="preview-panel">
          <div className="preview-screen">
            <span>Preview</span>
          </div>

          <div className="playback-controls">
            <button>◀</button>
            <button>▶</button>
            <button>■</button>
            <span>00:00:00:00</span>
          </div>
        </section>

        <section className="properties-panel">
          <h3>Properties</h3>

          <div className="property">
            <span>Position</span>
            <input type="text" placeholder="X / Y" />
          </div>

          <div className="property">
            <span>Scale</span>
            <input type="text" placeholder="100%" />
          </div>

          <div className="property">
            <span>Rotation</span>
            <input type="text" placeholder="0°" />
          </div>

          <div className="property">
            <span>Opacity</span>
            <input type="text" placeholder="100%" />
          </div>
        </section>

      </main>

      <section className="timeline">

        <div className="timeline-toolbar">
          <button>↶</button>
          <button>↷</button>
          <button>✂ Cut</button>
          <button>🧲 Snap</button>

          <div className="zoom-control">
            <span>−</span>
            <input type="range" min="1" max="100" />
            <span>+</span>
          </div>
        </div>

        <div className="tracks">

          <div className="track">
            <div className="track-name">V2</div>
            <div className="track-area"></div>
          </div>

          <div className="track">
            <div className="track-name">V1</div>
            <div className="track-area"></div>
          </div>

          <div className="track">
            <div className="track-name">A1</div>
            <div className="track-area"></div>
          </div>

          <div className="track">
            <div className="track-name">A2</div>
            <div className="track-area"></div>
          </div>

        </div>

      </section>
    </div>
  )
}

export default App