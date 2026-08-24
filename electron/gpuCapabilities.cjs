const VENDORS = [
  { id: 'nvidia', label: 'NVIDIA', encoder: 'h264_nvenc', decodeBackends: ['cuda', 'd3d11va', 'dxva2'], patterns: ['nvidia', '10de'] },
  { id: 'intel', label: 'Intel', encoder: 'h264_qsv', decodeBackends: ['qsv', 'd3d11va', 'dxva2'], patterns: ['intel', '8086'] },
  { id: 'amd', label: 'AMD', encoder: 'h264_amf', decodeBackends: ['d3d11va', 'dxva2'], patterns: ['amd', 'advanced micro devices', '1002'] },
]

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function deviceText(device = {}) {
  return [
    device.vendorString,
    device.deviceString,
    device.vendorId,
    device.deviceId,
    device.driverVendor,
  ].map(normalize).filter(Boolean).join(' ')
}

function detectVendor(device = {}) {
  const text = deviceText(device)
  return VENDORS.find((vendor) => vendor.patterns.some((pattern) => text.includes(pattern))) || null
}

function summarizeGpuCapabilities(gpuInfo, ffmpeg = {}) {
  const devices = Array.isArray(gpuInfo?.gpuDevice) ? gpuInfo.gpuDevice : []
  const hardwareEncoders = Array.isArray(ffmpeg?.hardwareEncoders) ? ffmpeg.hardwareEncoders : []
  const hardwareAccelerators = Array.isArray(ffmpeg?.hardwareAccelerators) ? ffmpeg.hardwareAccelerators.map(normalize) : []

  const adapters = devices.map((device, index) => {
    const vendor = detectVendor(device)
    const encoder = vendor?.encoder || null
    const decodeBackendCandidates = vendor?.decodeBackends || []
    const availableDecodeBackends = decodeBackendCandidates.filter((backend) => hardwareAccelerators.includes(backend))
    return {
      index,
      active: Boolean(device.active),
      vendor: vendor?.id || 'unknown',
      vendorLabel: vendor?.label || device.vendorString || 'Unknown GPU',
      device: device.deviceString || `GPU ${index + 1}`,
      vendorId: device.vendorId ?? null,
      deviceId: device.deviceId ?? null,
      encoder,
      encoderAvailable: Boolean(encoder && hardwareEncoders.includes(encoder)),
      decodeBackendCandidates,
      availableDecodeBackends,
      hardwareDecodeAvailable: availableDecodeBackends.length > 0,
    }
  })

  const recognizedVendors = [...new Set(adapters.filter((adapter) => adapter.vendor !== 'unknown').map((adapter) => adapter.vendor))]
  const availableHardwareEncoders = [...new Set(adapters.filter((adapter) => adapter.encoderAvailable).map((adapter) => adapter.encoder))]
  const availableHardwareDecoders = [...new Set(adapters.flatMap((adapter) => adapter.availableDecodeBackends))]
  const activeAdapter = adapters.find((adapter) => adapter.active) || adapters[0] || null

  return {
    adapters,
    activeAdapter,
    recognizedVendors,
    availableHardwareEncoders,
    availableHardwareDecoders,
    hasRecognizedGpu: recognizedVendors.length > 0,
    hasHardwareEncoder: availableHardwareEncoders.length > 0,
    hasHardwareDecoder: availableHardwareDecoders.length > 0,
  }
}

module.exports = {
  detectVendor,
  summarizeGpuCapabilities,
}
