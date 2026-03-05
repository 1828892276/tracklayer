<template>
    <div class="dialog-content">
      <!-- 工具栏 -->
      <div class="setting-item" v-if="!hideTool">
        <label class="setting-label">工具栏：</label>
        <el-switch v-model="trackPlayer.showFixedTool" class="setting-switch" />
      </div>

      <!-- 位置信息提示 -->
      <div class="setting-item">
        <label class="setting-label">位置信息提示：</label>
        <el-switch v-model="trackPlayer.toolData.showPositionInfo" class="setting-switch" />
      </div>

      <!-- 缺陷信息提示 -->
      <div class="setting-item">
        <label class="setting-label">缺陷信息提示：</label>
        <el-switch v-model="trackPlayer.toolData.showDefectInfo" class="setting-switch" />
      </div>

      <!-- 进度条公里标 -->
      <div class="setting-item">
        <label class="setting-label">进度条公里标：</label>
        <el-switch v-model="trackPlayer.toolData.showKm" class="setting-switch" />
      </div>

      <!-- B显模式 -->
      <div class="setting-item">
        <label class="setting-label">B显模式：</label>
        <el-radio-group v-model="trackPlayer.toolData.bMode">
          <el-radio :value="B_DISPLAY_MODE.COMBINE">合</el-radio>
          <el-radio :value="B_DISPLAY_MODE.SPLIT">分</el-radio>
          <el-radio :value="B_DISPLAY_MODE.CENTER">中</el-radio>
        </el-radio-group>
      </div>
      
      <!-- 源数据播放模式 -->
      <div class="setting-item">
        <label class="setting-label">源数据播放模式：</label>
        <el-radio-group v-model="trackPlayer.toolData.playMode">
          <el-radio :value="PLAY_MODE.FULL">全程</el-radio>
          <el-radio :value="PLAY_MODE.CLIP">剪辑</el-radio>
        </el-radio-group>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { trackPlayerStore, B_DISPLAY_MODE, PLAY_MODE } from '../hooks'

const props = defineProps<{
  hideTool?: boolean // 是否隐藏工具栏
}>()

// 全局数据
const trackPlayer = trackPlayerStore()

const maxFrameStep = computed(() => {
  return 10
})

</script>

<style scoped>
.dialog-content {
  padding: 16px 10px 10px;
  width: 360px;
  background-color: var(--el-bg-color);
  font-size: 14px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  color: var(--el-text-color-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.setting-label {
  font-weight: 500;
  white-space: nowrap;
  /* width: 100px; */
}

.setting-slider {
  flex: 1;
  margin-right: 10px;
}

.setting-value {
  min-width: 40px;
  text-align: center;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.setting-input {
  width: 140px;
}

.dialog-footer {
  text-align: right;
}
</style>