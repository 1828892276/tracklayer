import { Ref } from 'vue'

// 设备像素比
export interface DPRConfig {
  value: number
}

// Y 轴区间配置
export interface YAxisRange {
  start: number      // X 轴区间起始点，单位 mm
  end: number        // X 轴区间结束点，单位 mm
  min: number        // Y轴顶部数值，单位 mm
  max: number        // Y 轴底部数值，单位 mm
  auxiliaryLineYScales?: number[] // 辅助线 Y 轴刻度
  yscales?: number[] // Y 轴刻度
  bottomLineYScale?: number // I 通道底部基准线的 Y 轴位置
}

// 画布网格配置
export interface GridConfig {
  left: number
  right: number
  top: number
  bottom: number
}

// 垂直模式配置
export interface VerticalMode {
  name: string
  mmPerPx: number
}

// 视口边界
export interface ViewportBounds {
  minOffset: number
  maxOffset: number
  minYOffset: number
  maxYOffset: number
  centerMinMm: number
  centerMaxMm: number
}

// 全局状态接口
export interface CanvasState {
  scale: number
  loaded: boolean
  selectedDefectId: number | undefined
  animationFrame: number
  ctx: CanvasRenderingContext2D | null

  // 轨道探伤数据
  trackData: TrackPoint[]
  defects: DefectData[]
  visibleChannels: boolean[]
  currentDistanceMm: number

  // 坐标映射
  BASE_H_mm_per_px: number
  currentMode: 'combo' | 'decomp'

  // 画布配置
  grid: GridConfig
  verticalModes: {
    combo: VerticalMode
    decomp: VerticalMode
  }

  // 视口状态
  viewportOffsetPx: number
  viewportOffsetPy: number
  viewportBounds: ViewportBounds

  // 交互状态
  isDown: boolean
  startX: number
  startY: number
  startOffset: number
  startOffsetY: number
  drawingDefect: boolean
  drawingStartPos: Position
  drawingCurrentPos: Position

  loading: boolean
  onlyDefectMeters: boolean

  // 播放状态
  lastFrameTs: number
  baseSpeedMh: number

  // 缩放配置
  MIN_SCALE: number
  MAX_SCALE: number

  // 压缩显示
  selectedMeters: number[]
  selectedMetersIndex: Map<number, number>

  // 颜色配置
  COLORS: string[]
}

// 探伤数据点
export interface TrackPoint {
  channelId: number
  distanceMm: number
  reflectionValue: number
}

// 缺陷数据
export interface DefectData {
  id: number
  channel: number
  x1: number
  y1: number
  x2: number
  y2: number
  note?: string
}

// 位置坐标
export interface Position {
  x: number
  y: number
}

// Tips 悬浮框
export interface TipsInfo {
  x: number
  y: number
  show: boolean
  text: string
}

// CanvasDraw 导出接口
export interface CanvasDraw {
  canvas: Ref<any>
  mousedownFn: (e: MouseEvent) => void
  mousemoveFn: (e: MouseEvent) => void
  mouseupFn: () => void
  mouseoutFn: () => void
  wheelFn: (e: WheelEvent) => void
  dblclickFn: (e: MouseEvent) => void
  clickFn: (e: MouseEvent) => void
  play: () => void
  pause: () => void
  seekTo: (time: number) => void
  getDataURL: (hasDefect?: boolean, defect?: DefectData) => string
  resetFn: () => void
  refreshFn: () => void
  state: CanvasState
  tips: Ref<TipsInfo>
  getSelectedDefect: () => DefectData | null
  setDisplayMode: (mode: string) => void
  setChannelVisibility: (channel: number, visible: boolean) => void
  getCenterMm: () => number
  getCurrentScale: () => number
  resetZoom: () => void
  setViewCenterMm: (targetMm: number) => void
  resizeResourceFn: () => void
  download: () => void
  updateGridConfig: (config: Partial<GridConfig>) => void
}

// 离屏缓存配置
export interface OffscreenCache {
  canvas: HTMLCanvasElement | null
  hash: string | null
}

// I 通道底线缓存
export interface IChannelBaseLineCache {
  segments: Array<{ x1: number; x2: number }>
  noisePoints: Array<{ distanceMm: number; y: number; radius: number }>
  hash: string
}
