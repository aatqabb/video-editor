const STORAGE_KEY = 'video-editor-premiere-workspace-v1'

const defaults = {
  leftRatio: 0.32,
  rightRatio: 0.33,
  timelineRatio: 0.42,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed) return { ...defaults }
    return {
      leftRatio: Number.isFinite(parsed.leftRatio) ? parsed.leftRatio : defaults.leftRatio,
      rightRatio: Number.isFinite(parsed.rightRatio) ? parsed.rightRatio : defaults.rightRatio,
      timelineRatio: Number.isFinite(parsed.timelineRatio) ? parsed.timelineRatio : defaults.timelineRatio,
    }
  } catch {
    return { ...defaults }
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

export function installPremiereWorkspaceController() {
  let disposed = false
  let cleanupActiveDrag = null
  let frame = 0
  const state = readState()

  const getParts = () => {
    const shell = document.querySelector('.workspace-shell')
    if (!shell) return null
    const upper = shell.querySelector(':scope > .upper-workspace')
    const timeline = shell.querySelector(':scope > .timeline')
    if (!upper || !timeline) return null
    const left = upper.querySelector(':scope > .left-panel')
    const center = upper.querySelector(':scope > .center-panel')
    const right = upper.querySelector(':scope > .right-panel')
    const vertical = [...upper.querySelectorAll(':scope > .resize-handle.vertical')]
    const horizontal = shell.querySelector(':scope > .resize-handle.horizontal')
    if (!left || !center || !right || vertical.length < 2 || !horizontal) return null
    return { shell, upper, timeline, left, center, right, leftHandle: vertical[0], rightHandle: vertical[1], horizontal }
  }

  const apply = () => {
    frame = 0
    const parts = getParts()
    if (!parts) return
    const shellRect = parts.shell.getBoundingClientRect()
    const upperRect = parts.upper.getBoundingClientRect()
    const shellHeight = Math.max(1, shellRect.height)
    const upperWidth = Math.max(1, upperRect.width)

    const splitter = 10
    const minUpper = Math.min(220, Math.max(120, shellHeight * 0.16))
    const minTimeline = Math.min(210, Math.max(96, shellHeight * 0.12))
    const timelinePx = clamp(state.timelineRatio * shellHeight, minTimeline, Math.max(minTimeline, shellHeight - minUpper - splitter))
    state.timelineRatio = timelinePx / shellHeight

    const minSide = Math.min(220, Math.max(120, upperWidth * 0.10))
    const minCenter = Math.min(360, Math.max(220, upperWidth * 0.18))
    const available = Math.max(1, upperWidth - splitter * 2)
    let leftPx = clamp(state.leftRatio * available, minSide, available - minCenter - minSide)
    let rightPx = clamp(state.rightRatio * available, minSide, available - minCenter - leftPx)
    const centerPx = available - leftPx - rightPx
    if (centerPx < minCenter) {
      const deficit = minCenter - centerPx
      const leftSlack = Math.max(0, leftPx - minSide)
      const rightSlack = Math.max(0, rightPx - minSide)
      const totalSlack = leftSlack + rightSlack
      if (totalSlack > 0) {
        leftPx -= deficit * (leftSlack / totalSlack)
        rightPx -= deficit * (rightSlack / totalSlack)
      }
    }
    state.leftRatio = leftPx / available
    state.rightRatio = rightPx / available

    parts.shell.style.setProperty('--premiere-timeline-px', `${timelinePx}px`)
    parts.upper.style.setProperty('--premiere-left-px', `${leftPx}px`)
    parts.upper.style.setProperty('--premiere-right-px', `${rightPx}px`)
    saveState(state)
  }

  const scheduleApply = () => {
    if (frame) return
    frame = requestAnimationFrame(apply)
  }

  const beginDrag = (kind, event) => {
    const parts = getParts()
    if (!parts) return
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    cleanupActiveDrag?.()

    const startX = event.clientX
    const startY = event.clientY
    const shellRect = parts.shell.getBoundingClientRect()
    const upperRect = parts.upper.getBoundingClientRect()
    const available = Math.max(1, upperRect.width - 20)
    const startLeftPx = state.leftRatio * available
    const startRightPx = state.rightRatio * available
    const startTimelinePx = state.timelineRatio * Math.max(1, shellRect.height)

    document.documentElement.classList.add('premiere-workspace-resizing')
    document.documentElement.classList.toggle('premiere-workspace-resizing-row', kind === 'timeline')
    document.documentElement.classList.toggle('premiere-workspace-resizing-col', kind !== 'timeline')

    const move = (moveEvent) => {
      if (kind === 'left') {
        state.leftRatio = clamp((startLeftPx + (moveEvent.clientX - startX)) / available, 0.05, 0.75)
      } else if (kind === 'right') {
        state.rightRatio = clamp((startRightPx - (moveEvent.clientX - startX)) / available, 0.05, 0.75)
      } else {
        state.timelineRatio = clamp((startTimelinePx + (startY - moveEvent.clientY)) / Math.max(1, shellRect.height), 0.08, 0.88)
      }
      scheduleApply()
    }

    const end = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', end, true)
      document.documentElement.classList.remove('premiere-workspace-resizing', 'premiere-workspace-resizing-row', 'premiere-workspace-resizing-col')
      cleanupActiveDrag = null
      scheduleApply()
    }

    cleanupActiveDrag = end
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', end, true)
    window.addEventListener('pointercancel', end, true)
  }

  const bind = () => {
    const parts = getParts()
    if (!parts || parts.shell.dataset.premiereWorkspaceBound === '1') return Boolean(parts)
    parts.shell.dataset.premiereWorkspaceBound = '1'
    parts.leftHandle.dataset.premiereSplitter = 'left'
    parts.rightHandle.dataset.premiereSplitter = 'right'
    parts.horizontal.dataset.premiereSplitter = 'timeline'
    scheduleApply()
    return true
  }

  const onPointerDown = (event) => {
    const handle = event.target.closest?.('[data-premiere-splitter]')
    if (!handle) return
    beginDrag(handle.dataset.premiereSplitter, event)
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  const observer = new MutationObserver(() => { if (!disposed) bind() })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  const resizeObserver = new ResizeObserver(() => { if (!disposed) scheduleApply() })

  const attachResizeObserver = () => {
    const parts = getParts()
    if (!parts) return false
    resizeObserver.disconnect()
    resizeObserver.observe(parts.shell)
    resizeObserver.observe(parts.upper)
    return true
  }

  const boot = () => {
    if (disposed) return
    if (bind() && attachResizeObserver()) return
    requestAnimationFrame(boot)
  }
  boot()

  return () => {
    disposed = true
    cleanupActiveDrag?.()
    if (frame) cancelAnimationFrame(frame)
    observer.disconnect()
    resizeObserver.disconnect()
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.documentElement.classList.remove('premiere-workspace-resizing', 'premiere-workspace-resizing-row', 'premiere-workspace-resizing-col')
  }
}
