import type { CanvasState, TrackPoint } from '../../types'
import { perfStart, perfEnd, perfStats } from '../../utils/perfMonitor'

// 绘制常量
const DATA_POINT_RADIUS = 4
const CORNER_RADIUS = 2
const PROTRUSION = 2

// I 通道底线缓存
interface IChannelBaseLineCache {
  segments: Array<{ x1: number; x2: number }>
  noisePoints: Array<{ distanceMm: number; y: number; radius: number }>
  hash: string
}

let cachedIChannelBaseLine: IChannelBaseLineCache | null = null

/**
 * 绘制探伤数据点
 */
export function drawTrackPoints(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  isSplitMode: () => boolean,
  getChannelRegion: (channelId: number) => { regionTop: number; regionBottom: number },
  // I 通道底线绘制相关函数
  getYAxisRangeForPosition: (xMm: number) => any,
  getCurrentPxPerMmH: () => number,
  screenPxToDistanceMm: (px: number) => number
): void {
  const trackPointsStartTime = perfStart('drawTrackPoints')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 计算画布尺寸和边距（提取循环不变量）
  const padding = state.grid
  const left = padding.left
  const right = canvasWidth - padding.right
  const top = padding.top
  const bottom = canvasHeight - padding.bottom

  // 固定尺寸的矩形参数（预计算）
  const rectSize = DATA_POINT_RADIUS * 2
  const halfRectSize = DATA_POINT_RADIUS

  for (let ch = 0; ch < 9; ch++) {
    const channelLetter = String.fromCharCode(65 + ch)
    const isChannelChecked = (state as any).checkedTracks?.includes(channelLetter)

    if (!state.visibleChannels[ch] || !isChannelChecked) continue

    ctx.fillStyle = state.COLORS[ch % state.COLORS.length]

    // 获取通道区域（分解模式下使用）
    let regionTop = top
    let regionBottom = bottom

    if (isSplitMode()) {
      const regionInfo = getChannelRegion(ch + 1)
      regionTop = regionInfo.regionTop
      regionBottom = regionInfo.regionBottom
    }

    // I 通道（通道 9）特殊处理
    if (ch === 8) {
      drawIChannelDataPoints(
        ctx,
        state.trackData,
        ch,
        left,
        right,
        regionTop,
        regionBottom,
        mmToScreenPx,
        amplitudeToY_mm,
        rectSize,
        halfRectSize,
        CORNER_RADIUS,
        PROTRUSION
      )

      // 绘制底部基准直线
      drawIChannelBaseLine(
        ctx,
        state,
        canvas,
        left,
        right,
        ch,
        mmToScreenPx,
        amplitudeToY_mm,
        getYAxisRangeForPosition,
        getCurrentPxPerMmH,
        screenPxToDistanceMm
      )
      continue
    }

    // 绘制其他通道数据点
    drawChannelDataPoints(
      ctx,
      state.trackData,
      ch,
      left,
      right,
      regionTop,
      regionBottom,
      mmToScreenPx,
      amplitudeToY_mm,
      rectSize,
      halfRectSize,
      CORNER_RADIUS,
      PROTRUSION
    )
  }

  perfStats.drawTrackPointsTime += perfEnd('drawTrackPoints', trackPointsStartTime)
}

/**
 * 绘制单个通道的数据点
 */
function drawChannelDataPoints(
  ctx: CanvasRenderingContext2D,
  trackData: TrackPoint[],
  channelIndex: number,
  left: number,
  right: number,
  regionTop: number,
  regionBottom: number,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  rectSize: number,
  halfRectSize: number,
  cornerRadius: number,
  protrusion: number
): void {
  for (const p of trackData) {
    if (p.channelId - 1 !== channelIndex) continue

    const px = mmToScreenPx(p.distanceMm)
    if (px === null) continue
    if (px < left - 1 || px > right + 1) continue

    const py = amplitudeToY_mm(p.reflectionValue, p.distanceMm)

    // 在分解模式下，检查是否在对应区域内
    if (py < regionTop - 1 || py > regionBottom + 1) continue

    // 绘制圆角矩形数据点
    drawRoundedPoint(ctx, px, py, rectSize, halfRectSize, cornerRadius, protrusion)
  }
}

/**
 * 绘制 I 通道数据点
 */
function drawIChannelDataPoints(
  ctx: CanvasRenderingContext2D,
  trackData: TrackPoint[],
  channelIndex: number,
  left: number,
  right: number,
  regionTop: number,
  regionBottom: number,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  rectSize: number,
  halfRectSize: number,
  cornerRadius: number,
  protrusion: number
): void {
  for (const p of trackData) {
    if (p.channelId - 1 !== channelIndex) continue

    const px = mmToScreenPx(p.distanceMm)
    if (px === null) continue
    if (px < left - 1 || px > right + 1) continue

    const py = amplitudeToY_mm(p.reflectionValue, p.distanceMm)

    if (py < regionTop - 1 || py > regionBottom + 1) continue

    drawRoundedPoint(ctx, px, py, rectSize, halfRectSize, cornerRadius, protrusion)
  }
}

/**
 * 绘制单个圆角矩形数据点
 */
function drawRoundedPoint(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  rectSize: number,
  halfRectSize: number,
  cornerRadius: number,
  protrusion: number
): void {
  ctx.beginPath()

  const x = px - halfRectSize
  const y = py - halfRectSize

  // 绘制圆角矩形路径
  ctx.moveTo(x + cornerRadius, y)
  ctx.lineTo(x + rectSize - cornerRadius, y)
  ctx.arcTo(x + rectSize, y, x + rectSize, y + cornerRadius, cornerRadius)
  ctx.lineTo(x + rectSize, y + rectSize - cornerRadius)
  ctx.arcTo(x + rectSize, y + rectSize, x + rectSize - cornerRadius, y + rectSize, cornerRadius)
  ctx.lineTo(x + cornerRadius, y + rectSize)
  ctx.arcTo(x, y + rectSize, x, y + rectSize - cornerRadius, cornerRadius)
  ctx.lineTo(x, y + cornerRadius)
  ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius)
  ctx.closePath()
  ctx.fill()

  // 绘制四边中点向外突出的部分
  ctx.fillRect(px - 0.5, py - halfRectSize - protrusion, 1, protrusion)
  ctx.fillRect(px - 0.5, py + halfRectSize, 1, protrusion)
  ctx.fillRect(px - halfRectSize - protrusion, py - 0.5, protrusion, 1)
  ctx.fillRect(px + halfRectSize, py - 0.5, protrusion, 1)
}

/**
 * 绘制带圆角的水平线段
 */
function drawRoundedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  halfHeight: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.moveTo(x1 + radius, y - halfHeight)
  ctx.lineTo(x2 - radius, y - halfHeight)
  ctx.arcTo(x2, y - halfHeight, x2, y, radius)
  ctx.arcTo(x2, y + halfHeight, x2 - radius, y + halfHeight, radius)
  ctx.lineTo(x1 + radius, y + halfHeight)
  ctx.arcTo(x1, y + halfHeight, x1, y, radius)
  ctx.arcTo(x1, y - halfHeight, x1 + radius, y - halfHeight, radius)
  ctx.closePath()
  ctx.fill()
}

/**
 * 计算 I 通道底线分段和噪点
 */
function calculateIChannelBaseLine(
  left: number,
  right: number,
  iChannelPoints: { x: number }[],
  dataHash: string,
  lineY: number,
  halfLineWidth: number,
  mmToScreenPx: (mm: number) => number | null,
  screenPxToDistanceMm: (px: number) => number,
  getCurrentPxPerMmH: () => number
): void {
  const gapWidth = 20

  // 噪点配置：每 10~30px 一组模式
  const noisePattern = [
    { offset: 10, side: 'top', size: 1 },
    { offset: 15, side: 'bottom', size: 2 },
    { offset: 25, side: 'top', size: 3 },
    { offset: 30, side: 'bottom', size: 4 },
  ]
  const noiseCycle = 30

  // 1. 底线分段（在异常点附近留空）
  const segments: Array<{ x1: number; x2: number }> = []
  let startX = left

  iChannelPoints.sort((a, b) => a.x - b.x)
  for (const point of iChannelPoints) {
    const gapStart = point.x - gapWidth / 2
    const gapEnd = point.x + gapWidth / 2
    if (gapStart > startX) {
      segments.push({ x1: startX, x2: Math.min(gapStart, right) })
    }
    startX = gapEnd
  }
  if (startX < right) {
    segments.push({ x1: startX, x2: right })
  }
  if (iChannelPoints.length === 0) {
    segments.push({ x1: left, x2: right })
  }

  // 2. 噪点位置（基于像素均匀分布）
  const noisePoints: Array<{ distanceMm: number; y: number; radius: number }> = []
  const leftMm = screenPxToDistanceMm(left)
  const rightMm = screenPxToDistanceMm(right)
  const pxPerMm = getCurrentPxPerMmH()
  const totalPx = (rightMm - leftMm) * pxPerMm
  const noiseCount = Math.floor(totalPx / 5)

  for (let i = 0; i < noiseCount; i++) {
    const px = left + i * 5
    const distanceMm = leftMm + (i * 5) / pxPerMm
    const screenPx = mmToScreenPx(distanceMm)
    if (screenPx === null) continue

    // 不在镂空区域内才绘制噪点
    let isInGap = false
    for (const point of iChannelPoints) {
      const gapStart = point.x - gapWidth / 2
      const gapEnd = point.x + gapWidth / 2
      if (screenPx >= gapStart && screenPx <= gapEnd) {
        isInGap = true
        break
      }
    }
    if (isInGap) continue

    const relativePx = (px - left) % noiseCycle
    for (const pattern of noisePattern) {
      if (Math.abs(relativePx - pattern.offset) < 2) {
        const centerY =
          pattern.side === 'top'
            ? lineY - halfLineWidth - pattern.size / 2
            : lineY + halfLineWidth + pattern.size / 2
        noisePoints.push({
          distanceMm,
          y: centerY,
          radius: pattern.size,
        })
        break
      }
    }
  }

  cachedIChannelBaseLine = { segments, noisePoints, hash: dataHash }
}

/**
 * 设置 I 通道底线缓存
 */
export function setCachedIChannelBaseLine(cache: IChannelBaseLineCache): void {
  cachedIChannelBaseLine = cache
}

/**
 * 获取 I 通道底线缓存
 */
export function getCachedIChannelBaseLine(): IChannelBaseLineCache | null {
  return cachedIChannelBaseLine
}

/**
 * 清除 I 通道底线缓存
 */
export function clearIChannelBaseLineCache(): void {
  cachedIChannelBaseLine = null
}

/**
 * 绘制 I 通道底部基准线（带镂空和噪点）
 */
function drawIChannelBaseLine(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  _canvas: HTMLCanvasElement,
  left: number,
  right: number,
  channelIndex: number,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  getYAxisRangeForPosition: (xMm: number) => any,
  getCurrentPxPerMmH: () => number,
  screenPxToDistanceMm: (px: number) => number
): void {
  const baseLineStartTime = perfStart('drawIChannelBaseLine')

  // 使用当前中心位置对应的 Y轴区间和 bottomLineYScale 计算基准线 Y 坐标
  const centerMm = state.currentDistanceMm || 0
  const yAxisRange = getYAxisRangeForPosition(centerMm)
  const bottomLineYScale = (yAxisRange as any).bottomLineYScale ?? yAxisRange.max
  const lineY = amplitudeToY_mm(bottomLineYScale, centerMm)

  const halfLineWidth = DATA_POINT_RADIUS

  // 收集 I 通道数据点的屏幕 X 坐标
  const iChannelPoints: { x: number }[] = []
  for (const p of state.trackData) {
    if (p.channelId !== 9) continue
    const px = mmToScreenPx(p.distanceMm)
    if (px === null) continue
    if (px < left - 10 || px > right + 10) continue
    iChannelPoints.push({ x: px })
  }

  // 生成数据哈希值，用于检测是否需要重新计算
  const dataHash = iChannelPoints.map(p => p.x.toFixed(2)).join(',')

  // 如果数据没有变化，使用缓存；否则重新计算
  if (!cachedIChannelBaseLine || cachedIChannelBaseLine.hash !== dataHash) {
    calculateIChannelBaseLine(
      left,
      right,
      iChannelPoints,
      dataHash,
      lineY,
      halfLineWidth,
      mmToScreenPx,
      screenPxToDistanceMm,
      getCurrentPxPerMmH
    )
  }

  const cache = cachedIChannelBaseLine
  if (!cache) {
    perfStats.drawIChannelBaseLineTime += perfEnd('drawIChannelBaseLine', baseLineStartTime)
    return
  }

  ctx.save()
  ctx.strokeStyle = state.COLORS[channelIndex % state.COLORS.length]
  ctx.fillStyle = state.COLORS[channelIndex % state.COLORS.length]
  ctx.lineWidth = DATA_POINT_RADIUS * 2

  // 绘制分段底线
  for (const segment of cache.segments) {
    drawRoundedLine(ctx, segment.x1, Math.min(segment.x2, right), lineY, halfLineWidth, 2)
  }

  // 绘制噪点
  for (const noise of cache.noisePoints) {
    const px = mmToScreenPx(noise.distanceMm)
    if (px === null) continue
    if (px < left - 10 || px > right + 10) continue
    ctx.beginPath()
    ctx.arc(px, noise.y, noise.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  perfStats.drawIChannelBaseLineTime += perfEnd('drawIChannelBaseLine', baseLineStartTime)
}
