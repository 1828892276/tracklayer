import { ref, nextTick, watch, onMounted, onUnmounted, reactive } from 'vue'
import { trackPlayerStore, B_DISPLAY_MODE } from './hooks'
import eventBus from '../../../utils/eventBus'

// 导入模块化函数
import {
  // 类型
  type CanvasDraw,
  type CanvasState,
  type YAxisRange,

  // 工具函数
  getDPR,
  clearCanvas,
  perfStart,
  perfEnd,
  printPerfStats,
  perfStats,

  // 数据处理
  extractTrackInspectionData as extractTrackData,
  buildSelectedMetersFromDefects as buildDefectMeters,

  // 交互处理器
  createMouseHandlers,
  createZoomHandlers,

  // 渲染器
  drawGrid,
  drawYAxisLabels,
  drawXAxisTicks,
  drawTrackPoints,
  drawDefects,

  // 离屏缓存
  generateOffscreenCache,
  getOffscreenCacheHash,
  isOffscreenCacheValid,
  getOffscreenCanvas,
  clearOffscreenCache,
} from './modules'

// 颜色常量
const CANVAS_BG_COLOR = '#FFFFC0'

export function useCanvasDraw(): CanvasDraw {
  // 全局数据
  const trackPlayer = trackPlayerStore()
  const canvas = ref()

  // Y 轴区间数据
  const yAxisData = ref<YAxisRange[]>([])

  // 根据 X 轴位置获取对应的 Y 轴区间（带缓存优化）
  let cachedYAxisRange: YAxisRange | null = null
  let cachedYAxisRangeXmm: number | null = null

  function getYAxisRangeForPosition(xMm: number): YAxisRange {
    if (cachedYAxisRange && cachedYAxisRangeXmm === xMm) {
      return cachedYAxisRange
    }

    if (!yAxisData.value || yAxisData.value.length === 0) {
      cachedYAxisRange = { start: 0, end: 100000, min: 0, max: 500 } as YAxisRange
      cachedYAxisRangeXmm = xMm
      return cachedYAxisRange
    }

    for (const range of yAxisData.value) {
      if (xMm >= range.start && xMm < range.end) {
        cachedYAxisRange = range
        cachedYAxisRangeXmm = xMm
        return range
      }
    }

    cachedYAxisRange = yAxisData.value[0] || { start: 0, end: 100000, min: 0, max: 500 } as YAxisRange
    cachedYAxisRangeXmm = xMm
    return cachedYAxisRange
  }

  // 全局状态管理
  const state = reactive<CanvasState>({
    scale: 1,
    loaded: false,
    selectedDefectId: undefined,
    animationFrame: 0,
    ctx: null as any,

    trackData: [],
    defects: [],
    visibleChannels: Array.from({ length: 9 }, () => true),
    currentDistanceMm: 0,

    BASE_H_mm_per_px: 3,
    currentMode: 'combo',

    grid: {
      left: 20,
      right: 80,
      top: 20,
      bottom: 100
    },

    verticalModes: {
      combo: { name: '组合', mmPerPx: 1 },
      decomp: { name: '分解', mmPerPx: 3 }
    },

    viewportOffsetPx: 0,
    viewportOffsetPy: 0,
    viewportBounds: {
      minOffset: 0,
      maxOffset: 0,
      minYOffset: 0,
      maxYOffset: 0,
      centerMinMm: 0,
      centerMaxMm: 100000
    },

    isDown: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    startOffsetY: 0,
    drawingDefect: false,
    drawingStartPos: { x: 0, y: 0 },
    drawingCurrentPos: { x: 0, y: 0 },

    loading: false,
    onlyDefectMeters: false,

    lastFrameTs: 0,
    baseSpeedMh: 2.5 * 1e3,

    MIN_SCALE: 1,
    MAX_SCALE: 5.0,

    selectedMeters: [],
    selectedMetersIndex: new Map<number, number>(),

    COLORS: trackPlayer.COLORS,
  })

  // 鼠标触摸信息悬浮框
  const tips = ref({
    x: 0,
    y: 0,
    show: false,
    text: '',
  })

  // 获取当前 B 显模式
  function getCurrentBMode(): string {
    return trackPlayer.toolData.bMode
  }

  // 判断是否为分解模式
  function isSplitMode(): boolean {
    return getCurrentBMode() === B_DISPLAY_MODE.SPLIT
  }

  // 判断是否为居中模式
  function isCenterMode(): boolean {
    return getCurrentBMode() === B_DISPLAY_MODE.CENTER
  }

  // 根据通道号获取对应的区域信息
  function getChannelRegion(channelId: number) {
    if (!isSplitMode()) {
      return { regionTop: 0, regionBottom: 0, regionIndex: 0 }
    }

    const canvasHeight = canvas.value.height / getDPR()
    const padding = state.grid
    const innerHeight = canvasHeight - padding.top - padding.bottom
    const regionHeight = innerHeight / 3

    if (channelId >= 1 && channelId <= 6) {
      return {
        regionTop: padding.top,
        regionBottom: padding.top + regionHeight,
        regionIndex: 0
      }
    } else if (channelId >= 7 && channelId <= 8) {
      return {
        regionTop: padding.top + regionHeight,
        regionBottom: padding.top + 2 * regionHeight,
        regionIndex: 1
      }
    } else if (channelId === 9) {
      return {
        regionTop: padding.top + 2 * regionHeight,
        regionBottom: canvasHeight - padding.bottom,
        regionIndex: 2
      }
    }

    return {
      regionTop: padding.top,
      regionBottom: padding.top + regionHeight,
      regionIndex: 0
    }
  }

  // 初始化播放器状态
  function initPlayState() {
    trackPlayer.isPlaying = false
    trackPlayer.isAdd = false
    state.onlyDefectMeters = false

    Object.assign(state, {
      scale: 1,
      loaded: false,
      currentDistanceMm: 0,
    })
  }

  // 初始化资源
  function initResourceFn() {
    initPlayState()
    if (state.ctx && canvas.value) {
      clearCanvas(canvas.value, state.ctx)
    }

    // 数据更新时清理离屏缓存
    clearOffscreenCache()

    // 使用模块化数据处理
    const { trackData, defects, yAxisData: newYAxisData } = extractTrackData(trackPlayer)
    state.trackData = trackData
    state.defects = defects

    // 更新 yAxisData
    if (newYAxisData && newYAxisData.length > 0) {
      yAxisData.value = newYAxisData
    }

    // 构建仅缺陷米压缩视图的数据
    const { selectedMeters, selectedMetersIndex } = buildDefectMeters(defects)
    state.selectedMeters = selectedMeters
    state.selectedMetersIndex = selectedMetersIndex

    initCanvs()
    state.loaded = true
    computeViewportBoundsAndClamp(true)
    state.viewportOffsetPx = state.viewportBounds.maxOffset
    renderResource()
  }

  // 尺寸变化重绘
  function resizeResourceFn() {
    clearOffscreenCache()
    initCanvs()
    renderResource()
  }

  // 初始化画布尺寸
  function initCanvs() {
    if (!canvas.value) return
    const div = canvas.value.parentElement
    if (!div) return
    state.ctx = canvas.value.getContext('2d')
    canvas.value.width = div.offsetWidth
    canvas.value.height = div.offsetHeight
  }

  // ==================== 坐标系统 ====================

  function getCenterMmSafe(): number {
    return state.currentDistanceMm || 0
  }

  function getCurrentPxPerMmH(): number {
    return (state.BASE_H_mm_per_px || 0.5) * state.scale
  }

  function getBaseAdaptivePxPerMm(): number {
    const canvasHeight = canvas.value?.height || 800
    const padding = state.grid

    // 根据不同模式计算可用高度
    let availableHeight: number
    if (isSplitMode()) {
      // 分解模式下，每个区域的高度是总高度的 1/3
      availableHeight = (canvasHeight - padding.top - padding.bottom) / 3
    } else if (isCenterMode()) {
      // 居中模式下，使用固定比例 1px = 3mm
      return 1 / 3 // 返回固定的 px/mm 比例
    } else {
      // 组合模式下，使用全部高度
      availableHeight = canvasHeight - padding.top - padding.bottom
    }

    // 计算 Y轴范围，使用当前中心位置对应的 X 轴位置
    const centerMm = getCenterMmSafe()
    const yAxisRange = getYAxisRangeForPosition(centerMm)

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    const usableTop = 20
    const usableBottom = availableHeight - 20
    const usableHeight = usableBottom - usableTop

    // 计算自适应比例：像素数 / mm 数
    return usableHeight / (yAxisRange.max - yAxisRange.min)
  }

  function pxPerMmV_current(): number {
    const modeConfig = state.verticalModes[state.currentMode as 'combo' | 'decomp']
    if (!modeConfig) return 1
    return (state.scale / modeConfig.mmPerPx) * getDPR()
  }

  function mmToScreenPx(mm: number): number | null {
    const centerMm = getCenterMmSafe()
    const pxPerMmH = getCurrentPxPerMmH()
    const screenMm = centerMm - state.viewportOffsetPx / pxPerMmH
    const relativeMm = mm - screenMm
    const padding = state.grid
    const result = padding.left + relativeMm * pxPerMmH
    return result
  }

  function amplitudeToY_mm(mmValue: number, xAxisPosition?: number): number {
    const canvasHeight = canvas.value?.height || 800
    const padding = state.grid
    const top = padding.top
    const bottom = canvasHeight - padding.bottom

    const targetX = xAxisPosition ?? getCenterMmSafe()
    const yAxisRange = getYAxisRangeForPosition(targetX)
    const normalized = (mmValue - yAxisRange.min) / (yAxisRange.max - yAxisRange.min)
    const availableHeight = bottom - top
    const y = bottom - normalized * availableHeight

    return y
  }

  // 屏幕 X 像素坐标转换为距离（mm）
  function screenPxToDistanceMm(screenPx: number): number {
    const pxPerMmH = getCurrentPxPerMmH()
    const padding = state.grid
    const centerMm = getCenterMmSafe()
    const screenMm = centerMm - state.viewportOffsetPx / pxPerMmH
    const relativeMm = (screenPx - padding.left) / pxPerMmH
    return screenMm + relativeMm
  }

  function screenYToAmplitudeMm(screenY: number, xAxisPosition?: number, channelId?: number): number {
    const canvasHeight = canvas.value?.height || 800
    const padding = state.grid

    // 计算 Y 轴范围
    const yAxisRange = xAxisPosition !== undefined
      ? getYAxisRangeForPosition(xAxisPosition)
      : getYAxisRangeForPosition(getCenterMmSafe())

    // 计算该区间内允许的 Y 轴范围，考虑 20px 的间距
    let usableTop: number, usableBottom: number, centerY: number

    if (isSplitMode() && channelId !== undefined) {
      // 分解模式下，每个通道有自己的区域
      const regionInfo = getChannelRegion(channelId)
      usableTop = regionInfo.regionTop + 20
      usableBottom = regionInfo.regionBottom - 20
      centerY = (usableTop + usableBottom) / 2
    } else if (isCenterMode()) {
      // 居中模式下，在画布中心显示
      const availableHeight = canvasHeight - padding.top - padding.bottom
      centerY = padding.top + availableHeight / 2
      usableTop = centerY - (availableHeight / 2 - 20)
      usableBottom = centerY + (availableHeight / 2 - 20)
    } else {
      // 组合模式下，使用全部高度
      usableTop = padding.top + 20
      usableBottom = canvasHeight - padding.bottom - 20
      centerY = (usableTop + usableBottom) / 2
    }

    const centerValue = (yAxisRange.max + yAxisRange.min) / 2

    // 从像素坐标反推 mm 值
    const pxPerMmV = pxPerMmV_current()
    const valueOffset = screenY - centerY - state.viewportOffsetPy
    return centerValue + valueOffset / pxPerMmV
  }

  // ==================== 渲染逻辑 ====================

  function renderResource() {
    if (state.ctx && state.loaded && canvas.value) {
      const renderStartTime = perfStart('totalRender')

      clearCanvas(canvas.value, state.ctx, CANVAS_BG_COLOR)

      // 检查离屏缓存
      const currentHash = getOffscreenCacheHash(state)
      if (!isOffscreenCacheValid(currentHash) && canvas.value) {
        generateOffscreenCache(
          state,
          canvas.value,
          drawGrid,
          drawYAxisLabels,
          drawXAxisTicks,
          getYAxisRangeForPosition,
          pxPerMmV_current,
          amplitudeToY_mm,
          mmToScreenPx,
          screenPxToDistanceMm
        )
      }

      const offscreen = getOffscreenCanvas()
      if (offscreen) {
        state.ctx.drawImage(offscreen, 0, 0)
      }

      // 绘制动态元素（数据点、缺陷等）
      renderDynamicElements(state.ctx)

      const totalRenderTime = perfEnd('totalRender', renderStartTime)
      perfStats.totalRenderTime += totalRenderTime
      printPerfStats()
    }
  }

  function renderDynamicElements(ctx: CanvasRenderingContext2D) {
    if (!canvas.value) return
    const canvasWidth = canvas.value.width
    const canvasHeight = canvas.value.height

    // 计算画布尺寸和边距
    const padding = state.grid
    const left = padding.left
    const right = canvasWidth - padding.right
    const top = padding.top
    const bottom = canvasHeight - padding.bottom

    // 保存上下文并设置裁剪区域
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, top, right - left, bottom - top)
    ctx.clip()

    // 绘制探伤数据点（包括 I 通道特殊处理）
    drawTrackPoints(
      ctx,
      state,
      canvas.value,
      mmToScreenPx,
      amplitudeToY_mm,
      isSplitMode,
      getChannelRegion,
      getYAxisRangeForPosition,
      getCurrentPxPerMmH,
      screenPxToDistanceMm
    )

    // 绘制缺陷
    drawDefects(ctx, state, canvas.value, mmToScreenPx, amplitudeToY_mm)

    ctx.restore()

    // TODO: 绘制当前绘制的矩形框（如果在绘制状态下）
    // renderCurrentRect()
  }

  // ==================== 辅助方法 ====================

  let resetToLeftIfNeededFlag = false

  function computeViewportBoundsAndClamp(resetLeft = false) {
    const w = canvas.value.width / getDPR()
    const h = canvas.value.height / getDPR()
    const left = state.grid.left
    const right = w - state.grid.right
    const top = state.grid.top
    const bottom = h - state.grid.bottom
    const innerWidth = right - left
    const innerHeight = bottom - top

    // 计算数据宽度
    let dataWidthPx: number
    if (state.onlyDefectMeters) {
      const visibleMm = totalVisibleMm()
      dataWidthPx = visibleMm * getCurrentPxPerMmH()
    } else {
      const TOTAL_MM = 100 * 1000 // 100m in mm
      dataWidthPx = TOTAL_MM * getCurrentPxPerMmH()
    }

    let maxOffset = 0
    let minOffset = -dataWidthPx + innerWidth // 对于从右到左的 X 轴，最小偏移应该是数据宽度与画布宽度差

    if (dataWidthPx <= innerWidth) {
      const centeredOffset = (left + right) / 2 - left - dataWidthPx / 2
      minOffset = maxOffset = centeredOffset
    }

    if (!resetLeft && resetToLeftIfNeededFlag) {
      // 对于从右到左的 X 轴，开始时应该显示数据的起始部分（0 米附近）
      // 这意味着要将偏移设置为最大偏移值，使数据起始部分出现在右侧
      state.viewportOffsetPx = maxOffset
      resetToLeftIfNeededFlag = false
    } else if (!resetLeft) {
      state.viewportOffsetPx = Math.min(maxOffset, Math.max(minOffset, state.viewportOffsetPx))
    }

    state.viewportBounds.minOffset = minOffset
    state.viewportBounds.maxOffset = maxOffset

    // 计算当前 Y 轴范围（根据右侧 X 位置确定）
    const pxPerMm = getCurrentPxPerMmH()

    const rightEdge = w - 20 // 画布右侧边缘
    const rightRel = rightEdge - state.viewportOffsetPx
    const rightMm = rightRel / pxPerMm // 右侧对应的毫米值
    const yAxisRange = getYAxisRangeForPosition(rightMm) // 根据右侧位置获取 Y 轴区间

    // 计算 Y 轴数据总高度
    const dataHeightPx = (yAxisRange.max - yAxisRange.min) * pxPerMmV_current() // 使用当前的 Y 轴像素/mm比率

    // Y轴偏移边界
    let minYOffset: number, maxYOffset: number
    if (dataHeightPx <= innerHeight) {
      // 如果数据高度小于等于画布高度，Y 轴居中显示
      const centerYOffset = (innerHeight - dataHeightPx) / 2
      minYOffset = maxYOffset = centerYOffset
    } else {
      // 如果数据高度大于画布高度，限制滚动范围
      // 确保数据顶部可以滚动到画布顶部，底部可以滚动到画布底部
      minYOffset = innerHeight - dataHeightPx // 最小偏移：数据底部对齐画布底部
      maxYOffset = 0 // 最大偏移：数据顶部对齐画布顶部
    }

    // 应用 Y 轴边界限制
    state.viewportOffsetPy = Math.min(maxYOffset, Math.max(minYOffset, state.viewportOffsetPy))

    // 更新 Y 轴边界到 viewportBounds
    state.viewportBounds.minYOffset = minYOffset
    state.viewportBounds.maxYOffset = maxYOffset

    // 计算中心范围
    const centerPx = w / 2
    if (state.onlyDefectMeters) {
      const centerCompressedMin = (centerPx - state.viewportBounds.maxOffset - left) / getCurrentPxPerMmH()
      const centerCompressedMax = (centerPx - state.viewportBounds.minOffset - left) / getCurrentPxPerMmH()
      state.viewportBounds.centerMinMm = compressedMmToOriginalMm(centerCompressedMin)
      state.viewportBounds.centerMaxMm = compressedMmToOriginalMm(centerCompressedMax)
    } else {
      const TOTAL_MM = 100 * 1000 // 100m in mm
      state.viewportBounds.centerMinMm = Math.max(0, (centerPx - state.viewportBounds.maxOffset - left) / getCurrentPxPerMmH())
      state.viewportBounds.centerMaxMm = Math.min(TOTAL_MM, (centerPx - state.viewportBounds.minOffset - left) / getCurrentPxPerMmH())
    }
  }

  function clampViewportOffset() {
    computeViewportBoundsAndClamp(false)
  }

  // 压缩域辅助函数
  function totalVisibleMm(): number {
    if (!state.onlyDefectMeters) return 100 * 1000 // 100 米
    return state.selectedMeters.length * 1000
  }

  function compressedMmToOriginalMm(cmm: number): number {
    if (!state.onlyDefectMeters) return cmm
    const meterIdx = Math.floor(cmm / 1000)
    const offset = Math.floor(cmm % 1000)
    const meter = state.selectedMeters[meterIdx]
    if (meter === undefined) return 100 * 1000 // 边界处理
    return meter * 1000 + offset
  }

  // 创建缩放处理器
  const zoomHandlers = createZoomHandlers(
    state,
    canvas,
    getDPR,
    getCurrentPxPerMmH,
    getBaseAdaptivePxPerMm,
    clampViewportOffset,
    renderResource
  )

  // 创建交互处理器
  const mouseHandlers = createMouseHandlers(
    state,
    canvas,
    tips,
    trackPlayer,
    computeViewportBoundsAndClamp,
    renderResource,
    screenPxToDistanceMm,
    (screenY: number) => screenYToAmplitudeMm(screenY)
  )

  // ==================== 导出接口 ====================

  // 播放控制
  function play() {
    if (trackPlayer.isPlaying) return
    trackPlayer.isPlaying = true

    function animation(ts: number) {
      if (!trackPlayer.isPlaying) return

      if (state.lastFrameTs === 0) state.lastFrameTs = ts
      const dt = (ts - state.lastFrameTs) / 1000
      state.lastFrameTs = ts

      // 根据当前播放速度更新偏移
      const playbackRate = trackPlayer.speed || 1
      const mmPerSec = (state.baseSpeedMh / 3600) * 100 * playbackRate // 转为 mm/s
      const pxPerSec = mmPerSec * getCurrentPxPerMmH()
      // 修改：由于 X 轴方向改变，播放方向也要相应改变
      state.viewportOffsetPx -= pxPerSec * dt

      clampViewportOffset()
      state.animationFrame = requestAnimationFrame(animation)
      renderResource()
    }
    animation(0)
  }

  function pause() {
    trackPlayer.isPlaying = false
    cancelAnimationFrame(state.animationFrame)
    state.lastFrameTs = 0 // 重置时间戳
    // 轨道探伤数据暂停
    setTimeout(() => {
      renderResource()
    }, 1e3 / 60)
  }

  function seekTo(time: number) {
    // 轨道探伤数据跳转到指定距离
    if (state.trackData.length > 0) {
      const maxDistance = Math.max(...state.trackData.map(d => d.distanceMm))
      state.currentDistanceMm = Math.max(0, Math.min(time, maxDistance)) // 限制在数据范围内
    }
  }

  function setViewCenterMm(targetMm: number) {
    // 目标是将 targetMm 对应的像素位置置于屏幕中心
    const centerX = (canvas.value.width / getDPR()) / 2 // 屏幕中心的 CSS 像素
    const targetPx = mmToScreenPx(targetMm) // 获取目标 mm 值对应的像素位置
    if (targetPx === null) return
    // 计算需要的偏移量，使目标位置居中
    state.viewportOffsetPx = state.viewportOffsetPx + centerX - targetPx
    clampViewportOffset()
    renderResource()
  }

  function resetZoom() {
    // 重置缩放到 1.0，同时保持当前屏幕中心 X 轴位置
    const centerX = (canvas.value.width / getDPR()) / 2 // 屏幕中心的 CSS 像素

    const centerRel = centerX - state.viewportOffsetPx
    const currentCenterMm = centerRel / getCurrentPxPerMmH() // 当前中心位置的 mm 值

    state.scale = 1.0 // 重置缩放

    // 计算新的偏移量以保持相同的中心位置
    const basePxPerMm = getBaseAdaptivePxPerMm()
    const newPxPerMmH = basePxPerMm * state.scale
    const totalWidth = canvas.value.width / getDPR()
    const rightEdge = totalWidth - state.grid.right // 右边距
    state.viewportOffsetPx = rightEdge - currentCenterMm * newPxPerMmH - centerX

    clampViewportOffset() // 确保偏移在边界内
    renderResource()
  }

  function updateGridConfig(config: { left?: number; right?: number; top?: number; bottom?: number }) {
    if (config.left !== undefined) state.grid.left = config.left
    if (config.right !== undefined) state.grid.right = config.right
    if (config.top !== undefined) state.grid.top = config.top
    if (config.bottom !== undefined) state.grid.bottom = config.bottom
    // 重新计算视口边界并刷新界面
    computeViewportBoundsAndClamp(false)
    renderResource()
  }

  // ==================== 导出接口 ====================

  // 文档级 mouseup，防止拖拽在画布外松开时状态异常
  function mouseupFnDocument() {
    state.isDown = false
  }

  // 缺陷命中检测
  function hitTestDefect(x: number, y: number) {
    if (!canvas.value) return null
    const left = state.grid.left
    const right = canvas.value.width - state.grid.right

    for (const d of state.defects as any[]) {
      const channelIndex = d.channel - 1
      if (!state.visibleChannels[channelIndex]) continue

      const channelLetter = String.fromCharCode(65 + channelIndex)
      const isChannelChecked = trackPlayer.checkedTracks?.includes(channelLetter)
      if (!isChannelChecked) continue

      const x1 = mmToScreenPx(d.x1)
      const x2 = mmToScreenPx(d.x2)
      if (x1 === null || x2 === null) continue
      if (x2 < left || x1 > right) continue

      const y1 = amplitudeToY_mm(d.y1, d.x1)
      const y2 = amplitudeToY_mm(d.y2, d.x1)

      const rectX1 = Math.min(x1, x2)
      const rectX2 = Math.max(x1, x2)
      const rectY1 = Math.min(y1, y2)
      const rectY2 = Math.max(y1, y2)

      if (x >= rectX1 && x <= rectX2 && y >= rectY1 && y <= rectY2) {
        return d
      }
    }
    return null
  }

  // 监听播放状态和轨道选择
  setupWatchers(trackPlayer, resizeResourceFn, initResourceFn)

  // 生命周期挂钩
  onMounted(() => {
    nextTick(() => initResourceFn())
    window.addEventListener('resize', resizeResourceFn)
    window.addEventListener('mouseup', mouseupFnDocument)
    eventBus.on('track-inspection-data-updated', () => {
      initResourceFn()
    })
  })

  onUnmounted(() => {
    eventBus.off('track-inspection-data-updated')
    window.removeEventListener('resize', resizeResourceFn)
    window.removeEventListener('mouseup', mouseupFnDocument)
    cancelAnimationFrame(state.animationFrame)
  })

  // 导出接口
  const api = {
    canvas,
    ...mouseHandlers,
    ...zoomHandlers,
    play,
    pause,
    seekTo,
    getDataURL: (_hasDefect?: boolean, _defect?: any) => {
      if (!canvas.value) return ''
      // 确保最新渲染
      renderResource()
      return canvas.value.toDataURL('image/png')
    },
    resetFn: () => {
      state.selectedDefectId = undefined
      renderResource()
    },
    refreshFn: () => {
      state.scale = 1.0
      state.viewportOffsetPy = 0
      computeViewportBoundsAndClamp(true)
      state.viewportOffsetPx = state.viewportBounds.maxOffset
      renderResource()
    },
    state,
    tips,
    getSelectedDefect: () => state.defects.find(d => d.id === state.selectedDefectId) || null,
    setDisplayMode: (mode: string) => {
      state.currentMode = mode as 'combo' | 'decomp'
    },
    setChannelVisibility: (channel: number, visible: boolean) => {
      if (channel >= 0 && channel < 9) {
        state.visibleChannels[channel] = visible
      }
    },
    getCenterMm: () => getCenterMmSafe(),
    getCurrentScale: () => state.scale,
    resetZoom,
    setViewCenterMm,
    resizeResourceFn,
    download: () => {
      if (!canvas.value) return
      const dataURL = api.getDataURL(true)
      if (!dataURL) return
      const link = document.createElement('a')
      link.href = dataURL
      link.download = 'track-inspection.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    updateGridConfig,
    clickFn: (e: MouseEvent) => {
      if (!canvas.value) return
      const rect = canvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const defect = hitTestDefect(x, y)
      if (!defect) {
        state.selectedDefectId = undefined
        renderResource()
      }
    },
    dblclickFn: (e: MouseEvent) => {
      if (!canvas.value) return
      const rect = canvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const defect = hitTestDefect(x, y)
      if (defect) {
        state.selectedDefectId = defect.id
      } else {
        state.selectedDefectId = undefined
      }
      renderResource()
    },
  } as CanvasDraw

  return api
}

// 监听播放状态变化和轨道选择
function setupWatchers(
  trackPlayer: any,
  resizeResourceFn: () => void,
  initResourceFn: () => void
) {
  watch(() => trackPlayer.isPlaying, (newVal) => {
    if (newVal) {
      // play 已经在外部调用
    } else {
      // pause 已经在外部调用
    }
  })

  // 监听轨道选择变化（优化：避免不必要的完整重绘）
  watch(() => [trackPlayer.checkedTracks, trackPlayer.toolData.bMode], () => {
    // 只在模式变化时重新初始化，通道变化时只需重新渲染
    resizeResourceFn()
  }, { deep: false }) // 禁用深度监听以提高性能
}
