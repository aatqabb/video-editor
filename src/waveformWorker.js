self.onmessage = (event) => {
  const samplesBuffer = event.data?.samples
  const bins = Math.max(16, Math.min(512, Number(event.data?.bins) || 96))

  if (!(samplesBuffer instanceof ArrayBuffer)) {
    self.postMessage({ error: 'Missing waveform sample buffer' })
    return
  }

  const channel = new Float32Array(samplesBuffer)
  const block = Math.max(1, Math.floor(channel.length / bins))
  const waveform = Array.from({ length: bins }, (_, index) => {
    const start = index * block
    const end = Math.min(channel.length, start + block)
    let peak = 0
    const stride = Math.max(1, Math.floor(block / 80))

    for (let cursor = start; cursor < end; cursor += stride) {
      peak = Math.max(peak, Math.abs(channel[cursor] || 0))
    }

    return Math.max(0.04, Math.min(1, peak))
  })

  self.postMessage({ waveform })
}
