<template>
  <div class="player-view" :style="{cursor: trackPlayer.isAdd ? 'crosshair' : ''}">
    <canvas
      ref="canvas"
      class="player-canvas"
      @mousedown="mousedownFn"
      @mousemove="mousemoveFn"
      @mouseup="mouseupFn"
      @wheel="wheelFn"
      @mouseout="mouseoutFn"
      @dblclick="dblclickFn"
    ></canvas>
    <div class="play-state" style="opacity: 1;" v-if="state.loading">
      <div class="control-btn downloading"></div>
    </div>
    <div class="play-tips" v-show="tips.show" :style="{ left: tips.x + 'px', top: tips.y + 'px' }">{{ tips.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasDraw } from './useCanvasDraw.modular'
import { trackPlayerStore } from './hooks'
import { computed, onMounted, onUnmounted } from 'vue'

// 全局数据
const trackPlayer = window._playerData = trackPlayerStore()

const player = useCanvasDraw()

const {
  canvas,
  mousedownFn,
  mousemoveFn,
  mouseupFn,
  mouseoutFn,
  wheelFn,
  dblclickFn,
  tips,
  state,
} = player

onMounted(() => {
})

onUnmounted(() => {
})

defineExpose({ player })

</script>

<style scoped lang="less">
.player-view {
  width: 100%;
  height: 100%;
  background-color: #000;
  position: relative;
  overflow: hidden;
  .player-canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
}
.play-state {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  .control-btn {
    width: 34px;
    height: 34px;
    line-height: 40px;
    text-align: center;
  }
  .downloading {
    background: url(./assets/loading.gif) no-repeat center center / 28px 28px;
  }
}

.play-tips {
  position: absolute;
  color: #444;
  pointer-events: none;
  font-size: 14px;
  font-weight: 400;
  transform: translate(-50%, -100%);
}
</style>