const activeAnimations = new WeakMap()
const activeSignatures = new WeakMap()

function parseTransitionLabel(label) {
  const text = label?.textContent || ''
  const [rawType = '', rawDuration = ''] = text.split('·').map((part) => part.trim())
  const duration = Math.max(.05, Number.parseFloat(rawDuration) || .45)
  return { type: rawType, duration }
}

function baseTransform(layer) {
  return layer.style.transform || 'translate(-50%, -50%)'
}

function clipOpacity(layer) {
  const parsed = Number.parseFloat(layer.style.opacity)
  return Number.isFinite(parsed) ? parsed : 1
}

function keyframesFor(type, layer) {
  const transform = baseTransform(layer)
  const opacity = clipOpacity(layer)

  if (type === 'Fade' || type === 'Cross Dissolve') {
    return [{ opacity: 0 }, { opacity }]
  }
  if (type === 'Slide Left' || type === 'Push') {
    return [{ transform: `${transform} translateX(90vw)` }, { transform }]
  }
  if (type === 'Slide Right') {
    return [{ transform: `${transform} translateX(-90vw)` }, { transform }]
  }
  if (type === 'Slide Up') {
    return [{ transform: `${transform} translateY(65vh)` }, { transform }]
  }
  if (type === 'Slide Down') {
    return [{ transform: `${transform} translateY(-65vh)` }, { transform }]
  }
  if (type === 'Zoom In' || type === 'Smooth Zoom In') {
    return [{ transform: `${transform} scale(${type.startsWith('Smooth') ? .72 : .82})` }, { transform: `${transform} scale(1)` }]
  }
  if (type === 'Zoom Out' || type === 'Smooth Zoom Out') {
    return [{ transform: `${transform} scale(${type.startsWith('Smooth') ? 1.28 : 1.18})` }, { transform: `${transform} scale(1)` }]
  }
  return null
}

function removeFlare(screen) {
  screen.querySelector('.transition-preview-flare')?.remove()
}

function previewLightLeak(screen, type, duration) {
  removeFlare(screen)
  if (!type.startsWith('Light Leak')) return

  const flare = document.createElement('div')
  flare.className = 'transition-preview-flare'
  flare.setAttribute('aria-hidden', 'true')
  Object.assign(flare.style, {
    position: 'absolute',
    inset: '-15%',
    zIndex: '6',
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    background: type.includes('Cool')
      ? 'radial-gradient(circle at 15% 55%, rgba(120,190,255,.95), rgba(120,190,255,.18) 28%, transparent 58%)'
      : type.includes('Film')
        ? 'linear-gradient(105deg, transparent 18%, rgba(255,92,42,.72) 43%, rgba(255,220,120,.88) 52%, transparent 72%)'
        : 'radial-gradient(circle at 18% 55%, rgba(255,96,32,.95), rgba(255,196,78,.58) 30%, transparent 62%)',
  })
  screen.appendChild(flare)
  const animation = flare.animate(
    [
      { opacity: 0, transform: 'translateX(-24%) scale(1.08)' },
      { opacity: .95, offset: .42, transform: 'translateX(4%) scale(1.02)' },
      { opacity: 0, transform: 'translateX(28%) scale(1.08)' },
    ],
    { duration: duration * 1000, easing: 'ease-out', fill: 'forwards' },
  )
  animation.addEventListener('finish', () => flare.remove(), { once: true })
}

function applyPreview(screen) {
  const layer = screen.querySelector('.program-video-layer')
  const label = screen.querySelector('.monitor-transition-label')
  if (!layer || !label) {
    removeFlare(screen)
    return
  }

  const { type, duration } = parseTransitionLabel(label)
  const signature = `${type}:${duration}:${layer.style.left}:${layer.style.top}:${layer.style.width}:${layer.style.height}`
  if (activeSignatures.get(layer) === signature) return
  activeSignatures.set(layer, signature)

  activeAnimations.get(layer)?.cancel()
  const frames = keyframesFor(type, layer)
  if (frames && typeof layer.animate === 'function') {
    const animation = layer.animate(frames, {
      duration: duration * 1000,
      easing: type.startsWith('Smooth') ? 'cubic-bezier(.22,.61,.36,1)' : 'ease-out',
      fill: 'none',
    })
    activeAnimations.set(layer, animation)
  }
  previewLightLeak(screen, type, duration)
}

function refreshPreviews() {
  document.querySelectorAll('.monitor-screen.program').forEach(applyPreview)
}

export function installTransitionPreviews() {
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      refreshPreviews()
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
  schedule()
  return () => observer.disconnect()
}
