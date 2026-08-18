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

  if (type === 'Fade' || type === 'Cross Dissolve') return [{ opacity: 0 }, { opacity }]
  if (type === 'Dip to Black' || type === 'Dip to White') return [{ opacity }, { opacity: .18, offset: .5 }, { opacity }]
  if (type === 'Slide Left' || type === 'Push' || type === 'Camera Pan Left' || type === 'Whip Pan Left') return [{ transform: `${transform} translateX(90vw)` }, { transform }]
  if (type === 'Slide Right' || type === 'Camera Pan Right' || type === 'Whip Pan Right') return [{ transform: `${transform} translateX(-90vw)` }, { transform }]
  if (type === 'Slide Up' || type === 'Camera Tilt Up') return [{ transform: `${transform} translateY(65vh)` }, { transform }]
  if (type === 'Slide Down' || type === 'Camera Tilt Down') return [{ transform: `${transform} translateY(-65vh)` }, { transform }]

  if (type === 'Zoom In' || type === 'Smooth Zoom In' || type === 'Camera Push In') {
    return [{ transform: `${transform} scale(${type.startsWith('Smooth') ? .72 : .82})` }, { transform: `${transform} scale(1)` }]
  }
  if (type === 'Zoom Out' || type === 'Smooth Zoom Out' || type === 'Camera Pull Out') {
    return [{ transform: `${transform} scale(${type.startsWith('Smooth') ? 1.28 : 1.18})` }, { transform: `${transform} scale(1)` }]
  }
  if (type === 'Zoom In + Distort') {
    return [{ transform: `${transform} scale(.7) skewX(-7deg) skewY(3deg)`, filter: 'blur(3px) saturate(1.3)' }, { transform: `${transform} scale(1.06) skewX(2deg)`, offset: .72, filter: 'blur(.5px)' }, { transform, filter: 'none' }]
  }
  if (type === 'Zoom Out + Distort') {
    return [{ transform: `${transform} scale(1.4) skewX(8deg) skewY(-3deg)`, filter: 'blur(3px) saturate(1.3)' }, { transform: `${transform} scale(.97) skewX(-2deg)`, offset: .72, filter: 'blur(.5px)' }, { transform, filter: 'none' }]
  }
  if (type === 'Zoom In Rotate') return [{ transform: `${transform} scale(.68) rotate(-12deg)` }, { transform: `${transform} scale(1.03) rotate(2deg)`, offset: .78 }, { transform }]
  if (type === 'Zoom Out Rotate') return [{ transform: `${transform} scale(1.35) rotate(13deg)` }, { transform: `${transform} scale(.98) rotate(-2deg)`, offset: .78 }, { transform }]
  if (type === 'Rotate + Zoom' || type === 'Spin Zoom') return [{ transform: `${transform} scale(.62) rotate(-26deg)` }, { transform: `${transform} scale(1.08) rotate(5deg)`, offset: .72 }, { transform }]
  if (type === 'Camera Shake') return [
    { transform }, { transform: `${transform} translate(-9px, 4px) rotate(-1deg)`, offset: .18 }, { transform: `${transform} translate(8px, -5px) rotate(1deg)`, offset: .35 },
    { transform: `${transform} translate(-6px, 3px) rotate(-.6deg)`, offset: .55 }, { transform: `${transform} translate(4px, -2px) rotate(.4deg)`, offset: .75 }, { transform },
  ]
  if (type === 'Handheld Camera') return [
    { transform: `${transform} scale(1.02)` }, { transform: `${transform} scale(1.035) translate(-6px, 3px) rotate(-.5deg)`, offset: .28 },
    { transform: `${transform} scale(1.025) translate(5px, -4px) rotate(.45deg)`, offset: .58 }, { transform: `${transform} scale(1.03) translate(-3px, 2px) rotate(-.25deg)`, offset: .82 }, { transform },
  ]
  if (type === 'Flash') return [{ opacity }, { opacity: .08, filter: 'brightness(4)', offset: .45 }, { opacity, filter: 'none' }]
  if (type === 'Blur Transition') return [{ filter: 'blur(18px)', transform: `${transform} scale(1.08)`, opacity: .45 }, { filter: 'blur(0)', transform, opacity }]
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
    position: 'absolute', inset: '-15%', zIndex: '6', pointerEvents: 'none', mixBlendMode: 'screen',
    background: type.includes('Cool')
      ? 'radial-gradient(circle at 15% 55%, rgba(120,190,255,.95), rgba(120,190,255,.18) 28%, transparent 58%)'
      : type.includes('Film')
        ? 'linear-gradient(105deg, transparent 18%, rgba(255,92,42,.72) 43%, rgba(255,220,120,.88) 52%, transparent 72%)'
        : 'radial-gradient(circle at 18% 55%, rgba(255,96,32,.95), rgba(255,196,78,.58) 30%, transparent 62%)',
  })
  screen.appendChild(flare)
  const animation = flare.animate([
    { opacity: 0, transform: 'translateX(-24%) scale(1.08)' },
    { opacity: .95, offset: .42, transform: 'translateX(4%) scale(1.02)' },
    { opacity: 0, transform: 'translateX(28%) scale(1.08)' },
  ], { duration: duration * 1000, easing: 'ease-out', fill: 'forwards' })
  animation.addEventListener('finish', () => flare.remove(), { once: true })
}

function applyPreview(screen) {
  const layer = screen.querySelector('.program-video-layer')
  const label = screen.querySelector('.monitor-transition-label')
  if (!layer || !label) { removeFlare(screen); return }

  const { type, duration } = parseTransitionLabel(label)
  const signature = `${type}:${duration}:${layer.style.left}:${layer.style.top}:${layer.style.width}:${layer.style.height}`
  if (activeSignatures.get(layer) === signature) return
  activeSignatures.set(layer, signature)

  activeAnimations.get(layer)?.cancel()
  const frames = keyframesFor(type, layer)
  if (frames && typeof layer.animate === 'function') {
    const animation = layer.animate(frames, {
      duration: duration * 1000,
      easing: type.includes('Whip') ? 'cubic-bezier(.2,.8,.25,1)' : type.startsWith('Smooth') ? 'cubic-bezier(.22,.61,.36,1)' : 'ease-out',
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
    requestAnimationFrame(() => { scheduled = false; refreshPreviews() })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'],
  })
  schedule()
  return () => observer.disconnect()
}
