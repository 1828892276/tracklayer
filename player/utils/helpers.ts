/**
 * 获取设备像素比
 */
export function getDPR(): number {
  return window.devicePixelRatio || 1
}

/**
 * 颜色转换：Hex 转 RGBA
 */
export function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0

  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16)
    g = parseInt(hex[3] + hex[4], 16)
    b = parseInt(hex[5] + hex[6], 16)
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Hex 转 RGB（用于 WebGL）
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0

  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16)
    g = parseInt(hex[3] + hex[4], 16)
    b = parseInt(hex[5] + hex[6], 16)
  }

  return { r: r / 255, g: g / 255, b: b / 255 }
}

/**
 * 清空画布并填充背景色
 */
export function clearCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bgColor: string = '#FFFFC0'
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
