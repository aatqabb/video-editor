export function installTimelineLayerBalance() {
  let resizeObserver = null
  let mutationObserver = null
  let rafId = 0

  const schedule = () => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(applyBalance)
  }

  const markBoundaryRows = (rows) => {
    rows.forEach((row) => row.classList.remove('timeline-stack-first', 'timeline-stack-last'))
    if (!rows.length) return
    rows[0].classList.add('timeline-stack-first')
    rows[rows.length - 1].classList.add('timeline-stack-last')
  }

  const applyBalance = () => {
    const timelineBody = document.querySelector('.timeline-body')
    const controls = document.querySelector('.track-controls')
    const lanes = document.querySelector('.track-lanes')
    const rulerSpacer = controls?.querySelector('.ruler-spacer')
    const controlRows = [...(controls?.querySelectorAll('.track-control') || [])]
    const laneRows = [...(lanes?.querySelectorAll('.track-lane') || [])]

    if (!timelineBody || !controls || !lanes || !rulerSpacer || !controlRows.length || !laneRows.length) return

    const bodyHeight = timelineBody.clientHeight
    const rulerHeight = rulerSpacer.getBoundingClientRect().height
    const rowHeights = controlRows.map((row) => row.getBoundingClientRect().height)
    const tracksHeight = rowHeights.reduce((sum, value) => sum + value, 0)
    const availableForTracks = Math.max(0, bodyHeight - rulerHeight)
    const freeSpace = Math.max(0, availableForTracks - tracksHeight)
    const offset = Math.floor(freeSpace / 2)

    markBoundaryRows(controlRows)
    markBoundaryRows(laneRows)

    const px = `${offset}px`
    controls.style.setProperty('--timeline-layer-stack-offset', px)
    lanes.style.setProperty('--timeline-layer-stack-offset', px)
  }

  const attachObservers = () => {
    const timelineBody = document.querySelector('.timeline-body')
    const controls = document.querySelector('.track-controls')
    const lanes = document.querySelector('.track-lanes')
    if (!timelineBody || !controls || !lanes) return false

    resizeObserver?.disconnect()
    mutationObserver?.disconnect()

    resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(timelineBody)
    resizeObserver.observe(controls)
    resizeObserver.observe(lanes)
    controls.querySelectorAll('.track-control').forEach((row) => resizeObserver.observe(row))

    mutationObserver = new MutationObserver(() => {
      attachObservers()
      schedule()
    })
    mutationObserver.observe(controls, { childList: true, subtree: false })
    mutationObserver.observe(lanes, { childList: true, subtree: false })

    schedule()
    return true
  }

  if (!attachObservers()) {
    const bootObserver = new MutationObserver(() => {
      if (attachObservers()) bootObserver.disconnect()
    })
    bootObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  window.addEventListener('resize', schedule)

  return () => {
    cancelAnimationFrame(rafId)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    window.removeEventListener('resize', schedule)
  }
}
