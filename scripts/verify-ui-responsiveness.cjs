const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const TIMEOUT_MS = 30000

function fail(error) {
  console.error(error?.stack || error)
  process.exitCode = 1
  app.quit()
}

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1500,
    height: 920,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const timeout = setTimeout(() => fail(new Error(`UI responsiveness stress test timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)

  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    await window.webContents.executeJavaScript(`new Promise((resolve) => {
      const ready = () => document.querySelector('.timeline-clip') && document.querySelector('.time-ruler')
      if (ready()) return resolve(true)
      const started = performance.now()
      const timer = setInterval(() => {
        if (ready()) { clearInterval(timer); resolve(true) }
        else if (performance.now() - started > 5000) { clearInterval(timer); resolve(false) }
      }, 25)
    })`)

    const result = await window.webContents.executeJavaScript(`(async () => {
      const clip = document.querySelector('.timeline-clip')
      const ruler = document.querySelector('.time-ruler')
      if (!clip || !ruler) throw new Error('Editor timeline did not render')

      clip.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      const gaps = []
      let heartbeats = 0
      let previousBeat = performance.now()
      const heartbeat = setInterval(() => {
        const now = performance.now()
        gaps.push(now - previousBeat)
        previousBeat = now
        heartbeats += 1
      }, 16)

      const key = (key, options = {}) => window.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code: options.code || '',
        ctrlKey: Boolean(options.ctrlKey),
        shiftKey: Boolean(options.shiftKey),
        bubbles: true,
        cancelable: true,
      }))

      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
      const waitTask = () => new Promise((resolve) => setTimeout(resolve, 0))

      // Grow the real timeline to a heavy DOM/editing state using the app's own shortcut handler.
      for (let index = 0; index < 90; index += 1) {
        key('d', { ctrlKey: true })
        if (index % 5 === 4) await waitTask()
      }

      // Exercise playhead, timeline zoom and vertical track sizing while the timeline is dense.
      const rulerRect = ruler.getBoundingClientRect()
      for (let index = 0; index < 180; index += 1) {
        const x = rulerRect.left + ((index % 120) / 120) * Math.max(1, rulerRect.width - 2)
        ruler.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: rulerRect.top + 5 }))
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: rulerRect.top + 5 }))
        if (index % 12 === 0) key(index % 24 === 0 ? '=' : '-')
        if (index % 20 === 0) key(index % 40 === 0 ? ']' : '[')
        if (index % 6 === 5) await waitFrame()
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
      clearInterval(heartbeat)

      const clipCount = document.querySelectorAll('.timeline-clip').length
      const maxGap = gaps.length ? Math.max(...gaps) : Infinity
      const avgGap = gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : Infinity
      const selected = document.querySelectorAll('.timeline-clip.selected').length

      return { clipCount, heartbeats, maxGap, avgGap, selected }
    })()`)

    if (result.clipCount < 90) throw new Error(`Expected a dense timeline with at least 90 clips, got ${result.clipCount}`)
    if (result.heartbeats < 20) throw new Error(`Expected UI heartbeats during stress run, got ${result.heartbeats}`)
    if (result.maxGap > 750) throw new Error(`UI event loop stalled for ${result.maxGap.toFixed(1)}ms during stress run`)

    console.log(`App-level UI responsiveness stress passed: ${result.clipCount} clips, ${result.heartbeats} heartbeats, max gap ${result.maxGap.toFixed(1)}ms, average gap ${result.avgGap.toFixed(1)}ms.`)
    clearTimeout(timeout)
    window.destroy()
    app.quit()
  } catch (error) {
    clearTimeout(timeout)
    fail(error)
  }
}).catch(fail)
