<template>
    <div class="player-box" ref="fullScreenRef">
      <PlayView ref="playRef" />
      <PlayControl :fullScreenElement="fullScreenRef" />
      <DefectConfirmDialog :fullScreenElement="fullScreenRef" :playRef="playRef" :taskId="taskId" />
      <DefectDeleteDialog :playRef="playRef" :taskId="taskId" />
      <ShortcutDialog />
      <HistoryDialog />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import DefectConfirmDialog from './dialog/defectConfirmDialog.vue';
import DefectDeleteDialog from './dialog/defectDeleteDialog.vue';
import ShortcutDialog from './dialog/ShortcutDialog.vue';
import HistoryDialog from './dialog/HistoryDialog.vue';
import PlayControl from './PlayControl.vue';
import PlayView from './PlayView.vue';
import { trackPlayerStore } from './hooks';
import { updateCheckDurationApi } from '../../../utils/apis/taskManageApi'

const props = defineProps<{
  taskId: number,
}>()

// 全局数据
const trackPlayer = window._playerData = trackPlayerStore();

const fullScreenRef = ref()

const playRef = ref()

let timer

function updateStayDuration() {
  // timer = setInterval(() => {
  //   if (!trackPlayer.taskData?.id) return;
  //   updateCheckDurationApi({
  //     taskId: trackPlayer.taskData.id,
  //     stayDuration: 5
  //   });
  // }, 5000);
}

onMounted(() => {
  updateStayDuration()
  window._player = playRef.value?.player
});

onUnmounted(() => {
  clearInterval(timer);
  window._player = undefined
})

</script>

<style scoped lang="less">
.player-box {
  width: 100%;
  height: 100%;
  background-color: #000;
  position: relative;
  ::v-deep .play-state {
    opacity: 0;
  }
   &:hover ::v-deep {
    .play-state {
      opacity: 1;
    }
  }
  
}
</style>