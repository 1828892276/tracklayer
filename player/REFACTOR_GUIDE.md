# useCanvasDraw.ts 模块化重构指南

## 📁 已创建的文件结构

```
player/
├── types/
│   └── index.ts                  ✅ 已完成 - 类型定义
├── utils/
│   ├── perfMonitor.ts            ✅ 已完成 - 性能监控
│   └── helpers.ts                ✅ 已完成 - 辅助函数
├── modules/
│   ├── dataProcessor.ts          ⚠️ 待完善 - 数据处理
│   ├── renderers/
│   │   ├── trackPointsRenderer.ts ⚠️ 待完善 - 数据点渲染
│   │   ├── defectsRenderer.ts    ❌ 待创建 - 缺陷渲染
│   │   ├── gridRenderer.ts       ❌ 待创建 - 网格渲染
│   │   ├── axisRenderer.ts       ❌ 待创建 - 坐标轴渲染
│   │   └── offscreenRenderer.ts  ❌ 待创建 - 离屏缓存渲染
│   ├── interaction/
│   │   ├── mouseHandler.ts       ❌ 待创建 - 鼠标事件
│   │   └── zoomHandler.ts        ❌ 待创建 - 缩放处理
│   └── index.ts                  ✅ 已完成 - 模块导出
└── hooks/
    └── useLifecycle.ts           ❌ 待创建 - 生命周期
```

## 🔧 需要完成的步骤

### 步骤 1: 修正已有文件

#### 1.1 修正 dataProcessor.ts
```typescript
// 修改导入路径（移除不存在的 ./hooks）
import type { TrackPoint, DefectData, YAxisRange } from '../types'

// 添加 trackPlayerStore 作为参数传入，而不是直接导入
export function extractTrackInspectionData(trackPlayer: any): {
  trackData: TrackPoint[]
  defects: DefectData[]
  yAxisData: YAxisRange[]
}
```

#### 1.2 修正 trackPointsRenderer.ts
```typescript
// 添加缺失的导入
import { perfStats } from '../../utils/perfMonitor'

// 或者直接使用 perfEnd 返回值，在调用处累加
```

### 步骤 2: 创建缺失的渲染器

#### 2.1 defectsRenderer.ts - 缺陷渲染器
```typescript
import type { CanvasState, DefectData } from '../../types'
import { hexToRgba } from '../../utils/helpers'
import { perfStart, perfEnd } from '../../utils/perfMonitor'

export function drawDefects(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  mmToScreenPx: (mm: number) => number | null,
  amplitudeToY_mm: (mmValue: number, xAxisPosition?: number) => number
): void {
  const startTime = perfStart('drawDefects')
  
  // 从原 drawDefects 函数迁移代码
  
  perfStats.drawDefectsTime += perfEnd('drawDefects', startTime)
}
```

#### 2.2 gridRenderer.ts - 网格渲染器
```typescript
import type { CanvasState } from '../../types'
import { perfStart, perfEnd } from '../../utils/perfMonitor'

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  canvas: HTMLCanvasElement,
  getYAxisRangeForPosition: (xMm: number) => any,
  pxPerMmV_current: () => number
): void {
  const startTime = perfStart('drawGrid')
  
  // 从原 drawGrid 函数迁移代码
  
  perfStats.drawGridTime += perfEnd('drawGrid', startTime)
}
```

#### 2.3 axisRenderer.ts - 坐标轴渲染器
```typescript
// 包含两个函数
export function drawYAxisLabels(...)
export function drawXAxisTicks(...)
```

#### 2.4 offscreenRenderer.ts - 离屏缓存渲染器
```typescript
export function generateOffscreenCache(...)
export function getOffscreenCacheHash(...)
```

### 步骤 3: 创建交互处理器

#### 3.1 mouseHandler.ts - 鼠标事件处理器
```typescript
import type { CanvasState, Position } from '../../types'

export interface MouseHandlers {
  mousedownFn: (e: MouseEvent) => void
  mousemoveFn: (e: MouseEvent) => void
  mouseupFn: () => void
  mouseoutFn: () => void
}

export function createMouseHandlers(
  state: CanvasState,
  canvas: Ref<any>,
  // ... 其他依赖
): MouseHandlers {
  // 实现所有鼠标事件处理函数
}
```

### 步骤 4: 重构主文件 useCanvasDraw.ts

将原文件缩减为协调器角色：

```typescript
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { trackPlayerStore, B_DISPLAY_MODE } from './hooks'
import eventBus from '../../../utils/eventBus'

// 导入所有模块
import {
  // 类型
  type CanvasDraw,
  type CanvasState,
  
  // 工具
  getDPR,
  hexToRgba,
  clearCanvas,
  perfStart,
  perfEnd,
  printPerfStats,
  
  // 数据处理
  extractTrackInspectionData,
  buildSelectedMetersFromDefects,
  cachedIChannelBaseLine,
  
  // 渲染器
  drawGrid,
  drawYAxisLabels,
  drawXAxisTicks,
  drawTrackPoints,
  drawDefects,
} from './modules'

// 常量定义
const CANVAS_BG_COLOR = '#FFFFC0'
const TEXT_COLOR = '#222'
// ...

export function useCanvasDraw(): CanvasDraw {
  const trackPlayer = trackPlayerStore()
  const canvas = ref()
  
  // 状态初始化
  const state = reactive<CanvasState>({ /* ... */ })
  
  // Y 轴区间数据
  const yAxisData = ref<YAxisRange[]>([])
  
  // 离屏缓存
  let offscreenCanvas: HTMLCanvasElement | null = null
  let cachedOffscreenHash: string | null = null
  
  // ==================== 坐标系统 ====================
  // 从原文件迁移坐标转换函数
  function getCenterMmSafe(): number { /* ... */ }
  function getCurrentPxPerMmH(): number { /* ... */ }
  function pxPerMmV_current(): number { /* ... */ }
  function mmToScreenPx(mm: number): number | null { /* ... */ }
  function amplitudeToY_mm(mmValue: number, xAxisPosition?: number): number { /* ... */ }
  // ...
  
  // ==================== 渲染逻辑 ====================
  function renderResource() {
    if (state.ctx && state.loaded && canvas.value) {
      const renderStartTime = perfStart('totalRender')
      
      clearCanvas(canvas.value, state.ctx, CANVAS_BG_COLOR)
      
      // 检查离屏缓存
      const currentHash = getOffscreenCacheHash()
      if (!offscreenCanvas || cachedOffscreenHash !== currentHash) {
        generateOffscreenCache(/* 参数 */)
        cachedOffscreenHash = currentHash
      }
      
      // 绘制离屏缓存
      if (offscreenCanvas) {
        state.ctx.drawImage(offscreenCanvas, 0, 0)
      }
      
      // 绘制动态元素（使用模块化的渲染器）
      drawTrackPoints(state.ctx, state, canvas.value, mmToScreenPx, amplitudeToY_mm, /* ... */)
      drawDefects(state.ctx, state, canvas.value, mmToScreenPx, amplitudeToY_mm)
      
      // 记录性能
      const totalRenderTime = perfEnd('totalRender', renderStartTime)
      // 更新 stats（在 perfMonitor 中已自动处理）
      printPerfStats()
    }
  }
  
  // ==================== 初始化 ====================
  function initResourceFn() {
    // 使用模块化的数据处理
    const { trackData, defects, yAxisData } = extractTrackInspectionData(trackPlayer)
    
    state.trackData = trackData
    state.defects = defects
    
    // 构建压缩显示数据
    const { selectedMeters, selectedMetersIndex } = buildSelectedMetersFromDefects(defects)
    state.selectedMeters = selectedMeters
    state.selectedMetersIndex = selectedMetersIndex
    
    // 继续初始化...
  }
  
  // ==================== 事件处理 ====================
  // 使用模块化的事件处理器
  const mouseHandlers = createMouseHandlers(state, canvas, /* ... */)
  
  // ==================== 生命周期 ====================
  onMounted(() => {
    nextTick(() => initResourceFn())
    window.addEventListener('resize', resizeResourceFn)
    // ...
  })
  
  onUnmounted(() => {
    // 清理...
  })
  
  // ==================== 导出接口 ====================
  return {
    canvas,
    ...mouseHandlers,
    play,
    pause,
    seekTo,
    getDataURL,
    resetFn,
    refreshFn,
    state,
    tips,
    // ...
  }
}
```

## 🎯 关键设计原则

### 1. 依赖注入
- 不要直接在模块中导入 `trackPlayerStore`
- 通过函数参数传递依赖
- 提高可测试性

### 2. 循环不变量提取
根据记忆中的经验，在渲染循环中：
```typescript
// ❌ 错误：每次循环都重新计算
for (const point of points) {
  const pxPerMm = getCurrentPxPerMmH() // 重复计算
  const px = point.distanceMm * pxPerMm
}

// ✅ 正确：提取到循环外
const pxPerMm = getCurrentPxPerMmH() // 只计算一次
for (const point of points) {
  const px = point.distanceMm * pxPerMm
}
```

### 3. 性能监控集成
每个渲染函数都要包含：
```typescript
const startTime = perfStart('functionName')
// ... 渲染逻辑 ...
perfStats.drawXXXTime += perfEnd('functionName', startTime)
```

### 4. 类型安全
- 所有函数都有明确的输入输出类型
- 使用 TypeScript 严格模式
- 避免 `any` 类型

## 📊 预期收益

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| 文件大小 | ~2500 行 | ~300 行/模块 |
| 可维护性 | 低 | 高 |
| 可测试性 | 低 | 高 |
| 性能 | 相同 | 相同（但更容易优化） |

## ✅ 验收标准

1. [ ] 所有类型定义完整且正确
2. [ ] 性能监控功能正常工作
3. [ ] 渲染效果与原版一致
4. [ ] 鼠标交互功能正常
5. [ ] 无 TypeScript 编译错误
6. [ ] 代码可读性提升

## 🚀 下一步行动

1. **先完成剩余模块的创建**（defectsRenderer, gridRenderer 等）
2. **逐步迁移原文件代码**到新模块
3. **每迁移一个函数就进行测试**
4. **最后整合主文件**
5. **全面回归测试**

需要我帮您继续创建具体的模块吗？请告诉我优先级。
