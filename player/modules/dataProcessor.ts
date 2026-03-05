import type { TrackPoint, DefectData, YAxisRange } from '../types'

// 缓存处理过的数据
let cachedProcessedData: {
  trackData: TrackPoint[]
  defects: DefectData[]
} | null = null

let lastDataHash: string | null = null

// I 通道底线缓存（外部只读，通过 setter 写入）
export type IChannelBaseLineCache = {
  segments: Array<{ x1: number; x2: number }>
  noisePoints: Array<{ distanceMm: number; y: number; radius: number }>
  hash: string
}
export let cachedIChannelBaseLine: IChannelBaseLineCache | null = null

/** 供主文件写入 I 通道底线缓存（避免对导入变量直接赋值） */
export function setCachedIChannelBaseLine(value: IChannelBaseLineCache | null): void {
  cachedIChannelBaseLine = value
}

/**
 * 从 trackInspectionData 提取数据并转换格式
 */
export function extractTrackInspectionData(trackPlayer: any): {
  trackData: TrackPoint[]
  defects: DefectData[]
  yAxisData: YAxisRange[]
} {
  const rawData = trackPlayer.getTrackInspectionData()

  if (!rawData || Object.keys(rawData).length === 0) {
    console.warn('No track inspection data available')
    return { trackData: [], defects: [], yAxisData: [] }
  }

  // 使用数据的简化哈希值来检测变化
  const currentDataHash = JSON.stringify({
    usw1Length: Array.isArray(rawData.usw1) ? rawData.usw1.length : 0,
    usw2Length: Array.isArray(rawData.usw2) ? rawData.usw2.length : 0,
    usw3Length: Array.isArray(rawData.usw3) ? rawData.usw3.length : 0,
    usw4Length: Array.isArray(rawData.usw4) ? rawData.usw4.length : 0,
    usw5Length: Array.isArray(rawData.usw5) ? rawData.usw5.length : 0,
    usw6Length: Array.isArray(rawData.usw6) ? rawData.usw6.length : 0,
    usw7Length: Array.isArray(rawData.usw7) ? rawData.usw7.length : 0,
    usw8Length: Array.isArray(rawData.usw8) ? rawData.usw8.length : 0,
    usw9Length: Array.isArray(rawData.usw9) ? rawData.usw9.length : 0,
    winsLength: Array.isArray(rawData.wins) ? rawData.wins.length : 0,
  })

  // 如果数据没有变化，使用缓存
  if (lastDataHash === currentDataHash && cachedProcessedData) {
    return {
      trackData: cachedProcessedData.trackData,
      defects: cachedProcessedData.defects,
      yAxisData: [] // yAxisData 需要单独处理
    }
  }

  // 数据变化时，清除 I 通道底部线条缓存
  cachedIChannelBaseLine = null

  const trackData: TrackPoint[] = []
  const defects: DefectData[] = []

  // 处理各通道数据 (usw1-usw9)
  const channelMapping = [
    { key: 'usw1', channelId: 1 },
    { key: 'usw2', channelId: 2 },
    { key: 'usw3', channelId: 3 },
    { key: 'usw4', channelId: 4 },
    { key: 'usw5', channelId: 5 },
    { key: 'usw6', channelId: 6 },
    { key: 'usw7', channelId: 7 },
    { key: 'usw8', channelId: 8 },
    { key: 'usw9', channelId: 9 }
  ]

  // 转换通道数据格式
  for (const channel of channelMapping) {
    const channelData = rawData[channel.key as keyof typeof rawData]
    if (Array.isArray(channelData)) {
      for (const point of channelData) {
        if (point &&
          typeof (point as { x: number, y: number }).x === 'number' &&
          typeof (point as { x: number, y: number }).y === 'number') {
          const typedPoint = point as { x: number, y: number }
          trackData.push({
            channelId: channel.channelId,
            distanceMm: typedPoint.x,
            reflectionValue: typedPoint.y
          })
        }
      }
    }
  }

  // 处理窗口配置数据 - 生成 Y 轴区间
  const yAxisData: YAxisRange[] = []
  if (rawData.wins && Array.isArray(rawData.wins)) {
    for (const win of rawData.wins) {
      yAxisData.push({
        start: win.minX,
        end: win.maxX,
        min: win.yscales?.[0] ?? 0,
        max: win.yscales?.[win.yscales.length - 1] ?? 500,
        auxiliaryLineYScales: win.auxiliaryLineYScales || [],
        yscales: win.yscales || [],
        bottomLineYScale: win.bottomLineYScale
      })
    }
    console.log('Window configurations loaded:', yAxisData.length, 'windows')
  }

  // 缓存处理结果
  cachedProcessedData = { trackData, defects }
  lastDataHash = currentDataHash

  console.log(`Extracted ${trackData.length} data points from ${channelMapping.filter(c =>
    Array.isArray(rawData[c.key as keyof typeof rawData])).length} channels`)

  return { trackData, defects, yAxisData }
}

/**
 * 构建选中的米数（用于压缩显示）
 */
export function buildSelectedMetersFromDefects(defects: DefectData[]): {
  selectedMeters: number[]
  selectedMetersIndex: Map<number, number>
} {
  const set = new Set<number>()
  for (const d of defects) {
    const sm = Math.floor(Math.min(d.x1, d.x2) / 1000)
    const em = Math.floor(Math.max(d.x1, d.x2) / 1000)
    for (let m = sm; m <= em; m++) set.add(m)
  }

  const selectedMeters = Array.from(set).sort((a, b) => a - b)
  const selectedMetersIndex = new Map<number, number>()
  selectedMeters.forEach((m, idx) => selectedMetersIndex.set(m, idx))

  return { selectedMeters, selectedMetersIndex }
}
