# 模块化重构 - 快速参考指南

## 📦 模块文件结构

```
player/
├── types/
│   └── index.ts              # 类型定义
├── utils/
│   ├── perfMonitor.ts        # 性能监控
│   └── helpers.ts            # 辅助函数
├── modules/
│   ├── dataProcessor.ts      # 数据处理
│   ├── renderers/
│   │   ├── trackPointsRenderer.ts  # 数据点渲染
│   │   ├── defectsRenderer.ts      # 缺陷渲染
│   │   ├── gridRenderer.ts         # 网格渲染
│   │   ├── axisRenderer.ts         # 坐标轴渲染
│   │   └── offscreenRenderer.ts    # 离屏缓存
│   ├── interaction/
│   │   └── mouseHandler.ts   # 鼠标事件
│   │   └── zoomHandler.ts    # 缩放处理
│   └── index.ts              # 统一导出
├── hooks/
│   └── useLifecycle.ts       # 生命周期
└── useCanvasDraw.ts          # 主文件（待整合）
```

## 🔌 导入示例

### 从主索引导入
```typescript
import {
  // 渲染器
  drawTrackPoints,
  drawDefects,
  drawGrid,
  drawYAxisLabels,
  drawXAxisTicks,
  generateOffscreenCache,
  
  // 数据处理
  extractTrackInspectionData,
  buildSelectedMetersFromDefects,
  
  // 交互
  createMouseHandlers,
  
  // 工具
  perfStart, perfEnd, perfStats,
  getDPR, hexToRgba, clearCanvas,
  
  // 生命周期
  useLifecycle,
} from './modules'
```

### 分类导入

#### 渲染器
```typescript
import {
  drawTrackPoints,
  drawDefects,
  drawGrid,
  drawYAxisLabels,
  drawXAxisTicks,
} from './modules/renderers'
```

#### 离屏缓存
```typescript
import {
  generateOffscreenCache,
  getOffscreenCacheHash,
  isOffscreenCacheValid,
  getOffscreenCanvas,
  clearOffscreenCache,
} from './modules/renderers'
```

#### 性能监控
```typescript
import {
  perfStart,
  perfEnd,
  perfStats,
  printPerfStats,
  resetPerfStats,
} from './modules/utils/perfMonitor'
```

## 🎨 使用模式

### 1. 数据提取
```typescript
// 在组件中调用
const { trackData, defects, yAxisData } = extractTrackInspectionData(trackPlayer)

// 更新状态
state.trackData = trackData
state.defects = defects
```

### 2. 渲染循环
```typescript
function renderResource() {
  const renderStartTime = perfStart('totalRender')
  
  // 清空画布
  clearCanvas(canvas.value, state.ctx, CANVAS_BG_COLOR)
  
  // 检查离屏缓存
  const currentHash = getOffscreenCacheHash(state)
  if (!isOffscreenCacheValid(currentHash)) {
    offscreenCanvas = generateOffscreenCache(
      state,
      canvas.value,
      drawGrid,
      drawYAxisLabels,
      drawXAxisTicks,
      getYAxisRangeForPosition,
      pxPerMmV_current,
      amplitudeToY_mm
    )
  }
  
  // 绘制离屏缓存
  if (offscreenCanvas) {
    state.ctx.drawImage(offscreenCanvas, 0, 0)
  }
  
  // 绘制动态元素
  drawTrackPoints(
    state.ctx,
    state,
    canvas.value,
    mmToScreenPx,
    amplitudeToY_mm,
    isSplitMode,
    getChannelRegion,
    drawIChannelBaseLine
  )
  
  drawDefects(
    state.ctx,
    state,
    canvas.value,
    mmToScreenPx,
    amplitudeToY_mm
  )
  
  // 记录性能
  const totalRenderTime = perfEnd('totalRender', renderStartTime)
  perfStats.totalRenderTime += totalRenderTime
  printPerfStats()
}
```

### 3. 鼠标事件处理
```typescript
// 创建鼠标处理器
const mouseHandlers = createMouseHandlers(
  state,
  canvas,
  tips,
  () => getSelectedDefect(),
  (defect) => onSelectDefect(defect),
  (x, y) => onPanStart(x, y),
  (dx, dy) => onPanMove(dx, dy),
  () => onPanEnd(),
  (deltaY, mouseX, mouseY) => onZoom(deltaY, mouseX, mouseY)
)

// 绑定到模板
// <canvas @mousedown="mouseHandlers.mousedownFn" ... />
```

### 4. 生命周期管理
```typescript
const canvasDraw = useCanvasDraw()

useLifecycle(
  canvasDraw,
  initResourceFn,
  resizeResourceFn
)
```

## ⚡ 性能优化要点

### 1. 循环不变量提取
```typescript
// ✅ 正确做法
const padding = state.grid
const left = padding.left
const right = canvasWidth - padding.right

for (const point of points) {
  const x = left + (mm - centerMm) * pxPerMm
}

// ❌ 错误做法
for (const point of points) {
  const padding = state.grid
  const left = padding.left
  const x = left + (mm - centerMm) * pxPerMm
}
```

### 2. 离屏缓存
- 静态元素（网格、坐标轴标签）绘制到离屏 Canvas
- 只在配置变化时重新生成缓存
- 动态元素（数据点、缺陷）直接绘制到主 Canvas

### 3. 性能监控
每个渲染函数都自动记录耗时：
```typescript
const startTime = perfStart('functionName')
// ... 渲染逻辑 ...
perfStats.functionNameTime += perfEnd('functionName', startTime)
```

每 10 帧自动打印统计：
```
📊 Canvas 渲染性能统计
总渲染时间：1063.20ms
  - 离屏缓存生成：3.60ms (0.3%)
  - 绘制网格：0.50ms (0.0%)
  - 绘制 Y 轴标签：0.90ms (0.1%)
  - 绘制 X 轴刻度：1.10ms (0.1%)
  - 绘制数据点：1058.50ms (99.6%)
  - 绘制缺陷：0.20ms (0.0%)
  - 绘制 I 通道底线：234.00ms (22.0%)
帧率估算：9.4 FPS
```

## 🔧 依赖注入

### 通过参数传递依赖
```typescript
// ✅ 推荐：作为参数传入
export function extractTrackInspectionData(trackPlayer: any) {
  const rawData = trackPlayer.getTrackInspectionData()
}

// ❌ 避免：在模块内直接导入
import { trackPlayerStore } from '../hooks'
export function extractTrackInspectionData() {
  const trackPlayer = trackPlayerStore()
}
```

## 📝 函数签名参考

### 渲染器函数

#### drawTrackPoints
```typescript
function drawTrackPoints(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number,
  isSplitMode: () => boolean,
  getChannelRegion: (channelId: number) => { regionTop: number; regionBottom: number },
  drawIChannelBaseLine: (
    ctx: CanvasRenderingContext2D,
    left: number,
    regionTop: number,
    regionBottom: number,
    channelIndex: number
  ) => void
): void
```

#### drawDefects
```typescript
function drawDefects(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): void
```

#### drawGrid
```typescript
function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): void
```

### 数据处理

#### extractTrackInspectionData
```typescript
function extractTrackInspectionData(
  trackPlayer: any
): {
  trackData: TrackPoint[]
  defects: DefectData[]
  yAxisData: YAxisRange[]
}
```

### 离屏缓存

#### generateOffscreenCache
```typescript
function generateOffscreenCache(
  state: CanvasState,
  canvas: HTMLCanvasElement,
  drawGridFn: (...args) => void,
  drawYAxisLabelsFn: (...args) => void,
  drawXAxisTicksFn: (...args) => void,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): HTMLCanvasElement
```

## 🐛 常见问题

### Q1: perfStats 对象引用问题
**问题**: `resetPerfStats()` 会创建新对象导致引用失效

**解决**: 只修改属性，不替换对象
```typescript
// ✅ 正确
export function resetPerfStats(): void {
  perfStats.totalRenderTime = 0
  perfStats.drawGridTime = 0
  // ...
}

// ❌ 错误
export function resetPerfStats(): void {
  perfStats = { ... } // 创建了新对象
}
```

### Q2: 循环内的重复计算
**问题**: 在渲染循环中重复计算固定值

**解决**: 提取循环不变量
```typescript
// 循环外计算一次
const pxPerMm = getCurrentPxPerMmH()
for (const point of points) {
  const px = point.distanceMm * pxPerMm
}
```

## 📋 下一步行动

1. **整合主文件** - 将 `useCanvasDraw.ts` 重构为协调器
2. **完善交互功能** - 实现完整的碰撞检测和悬浮提示
3. **测试验证** - 对比原版进行功能和性能测试
4. **文档完善** - 添加更多使用示例和注释

---

**最后更新**: 2026-03-04
