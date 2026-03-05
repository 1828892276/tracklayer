// 类型定义
export * from '../types'

// 工具函数
export * from '../utils/helpers'
export { perfStart, perfEnd, printPerfStats, perfStats, resetPerfStats, resetFrameCount } from '../utils/perfMonitor'

// 数据处理
export { extractTrackInspectionData, buildSelectedMetersFromDefects, cachedIChannelBaseLine, setCachedIChannelBaseLine } from './dataProcessor'

// 渲染器
export * from '../modules/renderers'
export { drawGrid } from '../modules/renderers/gridRenderer'
export { drawYAxisLabels, drawXAxisTicks } from '../modules/renderers/axisRenderer'
export { drawTrackPoints } from '../modules/renderers/trackPointsRenderer'
export { drawDefects } from '../modules/renderers/defectsRenderer'
export {
  generateOffscreenCache,
  getOffscreenCacheHash,
  isOffscreenCacheValid,
  getOffscreenCanvas,
  clearOffscreenCache,
} from '../modules/renderers/offscreenRenderer'

// 交互处理器
export { createMouseHandlers, type MouseHandlers } from '../modules/interaction/mouseHandler'
export { createZoomHandlers, type ZoomHandlers } from '../modules/interaction/zoomHandler'

// 生命周期钩子
export { useLifecycle } from '../hooks/useLifecycle'
