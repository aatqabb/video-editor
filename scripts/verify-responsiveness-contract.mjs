import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { mapWithCooperativeYields, runWhenIdle } from '../src/responsiveProcessing.js'

let idleRanSynchronously = true
const idlePromise = runWhenIdle(() => {
  assert.equal(idleRanSynchronously, false, 'idle fallback must defer heavy work')
  return 'ok'
})
idleRanSynchronously = false
assert.equal(await idlePromise, 'ok')

let heartbeat = 0
const timer = setInterval(() => { heartbeat += 1 }, 1)
const items = Array.from({ length: 24 }, (_, index) => index)
const progress = []

const results = await mapWithCooperativeYields(items, (value) => {
  const start = performance.now()
  while (performance.now() - start < 2) {
    Math.sqrt(value + performance.now())
  }
  return value * 2
}, {
  yieldEvery: 1,
  onProgress: (done, total) => progress.push([done, total]),
})

clearInterval(timer)
assert.deepEqual(results, items.map((value) => value * 2))
assert.equal(progress.length, items.length)
assert.deepEqual(progress.at(-1), [items.length, items.length])
assert.ok(heartbeat >= 2, `expected event-loop heartbeats during heavy batch, got ${heartbeat}`)

console.log(`Responsiveness contract passed with ${heartbeat} event-loop heartbeats.`)
