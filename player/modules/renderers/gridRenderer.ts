import type { CanvasState } from '../../types'
import { perfStart, perfEnd, perfStats } from '../../utils/perfMonitor'
import { getDPR } from '../../utils/helpers'

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): void {
  const gridStartTime = perfStart('drawGrid')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 计算画布尺寸和边距（提取循环不变量）
  const padding = state.grid
  const left = padding.left
  const right = canvasWidth - padding.right
  const top = padding.top
  const bottom = canvasHeight - padding.bottom

  // 获取画布右侧对应的 X 轴位置来确定 Y轴区间
  const rightEdge = canvasWidth / getDPR() - 20 // 画布右侧边缘
  const pxPerMm = (state.BASE_H_mm_per_px || 0.5) * state.scale
  const rightRel = rightEdge - state.viewportOffsetPx
  const rightMm = rightRel / pxPerMm // 右侧对应的毫米值
  const yAxisRange = getYAxisRangeForPosition(rightMm) // 根据右侧位置获取 Y 轴区间

  if (!yAxisRange) {
    perfStats.drawGridTime += perfEnd('drawGrid', gridStartTime)
    return
  }

  // 根据当前模式和缩放计算实际的像素/mm比率
  const pxPerMmV = pxPerMmV_current()

  // 计算该区间内允许的 Y 轴范围，考虑 20px 的间距
  const usableTop = top + 20
  const usableBottom = bottom - 20

  // 计算中心点像素位置
  const centerY = (usableTop + usableBottom) / 2
  const centerValue = (yAxisRange.max + yAxisRange.min) / 2

  // 设置虚线样式：长短间隔（—-）
  ctx.setLineDash([10, 5])
  ctx.strokeStyle = '#CCCCCC'
  ctx.lineWidth = 1

  // 绘制辅助线（来自 auxiliaryLineYScales）
  const auxiliaryLines = (yAxisRange as any).auxiliaryLineYScales || []
  for (const yValue of auxiliaryLines) {
    // 计算该值对应的 Y 坐标
    const valueOffset = (yValue - centerValue) * pxPerMmV
    const y = centerY + valueOffset + state.viewportOffsetPy

    if (y >= top && y <= bottom) {
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
    }
  }

  // 恢复实线样式
  ctx.setLineDash([])

  // 绘制垂直网格线（X 轴方向）- 只在需要时绘制
  const currentPxPerMmH = pxPerMm
  const centerMm = state.currentDistanceMm || 0

  // 计算可见范围内的 X 轴刻度
  const startMm = centerMm - (left / currentPxPerMmH)
  const endMm = centerMm + ((right - left) / currentPxPerMmH)

  // 每隔一定距离绘制垂直线（例如每 100mm）
  const stepMm = 100
  const startStep = Math.floor(startMm / stepMm) * stepMm

  for (let mm = startStep; mm <= endMm; mm += stepMm) {
    const x = left + (mm - centerMm) * currentPxPerMmH
    if (x >= left && x <= right) {
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.stroke()
    }
  }

  perfStats.drawGridTime += perfEnd('drawGrid', gridStartTime)
}