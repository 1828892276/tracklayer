import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { DefectData, trackPlayerStore, B_DISPLAY_MODE } from './hooks'
import eventBus from '../../../utils/eventBus'

// 缓存处理过的数据以提高性能
let cachedProcessedData: any = null;
let lastDataHash: string | null = null;

// 性能监控配置
const PERF_MONITORING_ENABLED = true; // 是否启用性能监控
const PERF_LOG_INTERVAL = 10; // 每 N 帧打印一次性能数据
let frameCount = 0; // 当前帧数计数

// 性能计时工具函数
function perfStart(label: string): number {
  if (!PERF_MONITORING_ENABLED) return 0;
  return performance.now();
}

function perfEnd(label: string, startTime: number): number {
  if (!PERF_MONITORING_ENABLED) return 0;
  const duration = performance.now() - startTime;
  return duration;
}

// 性能统计数据
let perfStats = {
  totalRenderTime: 0,
  offscreenGenTime: 0,
  drawGridTime: 0,
  drawYAxisLabelsTime: 0,
  drawXAxisTicksTime: 0,
  drawTrackPointsTime: 0,
  drawDefectsTime: 0,
  drawIChannelBaseLineTime: 0,
};

// 打印性能统计
function printPerfStats() {
  if (!PERF_MONITORING_ENABLED) return;

  frameCount++;
  if (frameCount % PERF_LOG_INTERVAL === 0) {
    console.group('📊 Canvas 渲染性能统计');
    console.log(`总渲染时间：${perfStats.totalRenderTime.toFixed(2)}ms`);
    console.log(`  - 离屏缓存生成：${perfStats.offscreenGenTime.toFixed(2)}ms (${(perfStats.offscreenGenTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制网格：${perfStats.drawGridTime.toFixed(2)}ms (${(perfStats.drawGridTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制 Y 轴标签：${perfStats.drawYAxisLabelsTime.toFixed(2)}ms (${(perfStats.drawYAxisLabelsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制 X 轴刻度：${perfStats.drawXAxisTicksTime.toFixed(2)}ms (${(perfStats.drawXAxisTicksTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制数据点：${perfStats.drawTrackPointsTime.toFixed(2)}ms (${(perfStats.drawTrackPointsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制缺陷：${perfStats.drawDefectsTime.toFixed(2)}ms (${(perfStats.drawDefectsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`  - 绘制 I 通道底线：${perfStats.drawIChannelBaseLineTime.toFixed(2)}ms (${(perfStats.drawIChannelBaseLineTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`);
    console.log(`帧率估算：${(1000 / (perfStats.totalRenderTime / PERF_LOG_INTERVAL)).toFixed(1)} FPS`);
    console.groupEnd();

    // 重置统计数据
    perfStats = {
      totalRenderTime: 0,
      offscreenGenTime: 0,
      drawGridTime: 0,
      drawYAxisLabelsTime: 0,
      drawXAxisTicksTime: 0,
      drawTrackPointsTime: 0,
      drawDefectsTime: 0,
      drawIChannelBaseLineTime: 0,
    };
  }
}

// 获取设备像素比
function getDPR(): number {
  return window.devicePixelRatio || 1;
}

// 颜色转换辅助函数
function hexToRgba(hex: string, alpha: number) {
  let r = 0, g = 0, b = 0;
  // 解析 r, g, b 值从十六进制
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 定义 CanvasDraw 类型接口
export interface CanvasDraw {
  canvas: any;
  mousedownFn: (e: MouseEvent) => void;
  mousemoveFn: (e: MouseEvent) => void;
  mouseupFn: () => void;
  mouseoutFn: () => void;
  wheelFn: (e: WheelEvent) => void;
  dblclickFn: (e: MouseEvent) => void;
  clickFn: (e: MouseEvent) => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getDataURL: (hasDefect?: boolean, defect?: DefectData) => string;
  resetFn: () => void;
  refreshFn: () => void;
  state: any;
  getSelectedDefect: () => any | null;
  setDisplayMode: (mode: string) => void;
  setChannelVisibility: (channel: number, visible: boolean) => void;
  getCenterMm: () => number;
  getCurrentScale: () => number;
  resetZoom: () => void;
  setViewCenterMm: (targetMm: number) => void;
  resizeResourceFn: () => void;
  download: () => void;
  updateGridConfig: (config: { left?: number; right?: number; top?: number; bottom?: number }) => void;
  tips: any,
}

// 颜色常量
const CANVAS_BG_COLOR = '#FFFFC0';
const TEXT_COLOR = '#222';
const GRID_COLOR = '#888';
const BORDER_COLOR = '#e6e6e6';

// 数据描点常量
const DATA_POINT_RADIUS = 4;

// 字体大小常量
const BASE_FONT_SIZE = 12;

// 缺陷框厚度常量
const DEFECT_BOX_STROKE_WIDTH = 1;

export function useCanvasDraw(): CanvasDraw {
  // 全局数据
  const trackPlayer = trackPlayerStore()
  // 画布 ref、图片、视频元素
  const canvas = ref()

  // 离屏 Canvas 用于缓存静态元素（网格、坐标轴等）
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let cachedOffscreenHash: string | null = null;

  // Y 轴区间数据（将根据实际窗口配置动态生成）
  const yAxisData = ref<Array<{
    start: number,     // X 轴区间起始点，单位 mm
    end: number,       // X 轴区间结束点，单位 mm
    min: number,       // Y轴顶部数值，单位 mm
    max: number        // Y 轴底部数值，单位 mm
  }>>([])

  // 缓存 yAxisRange 计算结果，避免重复遍历
  let cachedYAxisRange: { start: number, end: number, min: number, max: number } | null = null;
  let cachedYAxisRangeXmm: number | null = null;

  // 根据 X 轴位置获取对应的 Y 轴区间（带缓存优化）
  function getYAxisRangeForPosition(xMm: number) {
    // 如果 xMm 没有变化，返回缓存结果
    if (cachedYAxisRange && cachedYAxisRangeXmm === xMm) {
      return cachedYAxisRange;
    }

    if (!yAxisData.value || yAxisData.value.length === 0) {
      // 如果没有窗口数据，返回默认值
      cachedYAxisRange = { start: 0, end: 100000, min: 0, max: 500 };
      cachedYAxisRangeXmm = xMm;
      return cachedYAxisRange;
    }

    for (const range of yAxisData.value) {
      if (xMm >= range.start && xMm < range.end) {
        cachedYAxisRange = range;
        cachedYAxisRangeXmm = xMm;
        return range;
      }
    }
    // 如果未找到匹配区间，返回第一个或默认值
    cachedYAxisRange = yAxisData.value[0] || { start: 0, end: 100000, min: 0, max: 500 };
    cachedYAxisRangeXmm = xMm;
    return cachedYAxisRange;
  }

  // 全局状态管理
  const state = {
    scale: 1,
    // 加载状态
    loaded: false,
    // 选中缺陷id
    selectedDefectId: undefined,
    // 帧动画
    animationFrame: 0,
    // 画布上下文
    ctx: null as CanvasRenderingContext2D | null,

    // 轨道探伤数据相关
    trackData: [] as any[],
    defects: [] as any[],
    visibleChannels: Array.from({ length: 9 }, () => true), // 支持最多9个通道
    currentDistanceMm: 0, // 当前播放距离

    // 坐标映射相关
    BASE_H_mm_per_px: 3, // 水平方向3mm/px
    currentMode: 'combo', // 显示模式: 'combo'(组合) 或 'decomp'(分解)

    // 画布网格和边距配置
    grid: {
      left: 20,   // 左侧留白，用于Y轴标签
      right: 80,  // 右侧留白
      top: 20,    // 顶部留白
      bottom: 100  // 底部留白，用于X轴标签
    },

    // 垂直模式配置
    verticalModes: {
      combo: { name: '组合', mmPerPx: 1 },   // 1 mm per px
      decomp: { name: '分解', mmPerPx: 3 }    // 3 mm per px
    },

    // 视口状态
    viewportOffsetPx: 0,
    viewportOffsetPy: 0, // Y轴偏移
    viewportBounds: { minOffset: 0, maxOffset: 0, minYOffset: 0, maxYOffset: 0, centerMinMm: 0, centerMaxMm: 100000 }, // 默认TOTAL_MM

    // 交互状态
    isDown: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    startOffsetY: 0,
    // 缺陷框绘制状态
    drawingDefect: false,
    drawingStartPos: { x: 0, y: 0 },
    drawingCurrentPos: { x: 0, y: 0 },

    loading: false,
    onlyDefectMeters: false,

    // 播放状态
    lastFrameTs: 0,
    baseSpeedMh: 2.5 * 1e3, // 基础速度 2.5 km/h 转换为 mm/h

    // 缩放配置
    MIN_SCALE: 1,
    MAX_SCALE: 5.0,

    // 选中的米数（用于压缩显示）
    selectedMeters: [] as number[],
    selectedMetersIndex: new Map<number, number>(),

    // 颜色配置
    COLORS: trackPlayer.COLORS,
  }

  // 鼠标触摸信息悬浮框
  const tips = ref({
    x: 0,
    y: 0,
    show: false,
    text: '',
  })

  // 获取当前 B 显模式
  function getCurrentBMode(): string {
    return trackPlayer.toolData.bMode;
  }

  // 判断是否为分解模式
  function isSplitMode(): boolean {
    return getCurrentBMode() === B_DISPLAY_MODE.SPLIT;
  }

  // 判断是否为居中模式
  function isCenterMode(): boolean {
    return getCurrentBMode() === B_DISPLAY_MODE.CENTER;
  }

  // 根据通道号获取对应的区域信息（仅分解模式使用）
  function getChannelRegion(channelId: number) {
    if (!isSplitMode()) {
      return { regionTop: 0, regionBottom: 0, regionIndex: 0 };
    }

    const canvasHeight = canvas.value.height / getDPR();
    const padding = state.grid;
    const innerHeight = canvasHeight - padding.top - padding.bottom;
    const regionHeight = innerHeight / 3;

    if (channelId >= 1 && channelId <= 6) {
      // A-F 通道在顶部区域
      return {
        regionTop: padding.top,
        regionBottom: padding.top + regionHeight,
        regionIndex: 0
      };
    } else if (channelId >= 7 && channelId <= 8) {
      // G-H 通道在中间区域
      return {
        regionTop: padding.top + regionHeight,
        regionBottom: padding.top + 2 * regionHeight,
        regionIndex: 1
      };
    } else if (channelId === 9) {
      // I 通道在底部区域
      return {
        regionTop: padding.top + 2 * regionHeight,
        regionBottom: canvasHeight - padding.bottom,
        regionIndex: 2
      };
    }

    // 默认返回第一个区域
    return {
      regionTop: padding.top,
      regionBottom: padding.top + regionHeight,
      regionIndex: 0
    };
  }

  // 从 trackInspectionData 提取数据并转换格式
  function extractTrackInspectionData() {
    // 使用非响应式存储获取数据
    const rawData = trackPlayer.getTrackInspectionData();

    if (!rawData || Object.keys(rawData).length === 0) {
      console.warn('No track inspection data available');
      return;
    }

    // 使用数据的简化的哈希值来检测变化
    const currentDataHash = JSON.stringify({
      usw1Length: Array.isArray(rawData.usw1) ? rawData.usw1.length : 0,
      usw2Length: Array.isArray(rawData.usw2) ? rawData.usw2.length : 0,
      usw3Length: Array.isArray(rawData.usw3) ? rawData.usw3.length : 0,
      usw4Length: Array.isArray(rawData.usw4) ? rawData.usw4.length : 0,
      usw5Length: Array.isArray(rawData.usw5) ? rawData.usw5.length : 0,
      usw6Length: Array.isArray(rawData.usw6) ? rawData.usw6.length : 0,
      usw7Length: Array.isArray(rawData.usw7) ? rawData.usw7.length : 0,
      usw8Length: Array.isArray(rawData.usw8) ? rawData.usw8.length : 0,
      usw9Length: Array.isArray(rawData.usw9) ? rawData.usw9.length : 0,
      winsLength: Array.isArray(rawData.wins) ? rawData.wins.length : 0,
    });

    // 如果数据没有变化，使用缓存
    if (lastDataHash === currentDataHash && cachedProcessedData) {
      state.trackData = cachedProcessedData.trackData;
      state.defects = cachedProcessedData.defects;
      return;
    }

    // 数据变化时，清除 I通道底部线条缓存
    cachedIChannelBaseLine = null;

    const trackData: any[] = [];
    const defects: any[] = [];

    // 处理公里标数据
    if (rawData.kmFlags && Array.isArray(rawData.kmFlags)) {
      // 公里标数据可以用于显示参考标记
      console.log('Kilometer flags:', rawData.kmFlags);
    }

    // 处理各通道数据 (usw1-usw9)
    const channelMapping = [
      { key: 'usw1', channelId: 1 },
      { key: 'usw2', channelId: 2 },
      { key: 'usw3', channelId: 3 },
      { key: 'usw4', channelId: 4 },
      { key: 'usw5', channelId: 5 },
      { key: 'usw6', channelId: 6 },
      { key: 'usw7', channelId: 7 },
      { key: 'usw8', channelId: 8 },
      { key: 'usw9', channelId: 9 }
    ];

    // 转换通道数据格式
    for (const channel of channelMapping) {
      const channelData = rawData[channel.key as keyof typeof rawData];
      if (Array.isArray(channelData)) {
        for (const point of channelData) {
          // 类型安全检查
          if (point &&
            typeof (point as { x: number, y: number }).x === 'number' &&
            typeof (point as { x: number, y: number }).y === 'number') {
            const typedPoint = point as { x: number, y: number };
            trackData.push({
              channelId: channel.channelId,
              distanceMm: typedPoint.x,  // x 坐标作为距离
              reflectionValue: typedPoint.y  // y 坐标作为反射值
            });
          }
        }
      }
    }

    // 处理窗口配置数据 - 生成 Y 轴区间
    if (rawData.wins && Array.isArray(rawData.wins)) {
      // 将窗口配置转换为 yAxisData 格式
      const newYAxisData: Array<{
        start: number;
        end: number;
        min: number;
        max: number;
        auxiliaryLineYScales?: number[]; // 辅助线 Y 轴刻度（绘制平行于 X 轴的虚线）
        yscales?: number[]; // Y 轴刻度（只绘制 Y 轴上的刻度标记和标签）
        bottomLineYScale?: number; // I 通道底部基准线的 Y轴位置
      }> = [];

      for (const win of rawData.wins) {
        // minX 和 maxX 是窗口的 X 轴范围（单位可能是像素或其他），需要转换为 mm
        // yscales 数组包含了 Y轴的刻度信息，通常 [min, max]
        newYAxisData.push({
          start: win.minX,  // 窗口起始 X 坐标
          end: win.maxX,    // 窗口结束 X 坐标
          min: win.yscales?.[0] ?? 0,      // Y 轴最小值
          max: win.yscales?.[win.yscales.length - 1] ?? 500,  // Y 轴最大值
          auxiliaryLineYScales: win.auxiliaryLineYScales || [],  // 辅助线 Y 轴刻度
          yscales: win.yscales || [],  // Y轴刻度
          bottomLineYScale: win.bottomLineYScale  // I 通道底部基准线的 Y轴位置
        });
      }

      // 更新窗口数据时清除缓存
      // 更新响应式的 yAxisData
      yAxisData.value = newYAxisData;
      // 清除缓存，因为数据已更新
      cachedYAxisRange = null;
      cachedYAxisRangeXmm = null;
      console.log('Window configurations loaded:', newYAxisData.length, 'windows');
    }

    // 缓存处理结果
    cachedProcessedData = { trackData, defects };
    lastDataHash = currentDataHash;

    // 更新状态
    state.trackData = trackData;
    state.defects = defects; // 缺陷数据需要从其他 API 获取

    console.log(`Extracted ${trackData.length} data points from ${channelMapping.filter(c =>
      Array.isArray(rawData[c.key as keyof typeof rawData])).length} channels`);
  }

  // 初始化播放器状态
  function initPlayState() {
    trackPlayer.isPlaying = false
    trackPlayer.isAdd = false
    state.onlyDefectMeters = false;

    Object.assign(state, {
      scale: 1,
      loaded: false,
      currentDistanceMm: 0,
    })
  }

  // 初始化资源
  function initResourceFn() {

    initPlayState();
    if (state.ctx && canvas.value) {
      clearCanvas(canvas.value, state.ctx)
    }

    // 从trackPlayer.trackInspectionData提取数据
    extractTrackInspectionData();

    buildSelectedMetersFromDefects(); // 构建选中的米数
    initCanvs();
    state.loaded = true;
    computeViewportBoundsAndClamp(true); // 初始化视口边界
    // 重置视口偏移以确保显示数据开始部分
    state.viewportOffsetPx = state.viewportBounds.maxOffset;
    renderResource()
  }

  // 尺寸变化重绘
  function resizeResourceFn() {
    // 清除离屏缓存
    offscreenCanvas = null;
    cachedOffscreenHash = null;
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

  // 资源渲染入口
  function renderResource() {
    if (state.ctx && state.loaded && canvas.value) {
      const renderStartTime = perfStart('totalRender');
      clearCanvas(canvas.value, state.ctx)

      // 检查是否需要重新生成离屏缓存
      const currentHash = getOffscreenCacheHash();
      if (!offscreenCanvas || cachedOffscreenHash !== currentHash) {
        generateOffscreenCache();
        cachedOffscreenHash = currentHash;
      }

      // 绘制离屏缓存（网格、坐标轴等静态元素）
      if (offscreenCanvas) {
        state.ctx.drawImage(offscreenCanvas, 0, 0);
      }

      // 绘制动态元素（数据点、缺陷等）
      renderDynamicElements(state.ctx);

      // 记录性能数据
      const totalRenderTime = perfEnd('totalRender', renderStartTime);
      perfStats.totalRenderTime += totalRenderTime;
      printPerfStats();
    }
  }

  // 生成离屏缓存
  function generateOffscreenCache() {
    if (!canvas.value) return;
    const offscreenStartTime = perfStart('offscreenGen');

    // 创建离屏 Canvas
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.value.width;
    offscreenCanvas.height = canvas.value.height;
    const offCtx = offscreenCanvas.getContext('2d');
    if (!offCtx) return;

    // 计算画布尺寸和边距
    const padding = state.grid;
    const left = padding.left;
    const right = canvas.value.width - padding.right;
    const top = padding.top;
    const bottom = canvas.value.height - padding.bottom;

    // 在离屏 Canvas 上绘制静态元素
    clearCanvas(offscreenCanvas, offCtx);

    // 绘制边框
    offCtx.strokeStyle = BORDER_COLOR;
    offCtx.lineWidth = 1;
    offCtx.strokeRect(left, top, right - left, bottom - top);

    // 保存上下文并设置裁剪区域
    offCtx.save();
    offCtx.beginPath();
    offCtx.rect(left, top, right - left, bottom - top);
    offCtx.clip();

    // 绘制网格
    const gridStartTime = perfStart('drawGrid');
    drawGrid(offCtx, left, top, right, bottom);
    perfStats.drawGridTime += perfEnd('drawGrid', gridStartTime);

    offCtx.restore();

    // 绘制坐标轴标签
    const yAxisLabelsStartTime = perfStart('drawYAxisLabels');
    drawYAxisLabels(offCtx, left, top, right, bottom);
    perfStats.drawYAxisLabelsTime += perfEnd('drawYAxisLabels', yAxisLabelsStartTime);

    const xAxisTicksStartTime = perfStart('drawXAxisTicks');
    drawXAxisTicks(offCtx, left, top, right, bottom);
    perfStats.drawXAxisTicksTime += perfEnd('drawXAxisTicks', xAxisTicksStartTime);

    const totalOffscreenTime = perfEnd('offscreenGen', offscreenStartTime);
    perfStats.offscreenGenTime += totalOffscreenTime;
  }

  // 渲染动态元素（数据点、缺陷、绘制框）
  function renderDynamicElements(ctx: CanvasRenderingContext2D) {
    const canvasWidth = canvas.value.width;
    const canvasHeight = canvas.value.height;

    // 计算画布尺寸和边距
    const padding = state.grid;
    const left = padding.left;
    const right = canvasWidth - padding.right;
    const top = padding.top;
    const bottom = canvasHeight - padding.bottom;

    // 保存上下文并设置裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 绘制探伤数据点
    const trackPointsStartTime = perfStart('drawTrackPoints');
    drawTrackPoints(ctx, left, top, right, bottom);
    perfStats.drawTrackPointsTime += perfEnd('drawTrackPoints', trackPointsStartTime);

    // 绘制缺陷
    const defectsStartTime = perfStart('drawDefects');
    drawDefects(ctx, left, top, right, bottom);
    perfStats.drawDefectsTime += perfEnd('drawDefects', defectsStartTime);

    ctx.restore();

    // 绘制当前绘制的矩形框（如果在绘制状态下）
    renderCurrentRect();
  }

  // 生成离屏缓存的哈希值（用于检测是否需要重新生成）
  function getOffscreenCacheHash(): string {
    const centerMm = getCenterMmSafe();
    const yAxisRange = getYAxisRangeForPosition(centerMm);
    return JSON.stringify({
      scale: state.scale,
      viewportOffsetPx: state.viewportOffsetPx,
      viewportOffsetPy: state.viewportOffsetPy,
      yAxisRange: `${yAxisRange.min}-${yAxisRange.max}`,
      grid: `${state.grid.left}-${state.grid.right}-${state.grid.top}-${state.grid.bottom}`,
      size: `${canvas.value?.width}-${canvas.value?.height}`
    });
  }

  // 获取固定基础像素/mm值，用于避免循环依赖
  function getFixedBasePxPerMm(): number {
    const fixedBaseH_mmPerPx = 3; // 固定的基准值
    return fixedBaseH_mmPerPx / state.scale;
  }



  // 坐标转换辅助函数
  function getCenterMmSafe(): number {
    // 安全版本的getCenterMm，不依赖于可能导致循环引用的函数
    // 使用固定的参考比例来计算中心位置，避免循环依赖
    const centerPx = (canvas.value.width / getDPR()) / 2;

    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    const rel = rightEdge - centerPx - state.viewportOffsetPx;

    // 使用固定的pxPerMm值进行估算
    const estimatedMm = rel * getFixedBasePxPerMm();

    return estimatedMm;
  }

  function getBaseAdaptivePxPerMm() {
    // 计算基础自适应比例，基于画布中心位置的 Y 轴区间
    const canvasHeight = canvas.value.height / getDPR();
    const padding = state.grid;

    // 根据不同模式计算可用高度
    let availableHeight: number;
    if (isSplitMode()) {
      // 分解模式下，每个区域的高度是总高度的 1/3
      availableHeight = (canvasHeight - padding.top - padding.bottom) / 3;
    } else if (isCenterMode()) {
      // 居中模式下，使用固定比例 1px = 3mm
      return 1 / 3; // 返回固定的 px/mm 比例
    } else {
      // 组合模式下，使用全部高度
      availableHeight = canvasHeight - padding.top - padding.bottom;
    }

    // 计算 Y轴范围，使用当前中心位置对应的 X 轴位置
    const centerMm = getCenterMmSafe();
    const yAxisRange = getYAxisRangeForPosition(centerMm);

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    const usableTop = 20;
    const usableBottom = availableHeight - 20;
    const usableHeight = usableBottom - usableTop;

    // 计算自适应比例：像素数 / mm 数
    return usableHeight / (yAxisRange.max - yAxisRange.min);
  }

  function getCurrentPxPerMmH() {
    // 现在X轴和Y轴使用相同的比例
    const basePxPerMm = getBaseAdaptivePxPerMm();
    return basePxPerMm * state.scale;
  }

  function pxPerMmV_current() {
    // 新的自适应比例：Y 轴高度默认铺满
    const canvasHeight = canvas.value.height / getDPR();
    const padding = state.grid;

    // 根据不同模式计算可用高度
    let availableHeight: number;
    if (isSplitMode()) {
      // 分解模式下，每个区域的高度是总高度的 1/3
      availableHeight = (canvasHeight - padding.top - padding.bottom) / 3;
    } else if (isCenterMode()) {
      // 居中模式下，使用固定比例 1px = 3mm
      return 1 / 3; // 返回固定的 px/mm 比例
    } else {
      // 组合模式下，使用全部高度
      availableHeight = canvasHeight - padding.top - padding.bottom;
    }

    // 计算 Y轴范围，使用当前中心位置对应的 X 轴位置
    const centerMm = getCenterMmSafe();
    const yAxisRange = getYAxisRangeForPosition(centerMm);

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    const usableTop = 20;
    const usableBottom = availableHeight - 20;
    const usableHeight = usableBottom - usableTop;

    // 计算自适应比例：像素数 / mm 数
    const adaptivePxPerMm = usableHeight / (yAxisRange.max - yAxisRange.min);

    // 应用缩放
    return adaptivePxPerMm * state.scale;
  }

  function amplitudeToY_mm(mmValue: number, xAxisPosition?: number) {
    const canvasHeight = canvas.value.height / getDPR();
    const padding = state.grid;

    // 计算 Y轴范围，如果提供了 xAxisPosition 则使用该位置对应的区间，否则默认使用中心位置
    const yAxisRange = xAxisPosition !== undefined ? getYAxisRangeForPosition(xAxisPosition) : getYAxisRangeForPosition(getCenterMmSafe());

    // 根据当前模式和缩放计算实际的像素/mm比率
    const pxPerMmV = pxPerMmV_current();

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    let usableTop: number, usableBottom: number, centerY: number;

    if (isSplitMode()) {
      // 分解模式下，每个通道有自己的区域
      const regionInfo = getChannelRegion(1); // 默认使用第一个通道区域作为参考
      usableTop = regionInfo.regionTop + 20;
      usableBottom = regionInfo.regionBottom - 20;
      centerY = (usableTop + usableBottom) / 2;
    } else if (isCenterMode()) {
      // 居中模式下，在画布中心显示
      const availableHeight = canvasHeight - padding.top - padding.bottom;
      centerY = padding.top + availableHeight / 2;
      usableTop = centerY - (availableHeight / 2 - 20);
      usableBottom = centerY + (availableHeight / 2 - 20);
    } else {
      // 组合模式下，使用全部高度
      usableTop = padding.top + 20;
      usableBottom = canvasHeight - padding.bottom - 20;
      centerY = (usableTop + usableBottom) / 2;
    }

    const centerValue = (yAxisRange.max + yAxisRange.min) / 2;

    // 将 mm 值转换为相对于中心点的像素偏移
    const valueOffset = (mmValue - centerValue) * pxPerMmV;

    // 返回最终的像素位置，加上 Y轴偏移
    // 翻转 Y 轴：顶部数值小，底部数值大
    return centerY + valueOffset + state.viewportOffsetPy;
  }

  // 将屏幕Y坐标转换为幅度的mm值
  function screenYToAmplitudeMm(screenY: number, xAxisPosition?: number, channelId?: number): number {
    const canvasHeight = canvas.value.height / getDPR();
    const padding = state.grid;

    // 计算 Y轴范围，如果提供了 xAxisPosition 则使用该位置对应的区间，否则默认使用中心位置
    const yAxisRange = xAxisPosition !== undefined ? getYAxisRangeForPosition(xAxisPosition) : getYAxisRangeForPosition(getCenterMmSafe());

    // 根据当前模式和缩放计算实际的像素/mm比率
    const pxPerMmV = pxPerMmV_current();

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    let usableTop: number, usableBottom: number, centerY: number;

    if (isSplitMode() && channelId !== undefined) {
      // 分解模式下，每个通道有自己的区域
      const regionInfo = getChannelRegion(channelId);
      usableTop = regionInfo.regionTop + 20;
      usableBottom = regionInfo.regionBottom - 20;
      centerY = (usableTop + usableBottom) / 2;
    } else if (isCenterMode()) {
      // 居中模式下，在画布中心显示
      const availableHeight = canvasHeight - padding.top - padding.bottom;
      centerY = padding.top + availableHeight / 2;
      usableTop = centerY - (availableHeight / 2 - 20);
      usableBottom = centerY + (availableHeight / 2 - 20);
    } else {
      // 组合模式下，使用全部高度
      usableTop = padding.top + 20;
      usableBottom = canvasHeight - padding.bottom - 20;
      centerY = (usableTop + usableBottom) / 2;
    }

    const centerValue = (yAxisRange.max + yAxisRange.min) / 2;

    // 从像素坐标反推 mm 值
    const valueOffset = screenY - centerY - state.viewportOffsetPy;
    return centerValue + valueOffset / pxPerMmV;
  }

  // 距离mm到屏幕px的转换
  function distanceMmToScreenPx(mm: number): number | null {
    const px = mm * getCurrentPxPerMmH();
    // 修改：从右到左的X轴 - 用总宽度减去原本的px值
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    return rightEdge - px - state.viewportOffsetPx; // 修改：使用rightEdge而不是left
  }

  // 屏幕px到距离mm的转换
  function screenPxToDistanceMm(screenPx: number): number {
    // 修改：从右到左的X轴 - 需要反向计算
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    const rel = rightEdge - screenPx - state.viewportOffsetPx; // 修改：使用rightEdge而不是left

    // 使用当前的自适应比例进行计算，而非固定比例
    return rel / getCurrentPxPerMmH();
  }

  // 压缩域辅助函数 - 用于仅显示有缺陷的米功能
  function originalMmToCompressedMm(mm: number): number {
    if (!state.onlyDefectMeters) return mm;
    const meter = Math.floor(mm / 1000);
    const idx = state.selectedMetersIndex.get(meter);
    if (idx === undefined) return -1; // 不在压缩域中，即不在有缺陷的米中
    const offset = mm % 1000;
    return idx * 1000 + offset;
  }

  function compressedMmToOriginalMm(cmm: number): number {
    if (!state.onlyDefectMeters) return cmm;
    const meterIdx = Math.floor(cmm / 1000);
    const offset = Math.floor(cmm % 1000);
    const meter = state.selectedMeters[meterIdx];
    if (meter === undefined) return 100 * 1000; // 边界处理
    return meter * 1000 + offset;
  }

  function totalVisibleMm(): number {
    if (!state.onlyDefectMeters) return 100 * 1000; // 100米
    return state.selectedMeters.length * 1000;
  }

  // 内部px转换（支持压缩域）
  function posMmToPxInternal(mm: number) {
    // 使用当前的自适应比例进行计算，但在onlyDefectMeters模式下仍使用固定比例以避免循环依赖
    const pxPerMm = state.onlyDefectMeters ? getFixedBasePxPerMm() : getCurrentPxPerMmH();

    if (state.onlyDefectMeters) {
      const cmm = originalMmToCompressedMm(mm);
      if (cmm === -1) return null;
      return cmm * pxPerMm;
    } else {
      return mm * pxPerMm;
    }
  }

  // 原始mm到屏幕px转换
  function mmToScreenPx(mm: number): number | null {
    const ipx = posMmToPxInternal(mm);
    if (ipx === null) return null;
    // 修改：从右到左的X轴 - 用总宽度减去原本的px值
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    // 对于从右到左的X轴，mm值越大，其在屏幕上越靠左（像素值越小）
    return rightEdge - ipx - state.viewportOffsetPx;
  }

  // 屏幕px到原始mm转换
  function screenPxToOriginalMm(screenPx: number): number {
    // 修改：从右到左的X轴 - 需要反向计算
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    // 反向计算：从屏幕像素位置得到原始mm值
    const rel = rightEdge - screenPx - state.viewportOffsetPx;

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    if (state.onlyDefectMeters) {
      const cmm = rel / pxPerMm;
      return compressedMmToOriginalMm(cmm);
    } else {
      return rel / pxPerMm;
    }
  }

  // 构建从缺陷数据中提取的选中米数
  function buildSelectedMetersFromDefects() {
    const set = new Set<number>();
    for (const d of state.defects) {
      const sm = Math.floor(Math.min(d.x1, d.x2) / 1000);
      const em = Math.floor(Math.max(d.x1, d.x2) / 1000);
      for (let m = sm; m <= em; m++) set.add(m);
    }
    state.selectedMeters = Array.from(set).sort((a, b) => a - b);
    state.selectedMetersIndex.clear();
    state.selectedMeters.forEach((m, idx) => state.selectedMetersIndex.set(m, idx));
  }

  // 获取当前中心mm位置
  function getCenterMm(): number {
    return getCenterMmSafe(); // 使用安全版本避免循环依赖
  }

  // 设置视图中心mm位置
  function setViewCenterMm(targetMm: number) {
    // 修改：由于X轴方向改变，偏移计算方式也要改变
    // 目标是将targetMm对应的像素位置置于屏幕中心
    const centerX = (canvas.value.width / getDPR()) / 2; // 屏幕中心的CSS像素
    const targetPx = mmToScreenPx(targetMm); // 获取目标mm值对应的像素位置
    if (targetPx === null) return;
    // 计算需要的偏移量，使目标位置居中
    state.viewportOffsetPx = state.viewportOffsetPx + centerX - targetPx;
    clampViewportOffset();
    renderResource();
  }

  // 视口边界计算和限制
  function computeViewportBoundsAndClamp(resetToLeftIfNeeded = false) {
    const w = canvas.value.width / getDPR();
    const h = canvas.value.height / getDPR();
    const left = state.grid.left, right = w - state.grid.right;
    const top = state.grid.top, bottom = h - state.grid.bottom;
    const innerWidth = right - left;
    const innerHeight = bottom - top;

    // 计算数据宽度
    let dataWidthPx: number;
    if (state.onlyDefectMeters) {
      const visibleMm = totalVisibleMm();
      dataWidthPx = visibleMm * getCurrentPxPerMmH();
    } else {
      const TOTAL_MM = 100 * 1000; // 100m in mm
      dataWidthPx = TOTAL_MM * getCurrentPxPerMmH();
    }

    let maxOffset = 0;
    let minOffset = -dataWidthPx + innerWidth; // 修改：对于从右到左的X轴，最小偏移应该是数据宽度与画布宽度差

    if (dataWidthPx <= innerWidth) {
      const centeredOffset = (left + right) / 2 - left - dataWidthPx / 2;
      minOffset = maxOffset = centeredOffset;
    }

    if (resetToLeftIfNeeded) {
      // 修改：对于从右到左的X轴，开始时应该显示数据的起始部分（0米附近）
      // 这意味着要将偏移设置为最大偏移值，使数据起始部分出现在右侧
      state.viewportOffsetPx = maxOffset;
    } else {
      state.viewportOffsetPx = Math.min(maxOffset, Math.max(minOffset, state.viewportOffsetPx));
    }

    state.viewportBounds.minOffset = minOffset;
    state.viewportBounds.maxOffset = maxOffset;

    // 计算当前Y轴范围（根据右侧X位置确定）
    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const rightEdge = w - 20; // 画布右侧边缘
    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
    const yAxisRange = getYAxisRangeForPosition(rightMm); // 根据右侧位置获取Y轴区间

    // 计算Y轴数据总高度
    const dataHeightPx = (yAxisRange.max - yAxisRange.min) * pxPerMmV_current(); // 使用当前的Y轴像素/mm比率

    // Y轴偏移边界
    let minYOffset, maxYOffset;
    if (dataHeightPx <= innerHeight) {
      // 如果数据高度小于等于画布高度，Y轴居中显示
      const centerYOffset = (innerHeight - dataHeightPx) / 2;
      minYOffset = maxYOffset = centerYOffset;
    } else {
      // 如果数据高度大于画布高度，限制滚动范围
      // 确保数据顶部可以滚动到画布顶部，底部可以滚动到画布底部
      minYOffset = innerHeight - dataHeightPx; // 最小偏移：数据底部对齐画布底部
      maxYOffset = 0; // 最大偏移：数据顶部对齐画布顶部
    }

    // 应用Y轴边界限制
    state.viewportOffsetPy = Math.min(maxYOffset, Math.max(minYOffset, state.viewportOffsetPy));

    // 更新Y轴边界到viewportBounds
    state.viewportBounds.minYOffset = minYOffset;
    state.viewportBounds.maxYOffset = maxYOffset;

    // 计算中心范围
    const centerPx = w / 2;
    if (state.onlyDefectMeters) {
      const centerCompressedMin = (centerPx - state.viewportBounds.maxOffset - left) / getCurrentPxPerMmH();
      const centerCompressedMax = (centerPx - state.viewportBounds.minOffset - left) / getCurrentPxPerMmH();
      state.viewportBounds.centerMinMm = compressedMmToOriginalMm(centerCompressedMin);
      state.viewportBounds.centerMaxMm = compressedMmToOriginalMm(centerCompressedMax);
    } else {
      const TOTAL_MM = 100 * 1000; // 100m in mm
      state.viewportBounds.centerMinMm = Math.max(0, (centerPx - state.viewportBounds.maxOffset - left) / getCurrentPxPerMmH());
      state.viewportBounds.centerMaxMm = Math.min(TOTAL_MM, (centerPx - state.viewportBounds.minOffset - left) / getCurrentPxPerMmH());
    }
  }

  function clampViewportOffset() {
    computeViewportBoundsAndClamp(false);
  }

  // 绘制网格
  function drawGrid(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    // 获取画布右侧对应的 X 轴位置来确定 Y 轴区间
    const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
    const yAxisRange = getYAxisRangeForPosition(rightMm); // 根据右侧位置获取 Y轴区间

    // 根据当前模式和缩放计算实际的像素/mm比率
    const pxPerMmV = pxPerMmV_current();

    // 计算该区间内允许的 Y轴范围，考虑 20px 的间距
    const usableTop = top + 20;
    const usableBottom = bottom - 20;

    // 计算中心点像素位置
    const centerY = (usableTop + usableBottom) / 2;
    const centerValue = (yAxisRange.max + yAxisRange.min) / 2;

    // 设置虚线样式：长短间隔（—-）
    ctx.setLineDash([10, 5]);

    // 绘制辅助线（来自 auxiliaryLineYScales）
    const auxiliaryLines = (yAxisRange as any).auxiliaryLineYScales || [];
    for (const yValue of auxiliaryLines) {
      // 计算该值对应的 Y 坐标
      const valueOffset = (yValue - centerValue) * pxPerMmV;
      const y = centerY + valueOffset + state.viewportOffsetPy;

      if (y >= top && y <= bottom) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
    }

    // 恢复实线样式
    ctx.setLineDash([]);
  }

  // 绘制探伤数据点
  function drawTrackPoints(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
    // 使用固定尺寸的矩形，不受缩放影响
    const rectSize = DATA_POINT_RADIUS * 2;
    const halfRectSize = DATA_POINT_RADIUS;
    const cornerRadius = 2;
    const protrusion = 2;

    for (let ch = 0; ch < 9; ch++) {
      const channelLetter = String.fromCharCode(65 + ch);
      const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

      if (!state.visibleChannels[ch] || !isChannelChecked) continue;

      ctx.fillStyle = state.COLORS[ch % state.COLORS.length];

      // 如果是分解模式，需要获取当前通道的区域
      let regionTop = top;
      let regionBottom = bottom;
      if (isSplitMode()) {
        const regionInfo = getChannelRegion(ch + 1);
        regionTop = regionInfo.regionTop;
        regionBottom = regionInfo.regionBottom;
      }

      // I通道（通道 9）特殊处理：除了正常绘制数据点外，还在底部绘制基准直线
      if (ch === 8) { // 通道 9 对应索引 8
        // 先正常绘制数据点（和其他通道一样的逻辑）
        for (const p of state.trackData) {
          if (p.channelId - 1 !== ch) continue;

          const px = mmToScreenPx(p.distanceMm);
          if (px === null) continue;
          if (px < left - 1 || px > right + 1) continue;

          const py = amplitudeToY_mm(p.reflectionValue, p.distanceMm);

          // 在分解模式下，检查是否在对应区域内
          if (py < regionTop - 1 || py > regionBottom + 1) continue;

          ctx.beginPath();

          const x = px - halfRectSize;
          const y = py - halfRectSize;
          const width = rectSize;
          const height = rectSize;
          const radius = cornerRadius;

          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.arcTo(x + width, y, x + width, y + radius, radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
          ctx.lineTo(x + radius, y + height);
          ctx.arcTo(x, y + height, x, y + height - radius, radius);
          ctx.lineTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.closePath();
          ctx.fill();

          // 绘制四边中点向外突出的部分
          ctx.fillRect(px - 0.5, py - halfRectSize - protrusion, 1, protrusion);
          ctx.fillRect(px - 0.5, py + halfRectSize, 1, protrusion);
          ctx.fillRect(px - halfRectSize - protrusion, py - 0.5, protrusion, 1);
          ctx.fillRect(px + halfRectSize, py - 0.5, protrusion, 1);
        }

        // 然后在底部绘制基准直线（镂空异常位置）
        drawIChannelBaseLine(ctx, left, regionTop, regionBottom, ch);
        continue;
      }

      for (const p of state.trackData) {
        if (p.channelId - 1 !== ch) continue;

        const px = mmToScreenPx(p.distanceMm);
        if (px === null) continue;
        if (px < left - 1 || px > right + 1) continue;

        const py = amplitudeToY_mm(p.reflectionValue, p.distanceMm);

        // 在分解模式下，检查是否在对应区域内
        if (py < regionTop - 1 || py > regionBottom + 1) continue;

        ctx.beginPath();

        const x = px - halfRectSize;
        const y = py - halfRectSize;
        const width = rectSize;
        const height = rectSize;
        const radius = cornerRadius;

        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();

        // 绘制四边中点向外突出的部分
        ctx.fillRect(px - 0.5, py - halfRectSize - protrusion, 1, protrusion);
        ctx.fillRect(px - 0.5, py + halfRectSize, 1, protrusion);
        ctx.fillRect(px - halfRectSize - protrusion, py - 0.5, protrusion, 1);
        ctx.fillRect(px + halfRectSize, py - 0.5, protrusion, 1);
      }
    }
  }

  // 缓存 I通道底部线条和噪点数据
  let cachedIChannelBaseLine: {
    segments: Array<{ x1: number; x2: number }>;
    noisePoints: Array<{ distanceMm: number; y: number; radius: number }>; // 使用距离 mm 而不是屏幕 x
    hash: string;
  } | null = null;

  // 绘制 I 通道（通道 9）的底部基准直线，异常位置镂空（不绘制），并添加噪点
  function drawIChannelBaseLine(ctx: CanvasRenderingContext2D, left: number, regionTop: number, regionBottom: number, channelIndex: number) {
    const baseLineStartTime = perfStart('drawIChannelBaseLine');

    // 获取当前 X 位置对应的 Y 轴区间
    const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘
    const pxPerMm = getCurrentPxPerMmH();
    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
    const yAxisRange = getYAxisRangeForPosition(rightMm); // 根据右侧位置获取 Y 轴区间

    // 使用 bottomLineYScale 作为底部线条的 Y 位置，如果没有则使用默认值
    const bottomLineYScale = (yAxisRange as any).bottomLineYScale ?? yAxisRange.max;

    // 将 bottomLineYScale 从 mm 值转换为屏幕 Y 坐标
    const lineY = amplitudeToY_mm(bottomLineYScale, rightMm);

    const lineWidth = DATA_POINT_RADIUS * 2; // 与数据点相同的尺寸
    const halfLineWidth = DATA_POINT_RADIUS;
    const cornerRadius = 2; // 与数据点相同的圆角

    // 收集所有 I 通道的异常数据点（用于镂空）
    const iChannelPoints: { x: number }[] = [];
    for (const p of state.trackData) {
      if (p.channelId === 9) { // 通道 9
        const px = mmToScreenPx(p.distanceMm);
        if (px !== null && px >= left - 10 && px <= (canvas.value.width / getDPR() - state.grid.right) + 10) {
          iChannelPoints.push({ x: px });
        }
      }
    }

    // 生成数据哈希值，用于检测是否需要重新计算
    const dataHash = iChannelPoints.map(p => p.x.toFixed(2)).join(',');

    // 如果数据没有变化，使用缓存
    if (!cachedIChannelBaseLine || cachedIChannelBaseLine.hash !== dataHash) {
      // 重新计算底部线条分段和噪点位置
      calculateIChannelBaseLine(left, regionTop, regionBottom, channelIndex, iChannelPoints, dataHash, lineY);
    }

    // 使用缓存的数据进行绘制
    if (cachedIChannelBaseLine) {
      const canvasRight = canvas.value.width / getDPR() - state.grid.right;

      ctx.fillStyle = state.COLORS[channelIndex % state.COLORS.length];
      ctx.strokeStyle = state.COLORS[channelIndex % state.COLORS.length];
      ctx.lineWidth = lineWidth;

      // 绘制分段的底部直线
      for (const segment of cachedIChannelBaseLine.segments) {
        drawRoundedLine(ctx, segment.x1, Math.min(segment.x2, canvasRight), lineY, halfLineWidth, cornerRadius);
      }

      // 绘制噪点（根据当前视口转换毫米到屏幕坐标）
      for (const noise of cachedIChannelBaseLine.noisePoints) {
        const px = mmToScreenPx(noise.distanceMm);
        if (px !== null && px >= left - 10 && px <= canvasRight + 10) {
          ctx.beginPath();
          ctx.arc(px, noise.y, noise.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    perfStats.drawIChannelBaseLineTime += perfEnd('drawIChannelBaseLine', baseLineStartTime);
  }

  // 预计筗 I 通道底部线条和噪点数据
  function calculateIChannelBaseLine(
    left: number,
    regionTop: number,
    regionBottom: number,
    channelIndex: number,
    iChannelPoints: { x: number }[],
    dataHash: string,
    lineY: number // 新增参数：底部线条的 Y 坐标
  ) {
    const halfLineWidth = DATA_POINT_RADIUS;
    const gapWidth = 20;
    const canvasRight = canvas.value.width / getDPR() - state.grid.right;

    // 噪点配置：每 10px 一个噪点，交替在上下，大小递增
    const noisePattern = [
      { offset: 10, side: 'top', size: 1 },   // 10px: 顶部，1px
      { offset: 15, side: 'bottom', size: 2 }, // 15px: 底部，2px
      { offset: 25, side: 'top', size: 3 },   // 25px: 顶部，3px
      { offset: 30, side: 'bottom', size: 4 }, // 30px: 底部，4px
    ];
    const noiseCycle = 30; // 30px 为一个周期

    const noiseRadiusMin = 1;
    const noiseRadiusMax = 4;

    // 1. 计算线条分段
    const segments: Array<{ x1: number; x2: number }> = [];
    let startX = left;

    // 按 x 坐标排序
    iChannelPoints.sort((a, b) => a.x - b.x);

    for (const point of iChannelPoints) {
      const gapStart = point.x - gapWidth / 2;
      const gapEnd = point.x + gapWidth / 2;

      if (gapStart > startX) {
        segments.push({ x1: startX, x2: Math.min(gapStart, canvasRight) });
      }
      startX = gapEnd;
    }

    // 最后一段
    if (startX < canvasRight) {
      segments.push({ x1: startX, x2: canvasRight });
    }

    // 如果没有数据点，绘制完整直线
    if (iChannelPoints.length === 0) {
      segments.push({ x1: left, x2: canvasRight });
    }

    // 2. 计算噪点位置（基于固定的像素间隔模式）
    const noisePoints: Array<{ distanceMm: number; y: number; radius: number }> = [];

    // 将屏幕上的 left 和 right 转换为毫米距离
    const leftMm = screenPxToDistanceMm(left);
    const rightMm = screenPxToDistanceMm(canvasRight);
    const totalMm = rightMm - leftMm;

    // 基于像素位置生成噪点（固定模式）
    const pxPerMm = getCurrentPxPerMmH();
    const totalPx = totalMm * pxPerMm;
    const noiseCount = Math.floor(totalPx / 5); // 每 5px 检查一次，确保覆盖所有噪点位置

    for (let i = 0; i < noiseCount; i++) {
      const px = left + i * 5; // 每 5px 检查一次
      const distanceMm = leftMm + (i * 5) / pxPerMm;

      const screenPx = mmToScreenPx(distanceMm);
      if (screenPx === null) continue;

      // 检查是否在镂空区域内
      let isInGap = false;
      for (const point of iChannelPoints) {
        const gapStart = point.x - gapWidth / 2;
        const gapEnd = point.x + gapWidth / 2;
        if (screenPx >= gapStart && screenPx <= gapEnd) {
          isInGap = true;
          break;
        }
      }

      // 如果在镂空区域内，跳过不绘制
      if (isInGap) continue;

      // 计算相对于周期起点的位置
      const relativePx = (px - left) % noiseCycle;

      // 查找匹配的噪点模式
      for (const pattern of noisePattern) {
        // 允许一定的误差范围（±2px）
        if (Math.abs(relativePx - pattern.offset) < 2) {
          // 圆心 Y 坐标：在线条外部（上方或下方）
          const centerY = pattern.side === 'top' ?
            (lineY - halfLineWidth - pattern.size / 2) : // 顶部：再往上偏移半径的一半
            (lineY + halfLineWidth + pattern.size / 2);  // 底部：再往下偏移半径的一半

          noisePoints.push({
            distanceMm,
            y: centerY,
            radius: pattern.size
          });
          break; // 每个位置只匹配一个噪点
        }
      }
    }

    // 缓存计算结果
    cachedIChannelBaseLine = {
      segments,
      noisePoints,
      hash: dataHash
    };
  }

  // 绘制带圆角的水平直线
  function drawRoundedLine(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, halfHeight: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x1 + radius, y - halfHeight);
    ctx.lineTo(x2 - radius, y - halfHeight);
    ctx.arcTo(x2, y - halfHeight, x2, y, radius);
    ctx.arcTo(x2, y + halfHeight, x2 - radius, y + halfHeight, radius);
    ctx.lineTo(x1 + radius, y + halfHeight);
    ctx.arcTo(x1, y + halfHeight, x1, y, radius);
    ctx.arcTo(x1, y - halfHeight, x1 + radius, y - halfHeight, radius);
    ctx.closePath();
    ctx.fill();
  }

  // 绘制缺陷
  function drawDefects(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
    // 如果不显示缺陷，则直接返回
    if (!trackPlayer.showDefect) return;

    // 存储所有缺陷的绘制信息，用于标签位置避让
    const defectDrawInfos: {
      rectX: number,
      rectY: number,
      rectW: number,
      rectH: number,
      channelColor: string,
      fillAlpha: number,
      strokeAlpha: number,
      defectLabel: string,
      d: any
    }[] = [];

    for (const d of state.defects) {
      // 跳过不可见通道的缺陷
      if (!state.visibleChannels[d.channel]) continue;

      // 检查通道是否被选中（在trackPlayer.checkedTracks中）
      const channelLetter = String.fromCharCode(65 + d.channel); // A=0, B=1, C=2...
      const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

      if (!isChannelChecked) continue;

      // 使用 x1, y1, x2, y2 从缺陷数据
      const x1 = mmToScreenPx(d.x1);
      const x2 = mmToScreenPx(d.x2);
      // 获取画布右侧对应的X轴位置来确定Y轴区间
      const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

      // 使用当前的自适应比例进行计算，而非固定比例
      const pxPerMm = getCurrentPxPerMmH();

      const rightRel = rightEdge - state.viewportOffsetPx;
      const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
      const y1 = amplitudeToY_mm(d.y1, rightMm);
      const y2 = amplitudeToY_mm(d.y2, rightMm);

      if (x1 === null || x2 === null) continue;
      if (x2 < left || x1 > right) continue;

      // 计算屏幕坐标
      const rectX = Math.min(x1, x2); // 由于X轴从右到左，需要取较小的像素值作为起点
      const rectW = Math.max(2, Math.abs(x2 - x1)); // 使用绝对值计算宽度
      const rectY = Math.min(y1, y2);
      const rectH = Math.abs(y2 - y1);

      // 使用通道颜色
      const channelColor = state.COLORS[d.channel % state.COLORS.length];
      const fillAlpha = (d.id === state.selectedDefectId) ? 0.3 : 0.12;
      const strokeAlpha = (d.id === state.selectedDefectId) ? 0.8 : 0.4;

      const defectLabel = d.note || d.id; // 使用note字段，如果不存在则使用id

      defectDrawInfos.push({
        rectX,
        rectY,
        rectW,
        rectH,
        channelColor,
        fillAlpha,
        strokeAlpha,
        defectLabel,
        d
      });
    }

    // 先绘制所有缺陷框
    for (const info of defectDrawInfos) {
      const { rectX, rectY, rectW, rectH, channelColor, fillAlpha, strokeAlpha } = info;

      ctx.fillStyle = hexToRgba(channelColor, fillAlpha);
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeStyle = hexToRgba(channelColor, strokeAlpha);
      // 根据缩放比例调整缺陷框厚度
      const scaledStrokeWidth = DEFECT_BOX_STROKE_WIDTH * state.scale;
      ctx.lineWidth = scaledStrokeWidth;
      ctx.strokeRect(rectX, rectY, rectW, rectH);
    }

    // 计算并绘制标签，避免重叠
    const usedLabelPositions: { x: number, y: number, width: number, height: number }[] = [];

    for (const info of defectDrawInfos) {
      const { rectX, rectY, rectH, channelColor, defectLabel } = info;

      ctx.fillStyle = channelColor;
      // 根据缩放比例调整字体大小
      const scaledFontSize = BASE_FONT_SIZE * state.scale;
      ctx.font = `${scaledFontSize}px sans-serif`;
      ctx.textAlign = 'left';

      // 测量文本尺寸
      const textMetrics = ctx.measureText(defectLabel);
      const textWidth = textMetrics.width;
      const textHeight = scaledFontSize; // 根据字体大小调整高度比例

      // 尝试找到合适的位置放置标签
      let labelX = rectX + 4;
      let labelY = rectY - 2; // 默认在缺陷框上方

      // 检查是否超出画布顶部，如果超出则放在下方
      if (labelY - textHeight < top) {
        labelY = rectY + rectH + textHeight - 2; // 放在缺陷框下方
      }

      // 检查是否与已有标签或缺陷框重叠，如果重叠则调整位置
      let attempts = 0;
      let overlapping = true;
      while (overlapping && attempts < 10) { // 最多重试10次
        overlapping = false;

        // 检查是否与已使用的标签位置重叠
        for (const pos of usedLabelPositions) {
          if (!(labelX + textWidth < pos.x ||
            labelX > pos.x + pos.width ||
            labelY - textHeight < pos.y ||
            labelY > pos.y + pos.height)) {
            overlapping = true;
            break;
          }
        }

        // 如果不与标签重叠，检查是否与缺陷框重叠
        if (!overlapping) {
          for (const otherInfo of defectDrawInfos) {
            if (otherInfo === info) continue; // 跳过自己

            const overlap = !(labelX + textWidth < otherInfo.rectX ||
              labelX > otherInfo.rectX + otherInfo.rectW ||
              labelY - textHeight < otherInfo.rectY ||
              labelY > otherInfo.rectY + otherInfo.rectH);
            if (overlap) {
              overlapping = true;
              break;
            }
          }
        }

        if (overlapping) {
          // 如果重叠，尝试不同的位置
          if (attempts % 2 === 0) {
            // 尝试在缺陷框下方
            labelY = rectY + rectH + textHeight - 2;
          } else {
            // 尝试在缺陷框上方
            labelY = rectY - 2;
          }
          attempts++;
        }
      }

      // 最终确定标签位置
      if (labelY - textHeight < top) {
        // 如果在上方放不下，强制放在下方
        labelY = rectY + rectH + textHeight - 2;
      }

      if (labelY > bottom) {
        // 如果下方也放不下，放在上方
        labelY = rectY - 2;
      }

      // 绘制标签
      ctx.fillStyle = channelColor;
      ctx.fillText(defectLabel, labelX, labelY);

      // 记录已使用的标签位置
      usedLabelPositions.push({
        x: labelX,
        y: labelY - textHeight,
        width: textWidth,
        height: textHeight
      });
    }
  }

  // 绘制Y轴标签
  function drawYAxisLabels(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'left'; // 改为左对齐，因为标签在右侧
    ctx.textBaseline = 'middle';

    // 获取画布右侧对应的X轴位置来确定Y轴区间
    const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
    const yAxisRange = getYAxisRangeForPosition(rightMm); // 根据右侧位置获取Y轴区间

    // 根据当前模式和缩放计算实际的像素/mm比率
    const pxPerMmV = pxPerMmV_current();

    // 计算该区间内允许的Y轴范围，考虑20px的间距
    const usableTop = top + 20;
    const usableBottom = bottom - 20;

    // 计算中心点像素位置
    const centerY = (usableTop + usableBottom) / 2;
    const centerValue = (yAxisRange.max + yAxisRange.min) / 2;

    // 绘制刻度线和标签（来自 auxiliaryLineYScales）- 从左侧绘制到右侧，标签在右侧显示
    const auxiliaryLabels = (yAxisRange as any).auxiliaryLineYScales || [];
    for (const value of auxiliaryLabels) {
      // 计算该值对应的 Y 坐标
      const valueOffset = (value - centerValue) * pxPerMmV;
      const y = centerY + valueOffset + state.viewportOffsetPy;

      if (y >= top && y <= bottom) {
        // 绘制标签（在右侧显示）
        ctx.fillStyle = TEXT_COLOR; // 使用黑色文本
        ctx.fillText(value + ' mm', right + 8, y); // 标签绘制在右侧
      }
    }

    // 绘制 yscales 刻度（只绘制 Y轴上的刻度标记，不绘制标签和平行于 X 轴的虚线）- 从左侧绘制到右侧
    const yscales = (yAxisRange as any).yscales || [];
    for (const value of yscales) {
      // 跳过与 auxiliaryLineYScales 重复的值
      if (auxiliaryLabels.includes(value)) continue;

      // 计算该值对应的 Y 坐标
      const valueOffset = (value - centerValue) * pxPerMmV;
      const y = centerY + valueOffset + state.viewportOffsetPy;

      if (y >= top && y <= bottom) {
        // 绘制刻度线 - 从左侧绘制到右侧
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(right, y);
        ctx.lineTo(right + 6, y); // 从左侧绘制到右侧
        ctx.stroke();
        // 注意：yscales 不绘制标签文字
      }
    }

    ctx.restore();
  }

  // 绘制X轴刻度
  function drawXAxisTicks(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = TEXT_COLOR; // 使用黑色文本

    if (state.onlyDefectMeters) {
      // 在onlyDefectMeters模式下，只显示有缺陷的米
      for (const m of state.selectedMeters) {
        // 在每米的中心位置（500mm处）放置标签
        const mmPosStart = m * 1000;
        const px = mmToScreenPx(mmPosStart + 500);
        if (px === null) continue;
        // 由于X轴方向改变，需要正确处理坐标范围检查
        if (px < left - 40 || px > right + 40) continue;

        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(px, bottom);
        ctx.lineTo(px, bottom + 6);
        ctx.stroke();

        // 格式化为公里.米格式，如 5.100, 5.200
        const kmPart = Math.floor(m / 1000);
        const mPart = m % 1000;
        const label = `${kmPart}.${String(mPart).padStart(3, '0')}`;

        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(label, px, bottom + 8);
      }
      ctx.restore();
      return;
    }

    // 计算当前可见范围
    // 由于X轴从右到左，屏幕左边的像素对应更大的mm值，屏幕右边的像素对应更小的mm值
    const startMm = screenPxToDistanceMm(right); // right边对应更小的mm值
    const endMm = screenPxToDistanceMm(left); // left边对应更大的mm值

    // 按分米（100mm）为单位绘制刻度
    const dmStep = 100; // 100mm = 1分米

    // 检查标签之间是否可能会重叠，如果是，则使用更大的步长
    const pxPerMm = getCurrentPxPerMmH();
    const dmStepPx = dmStep * pxPerMm; // 分米步长对应的像素

    // 测量文本宽度以判断是否会重叠
    const testLabel = '000.000'; // 最宽的标签示例
    const textWidth = ctx.measureText(testLabel).width;
    const minSpacing = textWidth + 10; // 最小间距，留出一些余量

    let stepMm = dmStep; // 默认使用分米步长
    if (dmStepPx < minSpacing) {
      // 如果分米步长太密，使用米步长
      stepMm = 1000; // 1米 = 1000mm
    } else if (dmStepPx < minSpacing * 0.5) {
      // 如果仍然太密，使用更大的步长
      stepMm = 2000; // 2米 = 2000mm
    }

    // 确保起始点是stepMm的倍数
    let currentMm = Math.floor(startMm / stepMm) * stepMm;

    // 如果stepMm是分米（100mm），我们需要特别处理标签格式
    const isDmStep = stepMm === 100;

    for (; currentMm <= Math.ceil(endMm); currentMm += stepMm) {
      const px = distanceMmToScreenPx(currentMm);
      if (px === null) continue;
      if (px < left - 40 || px > right + 40) continue;

      // 绘制刻度线
      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      if (currentMm % 1000 === 0) {
        // 对于每米（1000mm）的刻度，绘制较长的刻度线并显示标签
        ctx.moveTo(px, bottom);
        ctx.lineTo(px, bottom + 6);
      } else {
        // 对于其他刻度（如分米），绘制较短的刻度线
        ctx.moveTo(px, bottom);
        ctx.lineTo(px, bottom + 3);
      }
      ctx.stroke();

      // 绘制标签（只有在步长大于分米或使用分米步长时才显示标签）
      if (stepMm >= 1000 || isDmStep) {
        // 格式化标签
        const m = Math.floor(currentMm / 1000); // 米数
        const remainingMm = currentMm % 1000;

        let label;
        if (isDmStep && stepMm === 100) {
          // 分米步长的格式，例如 0.100, 0.200, 0.300
          label = `${m}.${String(remainingMm).padStart(3, '0')}`;
        } else {
          // 米步长的格式
          label = `${m}.${String(remainingMm).padStart(3, '0')}`;
        }

        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(label, px, bottom + 8);
      }
    }

    ctx.restore();
  }

  // 清空画布
  function clearCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  //---- 鼠标事件相关
  // 鼠标按下
  function mousedownFn(e: MouseEvent) {
    if (trackPlayer.isAdd) {
      // 如果是添加缺陷模式，开始绘制缺陷框
      state.drawingDefect = true;
      const rect = canvas.value.getBoundingClientRect();
      state.drawingStartPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      state.drawingCurrentPos = { ...state.drawingStartPos };
    } else {
      // 非添加缺陷模式，进行平移操作
      state.isDown = true;
      state.startX = e.clientX;
      state.startY = e.clientY; // 记录Y轴起始位置
      state.startOffset = state.viewportOffsetPx;
      state.startOffsetY = state.viewportOffsetPy; // 记录Y轴起始偏移
    }
  }

  // 鼠标移动
  function mousemoveFn(e: MouseEvent) {
    // 更新tips坐标（相对于画布左上角的像素值）
    const rect = canvas.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 计算画布边界
    const left = state.grid.left, top = state.grid.top;
    const right = canvas.value.width / getDPR() - state.grid.right;
    const bottom = canvas.value.height / getDPR() - state.grid.bottom;

    // 判断鼠标是否在绘制区域内
    const isWithinDrawingArea = mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom;

    // 检查鼠标是否在任何缺陷框上
    let isOverDefect = false;
    if (isWithinDrawingArea) {
      for (const d of state.defects) {
        if (!state.visibleChannels[d.channel]) continue;

        // 检查通道是否被选中（在trackPlayer.checkedTracks中）
        const channelLetter = String.fromCharCode(65 + d.channel); // A=0, B=1, C=2...
        const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

        if (!isChannelChecked) continue;

        const x1 = mmToScreenPx(d.x1);
        const x2 = mmToScreenPx(d.x2);
        const y1 = amplitudeToY_mm(d.y1);
        const y2 = amplitudeToY_mm(d.y2);

        if (x1 === null || x2 === null) continue;

        // 计算缺陷的边界框
        const rectX1 = Math.min(x1, x2);
        const rectX2 = Math.max(x1, x2);
        const rectY1 = Math.min(y1, y2);
        const rectY2 = Math.max(y1, y2);

        if (mouseX >= rectX1 && mouseX <= rectX2 && mouseY >= rectY1 && mouseY <= rectY2) {
          isOverDefect = true;
          break;
        }
      }
    }

    // 如果在绘制区域内且不在缺陷框上，显示tips并更新坐标信息
    if (isWithinDrawingArea && !isOverDefect) {
      // 将像素坐标转换为公里标和深度值

      // 使用当前的自适应比例进行计算，而非固定比例
      const pxPerMm = getCurrentPxPerMmH();

      // 由于X轴方向从右到左，需要使用mmToScreenPx的逆运算
      const totalWidth = canvas.value.width / getDPR();
      const rightEdge = totalWidth - state.grid.right; // 右边距
      const rel = rightEdge - mouseX - state.viewportOffsetPx;
      const distanceMm = rel / pxPerMm;
      const amplitudeMm = screenYToAmplitudeMm(mouseY, getCenterMmSafe());

      // 格式化公里标为 km.mmm 格式
      const km = Math.floor(distanceMm / 1000);
      const remainingMm = Math.abs(distanceMm % 1000);
      const formattedKm = `${km}.${String(Math.round(remainingMm)).padStart(3, '0')}km`;

      // 格式化深度值
      const formattedDepth = `${amplitudeMm.toFixed(2)}mm`;

      // 更新tips
      tips.value = {
        x: mouseX,
        y: mouseY,
        show: true,
        text: `${formattedKm}, ${formattedDepth}`
      };
    } else {
      // 如果超出绘制区域或在缺陷框上，隐藏tips
      tips.value.show = false;
    }

    if (trackPlayer.isAdd && state.drawingDefect) {
      // 在添加缺陷模式下，更新缺陷框大小
      state.drawingCurrentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      renderResource(); // 重新渲染以显示实时绘制的矩形
    } else if (!state.isDown) {
      return;
    } else {
      // 非添加缺陷模式，进行平移操作
      const dx = e.clientX - state.startX; // CSS px
      const dy = e.clientY - state.startY; // CSS py
      // 修改：由于X轴方向改变，平移方向也要相应改变
      state.viewportOffsetPx = state.startOffset - dx; // 注意这里使用减号而不是加号
      // 添加Y轴平移
      state.viewportOffsetPy = state.startOffsetY + dy; // Y轴按原方向移动
      clampViewportOffset();
      renderResource();
    }
  }

  // 鼠标松开
  function mouseupFn() {
    if (trackPlayer.isAdd && state.drawingDefect) {
      // 在添加缺陷模式下，完成缺陷框绘制并输出坐标
      state.drawingDefect = false;

      // 将绘制的坐标转换为mm单位
      const x1 = screenPxToOriginalMm(Math.min(state.drawingStartPos.x, state.drawingCurrentPos.x));
      const x2 = screenPxToOriginalMm(Math.max(state.drawingStartPos.x, state.drawingCurrentPos.x));

      // 由于Y轴方向是从上到下增加，但amplitudeToY_mm是以中心为基准，上为负下为正
      // 需要将像素坐标转换为mm深度值
      const topY = Math.min(state.drawingStartPos.y, state.drawingCurrentPos.y);
      const bottomY = Math.max(state.drawingStartPos.y, state.drawingCurrentPos.y);

      // 计算Y坐标对应的mm值
      const rightEdge = canvas.value.width / getDPR() - state.grid.right; // 画布右侧边缘

      // 使用当前的自适应比例进行计算，而非固定比例
      const pxPerMm = getCurrentPxPerMmH();

      const rightRel = rightEdge - state.viewportOffsetPx;
      const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
      const y1 = screenYToAmplitudeMm(topY, rightMm);
      const y2 = screenYToAmplitudeMm(bottomY, rightMm);

      // 输出缺陷框坐标
      console.log({ x1, y1, x2, y2 });
    } else {
      // 非添加缺陷模式，结束平移操作
      state.isDown = false;
    }
  }

  // 鼠标离开
  function mouseoutFn() {
    // 鼠标离开画布时，隐藏tips
    tips.value.show = false;
  }

  // 鼠标滚轮
  function wheelFn(e: WheelEvent) {
    e.preventDefault();

    const rect = canvas.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // 鼠标相对于画布的X位置

    // 计算缩放前鼠标位置下的世界坐标（mm）
    // 修改：由于X轴方向改变，需要使用正确的转换函数

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    // 由于X轴方向从右到左，需要使用正确的计算方式
    const totalWidthForWheel = canvas.value.width / getDPR();
    const rightEdgeForWheel = totalWidthForWheel - state.grid.right; // 右边距
    const rel = rightEdgeForWheel - mouseX - state.viewportOffsetPx;
    const originalWorldPosMm = rel / pxPerMm;

    // 计算缩放系数
    const zoomIntensity = 0.1;
    const scaleFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);

    // 应用缩放并限制边界
    const newScale = Math.min(state.MAX_SCALE, Math.max(state.MIN_SCALE, state.scale * scaleFactor));
    state.scale = newScale;

    // 计算新的偏移量以保持鼠标位置固定在同一世界坐标上
    // 使用基础自适应比例避免循环依赖
    const basePxPerMm = getBaseAdaptivePxPerMm();
    const newPxPerMmH = basePxPerMm * state.scale;
    // 修改：由于X轴方向改变，偏移计算方式也要改变
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    state.viewportOffsetPx = rightEdge - originalWorldPosMm * newPxPerMmH - mouseX; // 左边距，但现在从右边计算

    clampViewportOffset();
    renderResource();
  }

  // 鼠标双击
  function dblclickFn(e: MouseEvent) {
    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = state.grid.left, right = canvas.value.width / getDPR() - state.grid.right;
    let clicked = false;

    // 获取画布右侧对应的X轴位置来确定Y轴区间
    const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值

    for (const d of state.defects) {
      // 跳过不可见通道的缺陷
      if (!state.visibleChannels[d.channel]) continue;

      // 检查通道是否被选中（在trackPlayer.checkedTracks中）
      const channelLetter = String.fromCharCode(65 + d.channel); // A=0, B=1, C=2...
      const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

      if (!isChannelChecked) continue;

      const x1 = mmToScreenPx(d.x1);
      const x2 = mmToScreenPx(d.x2);
      const y1 = amplitudeToY_mm(d.y1, rightMm);
      const y2 = amplitudeToY_mm(d.y2, rightMm);

      if (x1 === null || x2 === null) continue;
      if (x2 < left || x1 > right) continue;

      // 计算缺陷的边界框
      const rectX1 = Math.min(x1, x2);
      const rectX2 = Math.max(x1, x2);
      const rectY1 = Math.min(y1, y2);
      const rectY2 = Math.max(y1, y2);

      if (x >= rectX1 && x <= rectX2 && y >= rectY1 && y <= rectY2) {
        state.selectedDefectId = d.id;
        clicked = true;
        break;
      }
    }

    if (!clicked) state.selectedDefectId = undefined;
    renderResource();
  }

  // 点击事件处理
  function clickFn(e: MouseEvent) {
    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = state.grid.left, right = canvas.value.width / getDPR() - state.grid.right;
    let onDef = false;

    // 获取画布右侧对应的X轴位置来确定Y轴区间
    const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const rightRel = rightEdge - state.viewportOffsetPx;
    const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值

    for (const d of state.defects) {
      // 跳过不可见通道的缺陷
      if (!state.visibleChannels[d.channel]) continue;

      // 检查通道是否被选中（在trackPlayer.checkedTracks中）
      const channelLetter = String.fromCharCode(65 + d.channel); // A=0, B=1, C=2...
      const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

      if (!isChannelChecked) continue;

      const x1 = mmToScreenPx(d.x1);
      const x2 = mmToScreenPx(d.x2);
      const y1 = amplitudeToY_mm(d.y1, rightMm);
      const y2 = amplitudeToY_mm(d.y2, rightMm);

      if (x1 === null || x2 === null) continue;
      if (x2 < left || x1 > right) continue;

      // 计算缺陷的边界框
      const rectX1 = Math.min(x1, x2);
      const rectX2 = Math.max(x1, x2);
      const rectY1 = Math.min(y1, y2);
      const rectY2 = Math.max(y1, y2);

      if (x >= rectX1 && x <= rectX2 && y >= rectY1 && y <= rectY2) {
        onDef = true;
        break;
      }
    }

    if (!onDef) {
      state.selectedDefectId = undefined;
      renderResource();
    }
  }

  // 画布复位
  function refreshFn() {
    // 重置缩放到1.0
    state.scale = 1.0;
    // 重置Y轴偏移
    state.viewportOffsetPy = 0;
    computeViewportBoundsAndClamp(true);
    // 重置视口偏移以确保显示数据开始部分
    state.viewportOffsetPx = state.viewportBounds.maxOffset;
    renderResource();
  }

  // 清除当前选中/绘制框
  function resetFn() {
    state.selectedDefectId = undefined;
    renderResource();
  }

  // 获取选中的缺陷
  function getSelectedDefect() {
    return state.defects.find(d => d.id === state.selectedDefectId) || null;
  }

  // 设置显示模式
  function setDisplayMode(mode: string) {
    state.currentMode = mode;
    renderResource();
  }

  // 设置通道可见性
  function setChannelVisibility(channel: number, visible: boolean) {
    if (channel >= 0 && channel < 9) { // 最多9个通道
      state.visibleChannels[channel] = visible;
      renderResource();
    }
  }

  // 更新网格配置（边距和留白）
  function updateGridConfig(config: { left?: number; right?: number; top?: number; bottom?: number }) {
    if (config.left !== undefined) state.grid.left = config.left;
    if (config.right !== undefined) state.grid.right = config.right;
    if (config.top !== undefined) state.grid.top = config.top;
    if (config.bottom !== undefined) state.grid.bottom = config.bottom;
    // 重新计算视口边界并刷新界面
    computeViewportBoundsAndClamp(false);
    renderResource();
  }

  // 获取当前缩放比例
  function getCurrentScale(): number {
    return state.scale;
  }

  // 重置缩放
  function resetZoom() {
    // 重置缩放到1.0，同时保持当前屏幕中心X轴位置
    const centerX = (canvas.value.width / getDPR()) / 2; // 屏幕中心的CSS像素

    // 使用当前的自适应比例进行计算，而非固定比例
    const pxPerMm = getCurrentPxPerMmH();

    const centerRel = centerX - state.viewportOffsetPx;
    const currentCenterMm = centerRel / pxPerMm; // 当前中心位置的mm值

    state.scale = 1.0; // 重置缩放

    // 计算新的偏移量以保持相同的中心位置
    // 使用基础自适应比例避免循环依赖
    const basePxPerMm = getBaseAdaptivePxPerMm();
    const newPxPerMmH = basePxPerMm * state.scale;
    const totalWidth = canvas.value.width / getDPR();
    const rightEdge = totalWidth - state.grid.right; // 右边距
    state.viewportOffsetPx = rightEdge - currentCenterMm * newPxPerMmH - centerX;

    clampViewportOffset(); // 确保偏移在边界内
    renderResource();
  }

  // 绘制鼠标框选区
  function renderCurrentRect() {
    if (state.drawingDefect && state.ctx) {
      const ctx = state.ctx;
      const left = state.grid.left, top = state.grid.top;
      const right = canvas.value.width / getDPR() - state.grid.right;
      const bottom = canvas.value.height / getDPR() - state.grid.bottom;

      // 保存当前上下文状态
      ctx.save();

      // 设置裁剪区域，只在绘图区域内绘制
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();

      // 绘制缺陷框
      const rectX = Math.min(state.drawingStartPos.x, state.drawingCurrentPos.x);
      const rectY = Math.min(state.drawingStartPos.y, state.drawingCurrentPos.y);
      const rectW = Math.abs(state.drawingStartPos.x - state.drawingCurrentPos.x);
      const rectH = Math.abs(state.drawingStartPos.y - state.drawingCurrentPos.y);

      // 只有当矩形在可视区域内时才绘制
      if (rectX < right && rectX + rectW > left && rectY < bottom && rectY + rectH > top) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // 虚线样式
        ctx.strokeRect(rectX, rectY, rectW, rectH);
      }

      // 恢复上下文状态
      ctx.restore();
    }
  }
  // 播放
  function play() {
    pause();

    // 轨道探伤数据播放逻辑
    function animation(ts: number) {
      if (!trackPlayer.isPlaying) {
        return;
      }

      if (state.lastFrameTs === 0) state.lastFrameTs = ts;
      const dt = (ts - state.lastFrameTs) / 1000;
      state.lastFrameTs = ts;

      // 根据当前播放速度更新偏移
      const playbackRate = trackPlayer.speed || 1;
      const mmPerSec = (state.baseSpeedMh / 3600) * 100 * playbackRate; // 转为mm/s
      const pxPerSec = mmPerSec * getCurrentPxPerMmH();
      // 修改：由于X轴方向改变，播放方向也要相应改变（原来是减，现在也是减，因为X轴倒置后逻辑相同）
      state.viewportOffsetPx -= pxPerSec * dt;

      clampViewportOffset();

      state.animationFrame = requestAnimationFrame(animation);
      renderResource();
    }
    animation(0);
  }

  // 暂停
  function pause() {
    cancelAnimationFrame(state.animationFrame);
    state.lastFrameTs = 0; // 重置时间戳
    // 轨道探伤数据暂停
    setTimeout(() => {
      renderResource();
    }, 1e3 / 60);
  }

  // 跳转到指定时间
  function seekTo(time: number) {
    // 轨道探伤数据跳转到指定距离
    if (state.trackData.length > 0) {
      const maxDistance = Math.max(...state.trackData.map(d => d.distanceMm));
      state.currentDistanceMm = Math.max(0, Math.min(time, maxDistance)); // 限制在数据范围内
    }
  }

  // 获取不带扩展名的文件名
  function getFilenameWithoutExtension() {
    // 计算画布左侧和右侧对应的公里数
    const left = state.grid.left;
    const right = canvas.value.width / getDPR() - state.grid.right;

    const leftMm = screenPxToOriginalMm(left);
    const rightMm = screenPxToOriginalMm(right);

    // 格式化为带小数点的公里标格式，如1.200
    const formatKm = (mm: number) => {
      const km = Math.floor(mm / 1000);
      const remainingMm = mm % 1000;
      return `${km}.${String(remainingMm).padStart(3, '0')}`;
    };

    const leftKmStr = formatKm(leftMm);
    const rightKmStr = formatKm(rightMm);

    // 获取画布范围内的所有缺陷名称
    const visibleDefectNames: string[] = [];

    for (const d of state.defects) {
      // 检查通道是否被选中（在trackPlayer.checkedTracks中）
      const channelLetter = String.fromCharCode(65 + d.channel); // A=0, B=1, C=2...
      const isChannelChecked = trackPlayer.checkedTracks.includes(channelLetter);

      if (!isChannelChecked) continue;

      // 检查缺陷是否在画布范围内
      let defectLeft: number, defectRight: number;
      if (state.onlyDefectMeters) {
        // 在onlyDefectMeters模式下，使用mmToScreenPx函数
        const x1 = mmToScreenPx(d.x1);
        const x2 = mmToScreenPx(d.x2);
        if (x1 !== null && x2 !== null) {
          defectLeft = Math.min(x1, x2);
          defectRight = Math.max(x1, x2);
        } else {
          continue;
        }
      } else {
        // 在普通模式下，使用distanceMmToScreenPx函数
        const x1 = distanceMmToScreenPx(d.x1);
        const x2 = distanceMmToScreenPx(d.x2);
        if (x1 !== null && x2 !== null) {
          defectLeft = Math.min(x1, x2);
          defectRight = Math.max(x1, x2);
        } else {
          continue;
        }
      }

      // 检查缺陷是否与画布范围相交
      if (defectRight >= left && defectLeft <= right) {
        // 使用note字段作为缺陷名称，如果不存在则使用id
        const defectName = d.note || d.id.toString();
        if (!visibleDefectNames.includes(defectName)) {
          visibleDefectNames.push(defectName);
        }
      }
    }

    // 组合所有部分
    // 由于X轴方向改变，left和right的mm值可能需要交换
    const parts = [rightKmStr, leftKmStr, ...visibleDefectNames]; // 交换了leftKmStr和rightKmStr的位置
    return parts.join('_');
  }

  // 获取图片
  function getDataURL(hasDefect = true, defect?: DefectData) {
    if (!canvas.value) {
      return '';
    }

    // 创建临时canvas用于生成图片
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      return '';
    }

    // 设置临时canvas尺寸
    tempCanvas.width = canvas.value.width;
    tempCanvas.height = canvas.value.height;

    if (hasDefect && defect) {
      // 如果指定了特定缺陷，将画布缩放比设为1，缺陷居中
      // 计算缺陷中心位置
      const defectCenterMm = (defect.x1 + defect.x2) / 2;

      // 保存当前状态
      const savedScale = state.scale;
      const savedOffset = state.viewportOffsetPx;

      // 设置缩放为1，居中显示缺陷
      state.scale = 1;

      // 计算居中所需的偏移
      const centerPx = (canvas.value.width / getDPR()) / 2;
      const leftPadding = state.grid.left;
      // 使用基础自适应比例避免循环依赖
      const basePxPerMm = getBaseAdaptivePxPerMm();
      state.viewportOffsetPx = -defectCenterMm * basePxPerMm * state.scale + centerPx - leftPadding;

      // 渲染到临时canvas，只显示特定缺陷
      renderSingleDefectToContext(tempCtx, defect);

      // 恢复原来的状态
      state.scale = savedScale;
      state.viewportOffsetPx = savedOffset;
    } else {
      // 重新绘制内容到临时canvas
      renderToContext(tempCtx, hasDefect);
    }

    // 返回DataURL
    return tempCanvas.toDataURL('image/png');
  }

  // 渲染到指定上下文的辅助函数
  function renderToContext(ctx: CanvasRenderingContext2D, showDefects: boolean = true) {
    const canvasWidth = canvas.value.width;
    const canvasHeight = canvas.value.height;

    // 计算画布尺寸和边距
    const padding = state.grid;
    const left = padding.left, right = canvasWidth - padding.right;
    const top = padding.top, bottom = canvasHeight - padding.bottom;

    // 绘制背景
    ctx.fillStyle = CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制边框
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, right - left, bottom - top);

    // 保存上下文并设置裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 绘制网格
    drawGrid(ctx, left, top, right, bottom);

    // 绘制探伤数据点
    drawTrackPoints(ctx, left, top, right, bottom);

    // 根据参数决定是否绘制缺陷
    if (showDefects && trackPlayer.showDefect) {
      drawDefects(ctx, left, top, right, bottom);
    }

    ctx.restore();

    // 绘制坐标轴标签
    drawYAxisLabels(ctx, left, top, right, bottom);
    drawXAxisTicks(ctx, left, top, right, bottom);
  }

  // 渲染单个缺陷到指定上下文的辅助函数
  function renderSingleDefectToContext(ctx: CanvasRenderingContext2D, defect: any) {
    const canvasWidth = canvas.value.width;
    const canvasHeight = canvas.value.height;

    // 计算画布尺寸和边距
    const padding = state.grid;
    const left = padding.left, right = canvasWidth - padding.right;
    const top = padding.top, bottom = canvasHeight - padding.bottom;

    // 绘制背景
    ctx.fillStyle = CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制边框
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, right - left, bottom - top);

    // 保存上下文并设置裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 绘制网格
    drawGrid(ctx, left, top, right, bottom);

    // 绘制探伤数据点
    drawTrackPoints(ctx, left, top, right, bottom);

    // 绘制单个缺陷
    if (trackPlayer.showDefect) {
      // 使用 x1, y1, x2, y2 从缺陷数据
      const x1 = mmToScreenPx(defect.x1);
      const x2 = mmToScreenPx(defect.x2);
      // 获取画布右侧对应的X轴位置来确定Y轴区间
      const rightEdge = canvas.value.width / getDPR() - 20; // 画布右侧边缘

      // 使用当前的自适应比例进行计算，而非固定比例
      const pxPerMm = getCurrentPxPerMmH();

      const rightRel = rightEdge - state.viewportOffsetPx;
      const rightMm = rightRel / pxPerMm; // 右侧对应的毫米值
      const y1 = amplitudeToY_mm(defect.y1, rightMm);
      const y2 = amplitudeToY_mm(defect.y2, rightMm);

      if (x1 !== null && x2 !== null) {
        // 计算屏幕坐标
        const rectX = Math.min(x1, x2); // 由于X轴从右到左，需要取较小的像素值作为起点
        const rectW = Math.max(2, Math.abs(x2 - x1)); // 使用绝对值计算宽度
        const rectY = Math.min(y1, y2);
        const rectH = Math.abs(y2 - y1);

        // 使用通道颜色绘制缺陷
        const channelColor = state.COLORS[defect.channel % state.COLORS.length];
        const fillAlpha = (defect.id === state.selectedDefectId) ? 0.3 : 0.12;
        const strokeAlpha = (defect.id === state.selectedDefectId) ? 0.8 : 0.4;

        ctx.fillStyle = hexToRgba(channelColor, fillAlpha);
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeStyle = hexToRgba(channelColor, strokeAlpha);
        // 根据缩放比例调整缺陷框厚度
        const scaledStrokeWidth = DEFECT_BOX_STROKE_WIDTH * state.scale;
        ctx.lineWidth = scaledStrokeWidth;
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.fillStyle = channelColor;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        const defectLabel = defect.note || defect.id;

        // 根据缩放比例调整字体大小
        const scaledFontSize = BASE_FONT_SIZE * state.scale;
        ctx.font = `${scaledFontSize}px sans-serif`;

        // 测量文本尺寸
        const textHeight = scaledFontSize; // 根据字体大小调整高度比例

        // 尝试在缺陷框上方放置标签，如果上方空间不够则放在下方
        let labelX = rectX + 4;
        let labelY = rectY - 2; // 默认在缺陷框上方

        // 检查是否超出画布顶部，如果超出则放在下方
        if (labelY - textHeight < top) {
          labelY = rectY + rectH + textHeight - 2; // 放在缺陷框下方
        }

        // 绘制标签
        ctx.fillText(defectLabel, labelX, labelY);
      }
    }

    ctx.restore();

    // 绘制坐标轴标签
    drawYAxisLabels(ctx, left, top, right, bottom);
    drawXAxisTicks(ctx, left, top, right, bottom);
  }

  // 下载图片
  function download() {
    const dataURL = getDataURL(true); // 默认绘制缺陷

    if (!dataURL) {
      console.error('无法生成图片数据');
      return;
    }

    // 创建下载链接
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${getFilenameWithoutExtension()}.png`;

    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 鼠标在document松开事件
  function mouseupFnDocument() {
    document.onselectstart = null
    // 同时清除画布拖拽状态，防止在画布外松开鼠标后仍保持拖拽状态
    state.isDown = false;
  }

  // 监听播放状态变化
  watch(() => trackPlayer.isPlaying, (newVal) => {
    if (newVal) {
      play();
    } else {
      pause();
    }
  });

  // 监听轨道选择变化（优化：避免不必要的完整重绘）
  watch(() => [trackPlayer.checkedTracks, trackPlayer.toolData.bMode], () => {
    // 只在模式变化时重新初始化，通道变化时只需重新渲染
    resizeResourceFn();
  }, { deep: false }); // 禁用深度监听以提高性能

  onMounted(() => {
    nextTick(() => initResourceFn())
    window.addEventListener('resize', resizeResourceFn)
    window.addEventListener('mouseup', mouseupFnDocument)
    // 监听轨道探伤数据变化 - 使用 eventBus 代替 watch
    eventBus.on('track-inspection-data-updated', () => {
      console.log('Track inspection data updated via eventBus, reinitializing canvas...');
      initResourceFn();
    });
  })
  onUnmounted(() => {
    eventBus.off('track-inspection-data-updated');
    window.removeEventListener('resize', resizeResourceFn)
    window.removeEventListener('mouseup', mouseupFnDocument)
    cancelAnimationFrame(state.animationFrame)
  })

  return {
    canvas,
    mousedownFn,
    mousemoveFn,
    mouseupFn,
    mouseoutFn,
    wheelFn,
    dblclickFn,
    clickFn, // 添加点击处理函数
    play,
    pause,
    seekTo,
    getDataURL,
    resetFn,
    refreshFn,
    state,
    tips,
    // 新增方法
    getSelectedDefect,
    setDisplayMode,
    setChannelVisibility,
    getCenterMm,
    getCurrentScale,
    resetZoom,
    setViewCenterMm, // 添加设置视图中心的方法
    resizeResourceFn, // 导出resize方法以便外部调用
    download,
    updateGridConfig, // 添加网格配置更新方法
  }
}