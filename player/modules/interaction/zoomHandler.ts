import type { CanvasState } from '../../types'
import type { Ref } from 'vue'

export interface ZoomHandlers {
  wheelFn: (e: WheelEvent) => void
}

export function createZoomHandlers(
  state: CanvasState,
  canvasRef: Ref<HTMLCanvasElement | null>,
  getDPR: () => number,
  getCurrentPxPerMmH: () => number,
  getBaseAdaptivePxPerMm: () => number,
  clampViewportOffset: () => void,
  renderResource: () => void
): ZoomHandlers {
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()

    const canvas = canvasRef.value
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left // 鼠标相对于画布的 X 位置

    // 计算缩放前鼠标位置下的世界坐标（mm）
    const pxPerMm = getCurrentPxPerMmH()

    // 由于 X 轴方向从右到左，需要使用正确的计算方式
    const totalWidthForWheel = canvas.width / getDPR()
    const rightEdgeForWheel = totalWidthForWheel - state.grid.right // 右边距
    const rel = rightEdgeForWheel - mouseX - state.viewportOffsetPx
    const originalWorldPosMm = rel / pxPerMm

    // 计算缩放系数
    const zoomIntensity = 0.1
    const scaleFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity)

    // 应用缩放并限制边界
    const newScale = Math.min(state.MAX_SCALE, Math.max(state.MIN_SCALE, state.scale * scaleFactor))
    state.scale = newScale

    // 计算新的偏移量以保持鼠标位置固定在同一世界坐标上
    // 使用基础自适应比例避免循环依赖
    const basePxPerMm = getBaseAdaptivePxPerMm()
    const newPxPerMmH = basePxPerMm * state.scale
    // 修改：由于 X 轴方向改变，偏移计算方式也要改变
    const totalWidth = canvas.width / getDPR()
    const rightEdge = totalWidth - state.grid.right // 右边距
    state.viewportOffsetPx = rightEdge - originalWorldPosMm * newPxPerMmH - mouseX // 左边距，但现在从右边计算

    clampViewportOffset()
    renderResource()
  }

  return {
    wheelFn: handleWheel
  }
}