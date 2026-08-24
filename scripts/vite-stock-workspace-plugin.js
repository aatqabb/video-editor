export function stockWorkspacePlugin() {
  return {
    name: 'video-editor-stock-workspace',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null

      const importNeedle = "import ScriptWorkspace from './ScriptWorkspace'"
      const stockImport = "import StockWorkspace from './StockWorkspace'"
      const stockNeedle = "if (centerTab === 'Stock') return <OptionGrid title=\"PEXELS + PIXABAY\" options={['Search Videos', 'Preview Result 1', 'Preview Result 2', 'Preview Result 3', 'Download', 'Drag to Timeline']} onClick={notify} />"
      const stockReplacement = "if (centerTab === 'Stock') return <StockWorkspace notify={notify} onImportStock={(result) => addStockToTimeline(result, result.sourceLineId)} />"

      if (!code.includes(importNeedle)) throw new Error('Stock workspace transform could not find ScriptWorkspace import')
      if (!code.includes(stockNeedle)) throw new Error('Stock workspace transform could not find placeholder Stock tab')

      let next = code
      if (!next.includes(stockImport)) next = next.replace(importNeedle, `${importNeedle}\n${stockImport}`)
      next = next.replace(stockNeedle, stockReplacement)
      return { code: next, map: null }
    },
  }
}
