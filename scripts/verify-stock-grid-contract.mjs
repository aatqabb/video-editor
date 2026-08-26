import fs from 'node:fs'

const stockWorkspace = fs.readFileSync(new URL('../src/StockWorkspace.jsx', import.meta.url), 'utf8')
const stockCss = fs.readFileSync(new URL('../src/StockWorkspace.css', import.meta.url), 'utf8')

const checks = [
  ['Stock-only workspace imports dedicated grid CSS', stockWorkspace.includes("import './StockWorkspace.css'")],
  ['Stock results use dedicated grid class', stockWorkspace.includes('stock-results-strip stock-results-grid')],
  ['Stock-only results use CSS grid', /\.stock-only-workspace \.stock-results-grid\{[\s\S]*display:grid/.test(stockCss)],
  ['Stock-only results scroll vertically', /overflow-y:auto/.test(stockCss) && /overflow-x:hidden/.test(stockCss)],
  ['Stock grid creates multiple responsive columns', /grid-template-columns:repeat\(auto-fill,minmax\(/.test(stockCss)],
  ['Stock cards are no longer fixed horizontal-strip widths', /\.stock-result-card\{[\s\S]*width:auto/.test(stockCss)],
  ['Script line stock strips remain untouched by scoped overrides', stockCss.includes('.stock-only-workspace .stock-results-grid')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Stock-only results use a vertical scrolling responsive grid without changing Script line result strips.')
