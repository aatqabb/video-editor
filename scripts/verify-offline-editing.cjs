const { app, BrowserWindow, session } = require('electron')
const path = require('node:path')

const TIMEOUT_MS = 30000
let failed = false

function fail(error) {
  if (failed) return
  failed = true
  console.error(error?.stack || error)
  app.exit(1)
}

app.commandLine.appendSwitch('disable-gpu')

app.whenReady().then(async () => {
  let blockedRequests = 0
  const filter = { urls: ['http://*/*', 'https://*/*'] }
  session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => {
    blockedRequests += 1
    callback({ cancel: true })
  })

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

  const timeout = setTimeout(() => fail(new Error(`Offline editing smoke test timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)

  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

    const result = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (predicate, timeoutMs = 5000) => {
        const started = performance.now()
        while (performance.now() - started < timeoutMs) {
          const value = predicate()
          if (value) return value
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        return null
      }
      const waitTask = () => new Promise((resolve) => setTimeout(resolve, 60))
      const key = (key, options = {}) => window.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code: options.code || '',
        ctrlKey: Boolean(options.ctrlKey),
        shiftKey: Boolean(options.shiftKey),
        bubbles: true,
        cancelable: true,
      }))

      const firstClip = await waitFor(() => document.querySelector('.timeline-clip'))
      const ruler = await waitFor(() => document.querySelector('.time-ruler'))
      const playhead = await waitFor(() => document.querySelector('.playhead'))
      if (!firstClip || !ruler || !playhead) throw new Error('Core editor timeline did not render offline')

      const initialCount = document.querySelectorAll('.timeline-clip').length
      if (initialCount < 2) throw new Error('Expected seeded timeline clips for offline smoke test')

      firstClip.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      key('d', { ctrlKey: true })
      await waitTask()
      const duplicatedCount = document.querySelectorAll('.timeline-clip').length
      if (duplicatedCount !== initialCount + 1) throw new Error(\`Duplicate failed offline: expected \${initialCount + 1}, got \${duplicatedCount}\`)

      key('z', { ctrlKey: true })
      await waitTask()
      const undoDuplicateCount = document.querySelectorAll('.timeline-clip').length
      if (undoDuplicateCount !== initialCount) throw new Error(\`Undo duplicate failed offline: expected \${initialCount}, got \${undoDuplicateCount}\`)

      const selected = document.querySelector('.timeline-clip')
      selected.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      key('Delete')
      await waitTask()
      const deletedCount = document.querySelectorAll('.timeline-clip').length
      if (deletedCount !== initialCount - 1) throw new Error(\`Delete failed offline: expected \${initialCount - 1}, got \${deletedCount}\`)

      key('z', { ctrlKey: true })
      await waitTask()
      const undoDeleteCount = document.querySelectorAll('.timeline-clip').length
      if (undoDeleteCount !== initialCount) throw new Error(\`Undo delete failed offline: expected \${initialCount}, got \${undoDeleteCount}\`)

      const beforeLeft = playhead.getBoundingClientRect().left
      const rect = ruler.getBoundingClientRect()
      const x = rect.left + rect.width * 0.65
      const y = rect.top + Math.max(2, rect.height / 2)
      ruler.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, button: 0, clientX: x, clientY: y }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, button: 0, clientX: x, clientY: y }))
      await waitTask()
      const clickedLeft = document.querySelector('.playhead').getBoundingClientRect().left
      if (Math.abs(clickedLeft - beforeLeft) < 5) throw new Error('Playhead positioning failed offline')

      const dragPlayhead = document.querySelector('.playhead')
      const dragStart = dragPlayhead.getBoundingClientRect()
      const dragStartX = dragStart.left + Math.max(1, dragStart.width / 2)
      const dragStartY = dragStart.top + Math.max(1, dragStart.height / 4)
      const dragTargetX = Math.max(rect.left + 20, dragStartX - 120)
      dragPlayhead.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: dragStartX, clientY: dragStartY }))
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, button: 0, clientX: dragTargetX, clientY: dragStartY }))
      await waitTask()
      const duringDragLeft = document.querySelector('.playhead').getBoundingClientRect().left
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, button: 0, clientX: dragTargetX, clientY: dragStartY }))
      await waitTask()
      const afterDragLeft = document.querySelector('.playhead').getBoundingClientRect().left
      if (Math.abs(duringDragLeft - clickedLeft) < 20) throw new Error('Playhead did not move during held drag')
      if (Math.abs(afterDragLeft - duringDragLeft) > 8) throw new Error('Playhead did not stop at drag release position')

      return {
        initialCount,
        duplicatedCount,
        deletedCount,
        undoDeleteCount,
        playheadClickPixels: Math.round(Math.abs(clickedLeft - beforeLeft)),
        playheadDragPixels: Math.round(Math.abs(afterDragLeft - clickedLeft)),
      }
    })()`)

    console.log(`Offline editing smoke passed: ${result.initialCount} seeded clips, duplicate/delete/undo verified, playhead click moved ${result.playheadClickPixels}px and held-drag moved ${result.playheadDragPixels}px, ${blockedRequests} network request(s) blocked.`)
    clearTimeout(timeout)
    window.destroy()
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    fail(error)
  }
}).catch(fail)
