import type { CanvasState, TipsInfo } from '../../types'
import type { Ref } from 'vue'

export interface MouseHandlers {
  mousedownFn: (e: MouseEvent) => void
  mousemoveFn: (e: MouseEvent) => void
  mouseupFn: () => void
  mouseoutFn: () => void
}

/**
 * 创建鼠标事件处理器
 */
export function createMouseHandlers(
  state: CanvasState,
  canvas: Ref<HTMLCanvasElement | null>,
  tips: Ref<TipsInfo>,
  trackPlayer: any,
  computeViewportBoundsAndClamp: () => void,
  renderResource: () => void,
  screenPxToDistanceMm: (px: number) => number,
  screenYToAmplitudeMm: (screenY: number) => number
): MouseHandlers {
  /**
   * 鼠标按下事件处理
   */
  function handleMousedown(e: MouseEvent): void {
    if (!canvas.value) return

    const rect = canvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (trackPlayer.isAdd) {
      // 开始绘制缺陷
      state.drawingDefect = true
      state.drawingStartPos = { x, y }
      state.drawingCurrentPos = { ...state.drawingStartPos }
    } else {
      // 开始平移
      state.isDown = true
      state.startX = e.clientX
      state.startY = e.clientY
      state.startOffset = state.viewportOffsetPx
      state.startOffsetY = state.viewportOffsetPy
      state.drawingDefect = false
    }
  }

  /**
   * 鼠标移动事件处理
   */
  function handleMousemove(e: MouseEvent): void {
    if (!canvas.value) return

    const rect = canvas.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (trackPlayer.isAdd && state.drawingDefect) {
      // 正在绘制缺陷矩形
      state.drawingCurrentPos = {
        x: mouseX,
        y: mouseY
      }
      renderResource()
    } else if (state.isDown) {
      // 正在平移
      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY
      state.viewportOffsetPx = state.startOffset - dx
      state.viewportOffsetPy = state.startOffsetY + dy
      computeViewportBoundsAndClamp()
      renderResource()
    } else {
      // 更新悬浮提示（仅在未拖拽时）
      const padding = state.grid
      const left = padding.left
      const right = canvas.value.width - padding.right
      const top = padding.top
      const bottom = canvas.value.height - padding.bottom

      const withinDrawingArea =
        mouseX >= left &&
        mouseX <= right &&
        mouseY >= top &&
        mouseY <= bottom

      if (withinDrawingArea) {
        const distanceMm = screenPxToDistanceMm(mouseX)
        const amplitudeMm = screenYToAmplitudeMm(mouseY)

        const km = Math.floor(distanceMm / 1000)
        const remainingMm = Math.abs(distanceMm % 1000)
        const formattedKm = `${km}.${String(Math.round(remainingMm)).padStart(3, '0')}km`
        const formattedDepth = `${amplitudeMm.toFixed(2)}mm`

        tips.value = {
          x: mouseX,
          y: mouseY,
          show: true,
          text: `${formattedKm}, ${formattedDepth}`,
        }
      } else {
        tips.value.show = false
      }
    }
  }

  /**
   * 鼠标松开事件处理
   */
  function handleMouseup(): void {
    if (trackPlayer.isAdd && state.drawingDefect) {
      // 完成缺陷绘制
      state.drawingDefect = false
      if (!canvas.value) return

      const x1Px = Math.min(state.drawingStartPos.x, state.drawingCurrentPos.x)
      const x2Px = Math.max(state.drawingStartPos.x, state.drawingCurrentPos.x)
      const yTopPx = Math.min(state.drawingStartPos.y, state.drawingCurrentPos.y)
      const yBottomPx = Math.max(state.drawingStartPos.y, state.drawingCurrentPos.y)

      const x1Mm = screenPxToDistanceMm(x1Px)
      const x2Mm = screenPxToDistanceMm(x2Px)
      const y1Mm = screenYToAmplitudeMm(yTopPx)
      const y2Mm = screenYToAmplitudeMm(yBottomPx)

      // 暂时仅输出坐标，具体创建缺陷由上层业务处理
      // 保持与旧版行为一致
      // eslint-disable-next-line no-console
      console.log({ x1: x1Mm, y1: y1Mm, x2: x2Mm, y2: y2Mm })
    } else {
      state.isDown = false
    }
  }

  /**
   * 鼠标离开画布事件处理
   */
  function handleMouseout(): void {
    state.isDown = false
    tips.value.show = false
  }

  return {
    mousedownFn: handleMousedown,
    mousemoveFn: handleMousemove,
    mouseupFn: handleMouseup,
    mouseoutFn: handleMouseout
  }
}