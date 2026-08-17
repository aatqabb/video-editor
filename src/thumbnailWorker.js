self.onmessage = async (event) => {
  const bitmap = event.data?.bitmap
  const width = Number(event.data?.width) || 320
  const height = Number(event.data?.height) || 180

  if (!bitmap) {
    self.postMessage({ error: 'Missing thumbnail bitmap' })
    return
  }

  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas unavailable')

    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create thumbnail canvas context')

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.76 })
    const reader = new FileReaderSync()
    const thumbnail = reader.readAsDataURL(blob)
    self.postMessage({ thumbnail })
  } catch (error) {
    bitmap.close?.()
    self.postMessage({ error: error?.message || 'Thumbnail worker failed' })
  }
}
