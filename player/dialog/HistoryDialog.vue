<template>
  <el-dialog
    v-model="trackPlayer.openHistory"
    title="历史查看"
    width="840px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="history-content">
      <!-- Tabs 组件 -->
      <el-tabs v-model="activeTab" class="history-tabs">
        <el-tab-pane label="历史数据查看" name="data"></el-tab-pane>
        <el-tab-pane label="历史缺陷查看" name="defect"></el-tab-pane>
      </el-tabs>
      
      <!-- 横向滚动的时间选择按钮 -->
      <div class="time-selector-container">
        <div class="time-scroll-wrapper">
          <el-scrollbar class="time-scrollbar" :native="false">
            <div class="time-buttons-container">
              <el-button
                v-for="(date, index) in dateList"
                :key="index"
                :type="selectedDateIndex === index ? 'primary' : 'default'"
                @click="selectDate(index)"
                class="time-button"
              >
                {{ date }}
              </el-button>
            </div>
          </el-scrollbar>
        </div>
      </div>
      
      <!-- 灰色容器 -->
      <div class="gray-container">
        <el-button class="contrast-btn" type="default" @click="handleClose">同屏对比</el-button>
        <PlayView ref="playRef" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { trackPlayerStore } from '../hooks/index'
import PlayView from '../PlayView.vue';

const trackPlayer = trackPlayerStore()
const playRef = ref()

const activeTab = ref('data')
const selectedDateIndex = ref(0)
const dateList = ref([
  '2025年12月07日',
  '2026年01月03日'
])

const selectDate = (index) => {
  selectedDateIndex.value = index
}

const handleClose = () => {
  trackPlayer.openHistory = false
}

watch(() => trackPlayer.openHistory, (newVal) => {
  if (newVal) {
    nextTick(() => {
      const player = playRef.value?.player
      if (player.state.bottom != 30) {
        player.updateGridConfig({ bottom: 30 })
      }
    })
  }
})

</script>

<style scoped lang="less">
.dialog-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.column {
  display: flex;
  flex-direction: column;
}

.form-group {
  /* margin-bottom: 14px; */
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
  font-weight: 500;
}

.shortcut-display {
  padding: 6px 12px;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  color: #909399;
  text-align: center;
  min-height: 32px;
  line-height: 1.4;
  font-family: monospace;
  font-size: 14px;
}
.editing .shortcut-display:not(.editing):not(.disabled) {
  background-color: #fefefe;
}
.shortcut-display.editing {
  background-color: #e6f7ee;
  border: 1px dashed #67c23a;
}

.history-content {
  width: 100%;
}

.history-tabs :deep(.el-tabs__header) {
  margin-bottom: 6px;
}

.time-selector-container {
  margin-bottom: 6px;
}

.time-scroll-wrapper {
  width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  padding: 8px 0;
}

.time-buttons-container {
  display: inline-flex;
  gap: 8px;
}

.time-button {
  min-width: 120px;
}

.gray-container {
  width: 100%;
  height: 450px;
  background-color: #f5f5f5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.contrast-btn {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 10;
}
</style>