<template>
  <el-dialog
    v-model="trackPlayer.openShortcut"
    title="快捷键"
    width="640px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="dialog-content" :class="{ editing: isEditing }">
      <!-- 左侧列 -->
      <div class="column">
        <div
          v-for="(label, key) in leftKeys"
          :key="key"
          class="form-group"
        >
          <label>{{ label }}</label>
          <div class="shortcut-display"
          @click="startEdit(key)"
          :class="{ editing: isEditing && editingKey === key, disabled: key === 'deleteDefect' }">{{ displayShortcut(shortcuts[key]) }}</div>
        </div>
      </div>

      <!-- 右侧列 -->
      <div class="column">
        <div
          v-for="(label, key) in rightKeys"
          :key="key"
          class="form-group"
        >
          <label>{{ label }}</label>
          <div class="shortcut-display"
          @click="startEdit(key)"
          :class="{ editing: isEditing && editingKey === key }">{{ displayShortcut(shortcuts[key]) }}</div>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <template #footer>
      <span class="dialog-footer">
        <el-button v-if="!isEditing" @click="enterEditMode">编辑</el-button>
        <template v-else>
          <el-button @click="cancelEdit">取消</el-button>
          <el-button type="primary" @click="saveShortcuts">保存</el-button>
        </template>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { trackPlayerStore } from '../hooks/index'

const trackPlayer = trackPlayerStore()

// 弹窗状态
const isEditing = ref(false)
const editingKey = ref(null)

// ✅ 使用 store 的 shortcuts 作为源数据（响应式）
// 注意：不能直接 = trackPlayer.shortcuts，因为 reactive 会丢失响应性
// 所以我们用 reactive 包裹一份副本，保存时再写回 store
const shortcuts = reactive({ ...trackPlayer.shortcuts })

// 左右列功能标签（用于渲染）
const leftKeys = {
  prevDefect: '上一个缺陷',
  prevFrame: '上一屏',
  confirmDefect: '确认缺陷',
  deleteDefect: '删除缺陷',
  playPause: '播放/暂停',
  toggleInfo: '缺陷信息查看/隐藏',
}

const rightKeys = {
  nextDefect: '下一个缺陷',
  nextFrame: '下一屏',
  addDefect: '新增缺陷',
  jumpFrame: '跳转公里标',
  refresh: '画布复位(平移/缩放)',
  acceleratePlay: '长按加速播放',
}

// 显示处理
const displayShortcut = (val) => {
  if (val === ' ') return '空格'
  if (val === '双击缺陷框') return val
  if (val === 'ArrowRight') return '右方向键'
  if (val === 'ArrowLeft') return '左方向键'
  if (val === 'ArrowUp') return '上方向键'
  if (val === 'ArrowDown') return '下方向键'
  if (!val || val.trim() === '') return '无' // 👈 新增：空值显示“无”
  return val?.toUpperCase() || '无'
}

// 打开弹窗时同步最新 store 数据（可选，但更安全）
const open = () => {
  Object.assign(shortcuts, trackPlayer.shortcuts) // 同步最新值
  trackPlayer.openShortcut = true
}

// 进入编辑模式
const enterEditMode = () => {
  isEditing.value = true
  editingKey.value = null
  ElMessage.closeAll()
  // ElMessage.info('请点击选中要编辑的快捷键进行替换')
  window.addEventListener('keydown', handleKeyDown, true)
}

const cancelEdit = () => {
  isEditing.value = false
  editingKey.value = null
  Object.assign(shortcuts, trackPlayer.shortcuts) // 同步最新值
  window.removeEventListener('keydown', handleKeyDown, true)
}

const startEdit = (key) => {
  if (!isEditing.value) {
    return;
    // enterEditMode()
  }
  if (key === 'deleteDefect') {
    // ElMessage.closeAll()
    // ElMessage.warning('该快捷键无法修改')
    return;
  }
  editingKey.value = key
}

const handleKeyDown = (e) => {
  if (!editingKey.value) return
  e.preventDefault()
  e.stopPropagation()

  // 如果按的是 Delete 或 Backspace，直接清空
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (shortcuts[editingKey.value]) {
      shortcuts[editingKey.value] = '' // 设为空字符串
      editingKey.value = null
      ElMessage.closeAll()
      ElMessage.success('快捷键已清除')
    }
    return
  }

  let keyName = ''
  if (e.code === 'Space') {
    keyName = ' '
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    // 支持方向键
    keyName = e.key
  } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    keyName = e.key.toUpperCase()
  } else {
    ElMessage.closeAll()
    ElMessage.warning('仅支持字母、数字、方向键、空格，或按 Delete/Backspace 清除')
    return
  }

  shortcuts[editingKey.value] = keyName
  editingKey.value = null
}

// 保存到 store
const saveShortcuts = () => {
  const keyMap = new Map()
  const conflicts = []

  for (const [key, val] of Object.entries(shortcuts)) {
    // 跳过特殊项和空值
    if (val === '双击缺陷框' || !val || val.trim() === '') {
      continue
    }

    if (keyMap.has(val)) {
      if (!conflicts.includes(keyMap.get(val))) {
        conflicts.push(keyMap.get(val))
      }
      conflicts.push(key)
    } else {
      keyMap.set(val, key)
    }
  }

  if (conflicts.length > 0) {
    const labels = [...new Set(conflicts)].map(k => leftKeys[k] || rightKeys[k] || k).join('、')
    ElMessage.closeAll()
    ElMessage.error(`快捷键冲突：${labels} 的快捷键重复了`)
    return
  }

  trackPlayer.shortcuts = { ...shortcuts }
  ElMessage.success('快捷键保存成功')
  cancelEdit()
  handleClose()
}

const handleClose = () => {
  isEditing.value = false
  trackPlayer.openShortcut = false
}

// 清理监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true)
})

defineExpose({
  open,
})
</script>

<style scoped>
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
  /* color: #555; */
  margin-bottom: 6px;
  font-weight: 500;
}

.shortcut-display {
  padding: 6px 12px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  text-align: center;
  min-height: 32px;
  line-height: 1.4;
  font-family: monospace;
  font-size: 14px;
}
.editing .shortcut-display:not(.editing):not(.disabled) {
  background-color: var(--el-bg-color-overlay);
}
.shortcut-display.editing {
  background-color: var(--el-color-success-light-9);
  border: 1px dashed var(--el-color-success);
}
</style>