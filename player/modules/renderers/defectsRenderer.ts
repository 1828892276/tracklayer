import type { CanvasState, DefectData } from '../../types'
import { hexToRgba } from '../../utils/helpers'
import { perfStart, perfEnd, perfStats } from '../../utils/perfMonitor'

export function drawDefects(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): void {
  const defectsStartTime = perfStart('drawDefects')

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 计算画布边界（提取循环不变量）
  const padding = state.grid
  const left = padding.left
  const right = canvasWidth - padding.right
  const top = padding.top
  const bottom = canvasHeight - padding.bottom

  for (const defect of state.defects) {
    // 检查缺陷是否在可见通道
    const isChannelVisible = state.visibleChannels[defect.channel - 1]
    if (!isChannelVisible) continue

    // 计算缺陷的屏幕坐标
    const x1 = mmToScreenPx(defect.x1)
    const x2 = mmToScreenPx(defect.x2)

    if (x1 === null || x2 === null) continue

    // 跳过视口外的缺陷
    if (x1 > right || x2 < left) continue

    // 获取 Y 轴位置（使用缺陷所在通道的 X 轴位置）
    const y1 = amplitudeToY_mm(defect.y1, defect.x1)
    const y2 = amplitudeToY_mm(defect.y2, defect.x1)

    // 在分解模式下，检查是否在对应区域
    if (y1 < top - 1 || y1 > bottom + 1) continue

    // 绘制缺陷矩形框
    ctx.strokeStyle = '#FF0000'
    ctx.lineWidth = 2
    ctx.strokeRect(x1, Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))

    // 绘制缺陷标签
    if (defect.note) {
      ctx.fillStyle = '#FF0000'
      ctx.font = '12px Arial'
      ctx.fillText(defect.note, x1, Math.min(y1, y2) - 5)
    }
  }

  perfStats.drawDefectsTime += perfEnd('drawDefects', defectsStartTime)
}