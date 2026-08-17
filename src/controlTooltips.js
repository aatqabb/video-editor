const CONTROL_SELECTOR = 'button, input, select, textarea, [role="button"], [tabindex]'

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function labelText(control) {
  if (control.id) {
    const label = document.querySelector(`label[for="${CSS.escape(control.id)}"]`)
    if (label) return normalize(label.textContent)
  }
  const wrappingLabel = control.closest('label')
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true)
    clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove())
    return normalize(clone.textContent)
  }
  return ''
}

function describeControl(control) {
  const explicit = normalize(control.dataset?.tooltip)
  if (explicit) return explicit

  const aria = normalize(control.getAttribute('aria-label'))
  if (aria) return aria

  const labelledBy = normalize(control.getAttribute('aria-labelledby'))
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(' ')
    if (normalize(text)) return normalize(text)
  }

  const label = labelText(control)
  if (label) return label

  const placeholder = normalize(control.getAttribute('placeholder'))
  if (placeholder) return placeholder

  if (control.tagName === 'BUTTON' || control.getAttribute('role') === 'button') {
    const text = normalize(control.textContent)
    if (text) return text
  }

  const name = normalize(control.getAttribute('name'))
  if (name) return name.replace(/[-_]+/g, ' ')

  const type = normalize(control.getAttribute('type'))
  if (type && type !== 'hidden') return `${type} control`

  if (control.tagName === 'SELECT') return 'Choose an option'
  if (control.tagName === 'TEXTAREA') return 'Edit text'
  return 'Editor control'
}

function applyTooltip(control) {
  if (!(control instanceof HTMLElement)) return
  if (control.hasAttribute('title') && normalize(control.getAttribute('title'))) return
  const description = describeControl(control)
  if (description) control.setAttribute('title', description)
}

function scan(root = document) {
  if (root instanceof HTMLElement && root.matches(CONTROL_SELECTOR)) applyTooltip(root)
  root.querySelectorAll?.(CONTROL_SELECTOR).forEach(applyTooltip)
}

export function installControlTooltips() {
  scan(document)

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) scan(node)
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
