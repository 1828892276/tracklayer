import type { CanvasState } from '../../types'
import { perfStart, perfEnd, perfStats } from '../../utils/perfMonitor'
import { getDPR } from '../../utils/helpers'

/**
 * 绘制 Y 轴标签
 */
export function drawYAxisLabels(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number
): void {
  const yAxisLabelsStartTime = perfStart('drawYAxisLabels')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 计算画布尺寸和边距（提取循环不变量）
  const padding = state.grid
  const left = padding.left
  const right = canvasWidth - padding.right
  const top = padding.top
  const bottom = canvasHeight - padding.bottom

  // 获取画布右侧对应的 X 轴位置来确定 Y 轴区间
  const rightEdge = canvasWidth / getDPR() - 20 // 画布右侧边缘
  const pxPerMm = (state.BASE_H_mm_per_px || 0.5) * state.scale
  const rightRel = rightEdge - state.viewportOffsetPx
  const rightMm = rightRel / pxPerMm // 右侧对应的毫米值
  const yAxisRange = getYAxisRangeForPosition(rightMm) // 根据右侧位置获取 Y轴区间

  if (!yAxisRange) {
    perfStats.drawYAxisLabelsTime += perfEnd('drawYAxisLabels', yAxisLabelsStartTime)
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

  // 设置字体样式
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left' // 改为左对齐，因为标签在右侧
  ctx.textBaseline = 'middle'

  // 绘制刻度线和标签（来自 auxiliaryLineYScales）- 标签在右侧显示
  const auxiliaryLabels = (yAxisRange as any).auxiliaryLineYScales || []
  for (const value of auxiliaryLabels) {
    // 计算该值对应的 Y 坐标
    const valueOffset = (value - centerValue) * pxPerMmV
    const y = centerY + valueOffset + state.viewportOffsetPy

    if (y >= top && y <= bottom) {
      // 绘制标签（在右侧显示）
      ctx.fillStyle = '#222' // 使用黑色文本
      ctx.fillText(value + ' mm', right + 8, y) // 标签绘制在右侧
    }
  }

  // 绘制 yscales 刻度（只绘制 Y 轴上的刻度标记，不绘制标签和平行于 X 轴的虚线）
  const yscales = (yAxisRange as any).yscales || []
  for (const value of yscales) {
    // 跳过与 auxiliaryLineYScales 重复的值
    if (auxiliaryLabels.includes(value)) continue

    // 计算该值对应的 Y 坐标
    const valueOffset = (value - centerValue) * pxPerMmV
    const y = centerY + valueOffset + state.viewportOffsetPy

    if (y >= top && y <= bottom) {
      // 绘制刻度线 - 从左侧绘制到右侧
      ctx.strokeStyle = '#CCCCCC'
      ctx.beginPath()
      ctx.moveTo(right, y)
      ctx.lineTo(right + 6, y) // 从左侧绘制到右侧
      ctx.stroke()
      // 注意：yscales 不绘制标签文字
    }
  }

  perfStats.drawYAxisLabelsTime += perfEnd('drawYAxisLabels', yAxisLabelsStartTime)
}

/**
 * 绘制 X 轴刻度
 */
export function drawXAxisTicks(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  screenPxToDistanceMm: (px: number) => number
): void {
  const xAxisTicksStartTime = perfStart('drawXAxisTicks')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 计算画布尺寸和边距（提取循环不变量）
  const padding = state.grid
  const left = padding.left
  const right = canvasWidth - padding.right
  const bottom = canvasHeight - padding.bottom

  // 设置字体样式
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#222' // 使用黑色文本

  if (state.onlyDefectMeters) {
    // 在 onlyDefectMeters 模式下，只显示有缺陷的米
    for (const m of state.selectedMeters) {
      // 在每米的中心位置（500mm 处）放置标签
      const mmPosStart = m * 1000
      const px = mmToScreenPx(mmPosStart + 500)
      if (px === null) continue
      // 由于 X 轴方向改变，需要正确处理坐标范围检查
      if (px < left - 40 || px > right + 40) continue

      ctx.strokeStyle = '#CCCCCC'
      ctx.beginPath()
      ctx.moveTo(px, bottom)
      ctx.lineTo(px, bottom + 6)
      ctx.stroke()

      // 格式化为公里。米格式，如 5.100, 5.200
      const kmPart = Math.floor(m / 1000)
      const mPart = m % 1000
      const label = `${kmPart}.${String(mPart).padStart(3, '0')}`

      ctx.fillStyle = '#222'
      ctx.fillText(label, px, bottom + 8)
    }
    perfStats.drawXAxisTicksTime += perfEnd('drawXAxisTicks', xAxisTicksStartTime)
    return
  }

  // 计算当前可见范围
  // 由于 X 轴从右到左，屏幕左边的像素对应更大的 mm 值，屏幕右边的像素对应更小的 mm 值
  const startMm = screenPxToDistanceMm(right) // right 边对应更小的 mm 值
  const endMm = screenPxToDistanceMm(left) // left 边对应更大的 mm 值

  // 按分米（100mm）为单位绘制刻度
  const dmStep = 100 // 100mm = 1 分米

  // 检查标签之间是否可能会重叠，如果是，则使用更大的步长
  const pxPerMm = (state.BASE_H_mm_per_px || 0.5) * state.scale
  const dmStepPx = dmStep * pxPerMm // 分米步长对应的像素

  // 测量文本宽度以判断是否会重叠
  const testLabel = '000.000' // 最宽的标签示例
  const textWidth = ctx.measureText(testLabel).width
  const minSpacing = textWidth + 10 // 最小间距，留出一些余量

  let stepMm = dmStep // 默认使用分米步长
  if (dmStepPx < minSpacing) {
    // 如果分米步长太密，使用米步长
    stepMm = 1000 // 1 米 = 1000mm
  } else if (dmStepPx < minSpacing * 0.5) {
    // 如果仍然太密，使用更大的步长
    stepMm = 2000 // 2 米 = 2000mm
  }

  // 确保起始点是 stepMm 的倍数
  let currentMm = Math.floor(startMm / stepMm) * stepMm

  // 如果 stepMm 是分米（100mm），我们需要特别处理标签格式
  const isDmStep = stepMm === 100

  for (; currentMm <= Math.ceil(endMm); currentMm += stepMm) {
    const px = mmToScreenPx(currentMm)
    if (px === null) continue
    if (px < left - 40 || px > right + 40) continue

    // 绘制刻度线
    ctx.strokeStyle = '#CCCCCC'
    ctx.beginPath()
    if (currentMm % 1000 === 0) {
      // 对于每米（1000mm）的刻度，绘制较长的刻度线并显示标签
      ctx.moveTo(px, bottom)
      ctx.lineTo(px, bottom + 6)
    } else {
      // 对于其他刻度（如分米），绘制较短的刻度线
      ctx.moveTo(px, bottom)
      ctx.lineTo(px, bottom + 3)
    }
    ctx.stroke()

    // 绘制标签（只有在步长大于分米或使用分米步长时才显示标签）
    if (stepMm >= 1000 || isDmStep) {
      // 格式化标签
      const m = Math.floor(currentMm / 1000) // 米数
      const remainingMm = currentMm % 1000

      let label
      if (isDmStep && stepMm === 100) {
        // 分米步长的格式，例如 0.100, 0.200, 0.300
        label = `${m}.${String(remainingMm).padStart(3, '0')}`
      } else {
        // 米步长的格式
        label = `${m}.${String(remainingMm).padStart(3, '0')}`
      }

      ctx.fillStyle = '#222'
      ctx.fillText(label, px, bottom + 8)
    }
  }

  perfStats.drawXAxisTicksTime += perfEnd('drawXAxisTicks', xAxisTicksStartTime)
}