export function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export function runWhenIdle(task, timeout = 120) {
  if (typeof requestIdleCallback === 'function') {
    return new Promise((resolve, reject) => {
      requestIdleCallback(() => {
        try { resolve(task()) } catch (error) { reject(error) }
      }, { timeout })
    })
  }
  return yieldToEventLoop().then(task)
}

export async function mapWithCooperativeYields(items, mapper, { yieldEvery = 1, onProgress } = {}) {
  const list = [...items]
  const results = []
  const cadence = Math.max(1, Number(yieldEvery) || 1)

  for (let index = 0; index < list.length; index += 1) {
    const result = await mapper(list[index], index, list.length)
    results.push(result)
    onProgress?.(index + 1, list.length, result)
    if ((index + 1) % cadence === 0 && index + 1 < list.length) await yieldToEventLoop()
  }

  return results
}
