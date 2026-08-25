export function overlapReplacementPlugin() {
  return {
    name: 'video-editor-overlap-replacement',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      let importApplied = false
      let commitApplied = false

      const helperImport = /import \{([^}]*)\} from '\.\/timelineStateHelpers'/
      const importMatch = next.match(helperImport)
      if (importMatch) {
        if (importMatch[1].includes('replaceTimelineOverlaps')) {
          importApplied = true
        } else {
          const names = importMatch[1].split(',').map((name) => name.trim()).filter(Boolean)
          names.push('replaceTimelineOverlaps')
          next = next.replace(helperImport, `import { ${names.join(', ')} } from './timelineStateHelpers'`)
          importApplied = true
        }
      }

      const oldCommit = `  const commitClips = (updater) => {\n    setClips((current) => {\n      const next = typeof updater === 'function' ? updater(current) : updater\n      if (next === current) return current\n      pushHistory(current)\n      return next\n    })\n  }`
      const newCommit = `  const commitClips = (updater) => {\n    setClips((current) => {\n      const next = typeof updater === 'function' ? updater(current) : updater\n      if (next === current) return current\n      const currentIds = new Set(current.map((clip) => clip.id))\n      const addedIds = next.filter((clip) => !currentIds.has(clip.id)).map((clip) => clip.id)\n      const resolved = addedIds.length ? replaceTimelineOverlaps(next, addedIds) : next\n      pushHistory(current)\n      return resolved\n    })\n  }`
      if (next.includes(oldCommit)) {
        next = next.replace(oldCommit, newCommit)
        commitApplied = true
      } else if (next.includes('const addedIds = next.filter((clip) => !currentIds.has(clip.id))')) {
        commitApplied = true
      }

      const missing = []
      if (!importApplied) missing.push('helper-import')
      if (!commitApplied) missing.push('new-clip-overlap-resolution')
      if (missing.length) throw new Error(`Overlap replacement patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
