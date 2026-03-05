import { onMounted, onUnmounted } from 'vue'
import type { CanvasDraw } from '../types'

/**
 * 生命周期管理钩子
 */
export function useLifecycle(
  canvasDraw: CanvasDraw,
  initResourceFn: () => void,
  resizeResourceFn: () => void
) {
  /**
   * 组件挂载时的初始化
   */
  function handleMounted(): void {
    // 初始化资源
    initResourceFn()

    // 监听窗口大小变化
    window.addEventListener('resize', resizeResourceFn)

    console.log('Canvas component mounted')
  }

  /**
   * 组件卸载时的清理
   */
  function handleUnmounted(): void {
    // 移除事件监听
    window.removeEventListener('resize', resizeResourceFn)

    // 清除定时器
    if (canvasDraw.state.animationFrame) {
      cancelAnimationFrame(canvasDraw.state.animationFrame)
    }

    console.log('Canvas component unmounted')
  }

  // 注册生命周期钩子
  onMounted(handleMounted)
  onUnmounted(handleUnmounted)

  return {
    handleMounted,
    handleUnmounted
  }
}