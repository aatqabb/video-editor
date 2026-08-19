export function normalizeLineEndingsPlugin() {
  return {
    name: 'video-editor-normalize-line-endings',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null
      const normalized = code.replace(/\r\n/g, '\n')
      return normalized === code ? null : { code: normalized, map: null }
    },
  }
}
