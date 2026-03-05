<template>
  <div class="dialog-content">
    <div class="data-switch-list">
      <div
        class="data-item"
        :class="{ 'selected': trackPlayer.reviewMode === REVIEW_MODE.TRADITIONAL }"
        @click="handleItemClick(REVIEW_MODE.TRADITIONAL)"
      >
        <div class="file-name">{{ getModeDisplayName(REVIEW_MODE.TRADITIONAL) }}</div>
      </div>
      <div
        class="data-item"
        :class="{ 'selected': trackPlayer.reviewMode === REVIEW_MODE.DEFECT_PRIORITY }"
        @click="handleItemClick(REVIEW_MODE.DEFECT_PRIORITY)"
      >
        <div class="file-name">{{ getModeDisplayName(REVIEW_MODE.DEFECT_PRIORITY) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { trackPlayerStore, REVIEW_MODE } from '../hooks'

// 全局数据
const trackPlayer = trackPlayerStore()

// 点击某一项
const handleItemClick = (type: typeof REVIEW_MODE[keyof typeof REVIEW_MODE]) => {
  if (trackPlayer.reviewMode === type) {
    return;
  }
  trackPlayer.reviewMode = type
}

// 获取模式显示名称
const getModeDisplayName = (mode: typeof REVIEW_MODE[keyof typeof REVIEW_MODE]) => {
  const modeMap = {
    [REVIEW_MODE.TRADITIONAL]: '传统复核模式',
    [REVIEW_MODE.DEFECT_PRIORITY]: '缺陷导向模式'
  }
  return modeMap[mode] || mode
}

onMounted(() => {
})

onUnmounted(() => {
})

</script>

<style scoped lang="less">
.dialog-content {
  padding: 10px;
  width: 360px;
  background-color: var(--el-bg-color);
  font-size: 14px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  color: var(--el-text-color-regular);
  .dialog-title {
    border-bottom: 1px solid var(--el-border-color);
    padding-bottom: 10px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--el-text-color-primary);
    .task-name {
      color: #999;
      max-width: calc(100% - 70px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
.data-switch-list {
  max-height: 400px;
  overflow-y: auto;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:last-child {
    margin-bottom: 0px;
  }
}

.data-item:hover {
  background-color: var(--el-bg-color-page);
}

.data-item.selected {
  background-color: var(--el-bg-color-page);
  color: var(--el-color-primary);
}

.data-item .file-name {
  font-weight: 500;
  word-break: break-all;
  flex: 1;
}

.data-item .review-percent {
  font-size: 14px;
  margin-left: 20px;
  white-space: nowrap;
}

.dialog-footer {
  text-align: right;
}
</style>