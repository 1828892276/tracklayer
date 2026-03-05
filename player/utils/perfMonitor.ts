// 性能监控配置
export interface PerfConfig {
  enabled: boolean
  logInterval: number
}

// 性能统计数据
export interface PerfStats {
  totalRenderTime: number
  offscreenGenTime: number
  drawGridTime: number
  drawYAxisLabelsTime: number
  drawXAxisTicksTime: number
  drawTrackPointsTime: number
  drawDefectsTime: number
  drawIChannelBaseLineTime: number
}

const config: PerfConfig = {
  enabled: true,
  logInterval: 10 // 每 10 帧打印一次
}

let frameCount = 0

// 性能统计数据（导出供渲染模块使用）
export const perfStats: PerfStats = {
  totalRenderTime: 0,
  offscreenGenTime: 0,
  drawGridTime: 0,
  drawYAxisLabelsTime: 0,
  drawXAxisTicksTime: 0,
  drawTrackPointsTime: 0,
  drawDefectsTime: 0,
  drawIChannelBaseLineTime: 0,
}

/**
 * 开始性能计时
 */
export function perfStart(label: string): number {
  if (!config.enabled) return 0
  return performance.now()
}

/**
 * 结束性能计时并记录
 */
export function perfEnd(label: string, startTime: number): number {
  if (!config.enabled) return 0
  const duration = performance.now() - startTime

  // 累加到对应的统计项
  switch (label) {
    case 'totalRender':
      perfStats.totalRenderTime += duration
      break
    case 'offscreenGen':
      perfStats.offscreenGenTime += duration
      break
    case 'drawGrid':
      perfStats.drawGridTime += duration
      break
    case 'drawYAxisLabels':
      perfStats.drawYAxisLabelsTime += duration
      break
    case 'drawXAxisTicks':
      perfStats.drawXAxisTicksTime += duration
      break
    case 'drawTrackPoints':
      perfStats.drawTrackPointsTime += duration
      break
    case 'drawDefects':
      perfStats.drawDefectsTime += duration
      break
    case 'drawIChannelBaseLine':
      perfStats.drawIChannelBaseLineTime += duration
      break
  }

  return duration
}

/**
 * 打印性能统计报告
 */
export function printPerfStats(): void {
  if (!config.enabled) return

  frameCount++
  if (frameCount % config.logInterval !== 0) return

  console.group('📊 Canvas 渲染性能统计')
  console.log(`总渲染时间：${perfStats.totalRenderTime.toFixed(2)}ms`)
  console.log(`  - 离屏缓存生成：${perfStats.offscreenGenTime.toFixed(2)}ms (${(perfStats.offscreenGenTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制网格：${perfStats.drawGridTime.toFixed(2)}ms (${(perfStats.drawGridTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制 Y 轴标签：${perfStats.drawYAxisLabelsTime.toFixed(2)}ms (${(perfStats.drawYAxisLabelsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制 X 轴刻度：${perfStats.drawXAxisTicksTime.toFixed(2)}ms (${(perfStats.drawXAxisTicksTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制数据点：${perfStats.drawTrackPointsTime.toFixed(2)}ms (${(perfStats.drawTrackPointsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制缺陷：${perfStats.drawDefectsTime.toFixed(2)}ms (${(perfStats.drawDefectsTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`  - 绘制 I 通道底线：${perfStats.drawIChannelBaseLineTime.toFixed(2)}ms (${(perfStats.drawIChannelBaseLineTime / perfStats.totalRenderTime * 100).toFixed(1)}%)`)
  console.log(`帧率估算：${(1000 / (perfStats.totalRenderTime / config.logInterval)).toFixed(1)} FPS`)
  console.groupEnd()

  // 重置统计数据
  resetPerfStats()
}

/**
 * 重置性能统计数据
 */
export function resetPerfStats(): void {
  Object.assign(perfStats, {
    totalRenderTime: 0,
    offscreenGenTime: 0,
    drawGridTime: 0,
    drawYAxisLabelsTime: 0,
    drawXAxisTicksTime: 0,
    drawTrackPointsTime: 0,
    drawDefectsTime: 0,
    drawIChannelBaseLineTime: 0,
  })
}

/**
 * 重置帧数计数
 */
export function resetFrameCount(): void {
  frameCount = 0
}
