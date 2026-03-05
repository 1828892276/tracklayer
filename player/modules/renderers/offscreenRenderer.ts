import type { CanvasState } from '../../types'
import { perfStart, perfEnd, perfStats } from '../../utils/perfMonitor'
import { getDPR } from '../../utils/helpers'

// 离屏缓存
let offscreenCanvas: HTMLCanvasElement | null = null
let cachedOffscreenHash: string | null = null

/**
 * 生成离屏缓存（静态元素）
 */
export function generateOffscreenCache(
  state: CanvasState,
  canvas: HTMLCanvasElement,
  drawGridFn: (
    ctx: CanvasRenderingContext2D,
    state: CanvasState,
    canvas: HTMLCanvasElement,
    getYAxisRangeForPosition: (xMm: number) => any,
    pxPerMmV_current: () => number,
    amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
  ) => void,
  drawYAxisLabelsFn: (
    ctx: CanvasRenderingContext2D,
    state: CanvasState,
    canvas: HTMLCanvasElement,
    getYAxisRangeForPosition: (xMm: number) => any,
    pxPerMmV_current: () => number
  ) => void,
  drawXAxisTicksFn: (
    ctx: CanvasRenderingContext2D,
    state: CanvasState,
    canvas: HTMLCanvasElement,
    mmToScreenPx: (mm: number) => number | null,
    screenPxToDistanceMm: (px: number) => number
  ) => void,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  mmToScreenPx: (mm: number) => number | null,
  screenPxToDistanceMm: (px: number) => number
): HTMLCanvasElement {
  const offscreenGenStartTime = perfStart('offscreenGen')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 创建或复用离屏 Canvas
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas')
  }

  offscreenCanvas.width = canvasWidth
  offscreenCanvas.height = canvasHeight

  const offCtx = offscreenCanvas.getContext('2d')!

  // 清空画布
  offCtx.clearRect(0, 0, canvasWidth, canvasHeight)
  offCtx.fillStyle = state.COLORS[0] || '#FFFFC0'
  offCtx.fillRect(0, 0, canvasWidth, canvasHeight)

  // 绘制静态元素到离屏 Canvas
  const gridStartTime = perfStart('drawGrid')
  drawGridFn(offCtx, state, offscreenCanvas, getYAxisRangeForPosition, pxPerMmV_current, amplitudeToY_mm)
  perfStats.drawGridTime += perfEnd('drawGrid', gridStartTime)

  const yAxisLabelsStartTime = perfStart('drawYAxisLabels')
  drawYAxisLabelsFn(offCtx, state, offscreenCanvas, getYAxisRangeForPosition, pxPerMmV_current)
  perfStats.drawYAxisLabelsTime += perfEnd('drawYAxisLabels', yAxisLabelsStartTime)

  const xAxisTicksStartTime = perfStart('drawXAxisTicks')
  drawXAxisTicksFn(offCtx, state, offscreenCanvas, mmToScreenPx, screenPxToDistanceMm)
  perfStats.drawXAxisTicksTime += perfEnd('drawXAxisTicks', xAxisTicksStartTime)

  cachedOffscreenHash = getOffscreenCacheHash(state)

  perfStats.offscreenGenTime += perfEnd('offscreenGen', offscreenGenStartTime)

  return offscreenCanvas
}

/**
 * 获取离屏缓存哈希值
 */
export function getOffscreenCacheHash(state: CanvasState): string {
  return JSON.stringify({
    scale: state.scale,
    grid: state.grid,
    BASE_H_mm_per_px: state.BASE_H_mm_per_px,
    viewportOffsetPx: state.viewportOffsetPx,
    viewportOffsetPy: state.viewportOffsetPy,
  })
}

/**
 * 检查离屏缓存是否有效
 */
export function isOffscreenCacheValid(currentHash: string): boolean {
  return cachedOffscreenHash === currentHash && offscreenCanvas !== null
}

/**
 * 获取离屏 Canvas
 */
export function getOffscreenCanvas(): HTMLCanvasElement | null {
  return offscreenCanvas
}

/**
 * 清除离屏缓存
 */
export function clearOffscreenCache(): void {
  offscreenCanvas = null
  cachedOffscreenHash = null
}