<template>
  <!-- <div class="play-state" v-if="!trackPlayer.isAdd">
    <div class="control-btn play-state-btn" :class="{'hide': trackPlayer.isPlaying}" @click="onClickBtn('play')"></div>
  </div> -->
  <div class="tool-control" v-if="trackPlayer.showFixedTool">
    <div class="control-btn-box">
      <el-tooltip
        effect="dark"
        :disabled="trackPlayer.showTool"
        content="工具"
        placement="bottom"
        :append-to="appendToEl"
      >
        <div class="control-btn tool-btn" @click="onClickBtn('tool-open')"></div>
      </el-tooltip>
      <div class="control-btn-hover" style="right: 44px; top: 0px;" v-if="trackPlayer.showTool">
        <ToolHover :hideTool="true" />
      </div>
    </div>
  </div>
  <div class="right-control">
    <div class="slider-control">
      <template v-if="isFullScreen">
        <el-tooltip
          effect="dark"
          :content="closedControl ? '展开' : '收起'"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn closeed-btn" :class="{'closeed': closedControl}" @click="onClickBtn('closeed')"></div>
        </el-tooltip>
      </template>
      <div class="slider-tips" v-show="timeTips.show" :style="timeTipsStyle">{{ timeTips.time }}</div>
      <div class="used-rate" :class="{'full-screen': isFullScreen}">
        <div class="used-rate-bar" :style="{width: usedRate + '%'}"></div>
      </div>
      <el-slider 
        class="my-slider" 
        :step="0.001"
        :show-tooltip="false" 
        v-model="rate" 
        @change="onPlayTo" 
        @input="onPlayInput" 
        @mousemove.native="mousemoveSlider"
        @mouseleave.native="timeTips.show = false"
        :marks="marks"
      />
      <div class="file-name">{{ fileName }}</div>
      <div class="play-time">{{ timeStr }}/{{ durationStr }}</div>
    </div>
    <div v-if="!closedControl" class="bottom-control">
      <div class="bottom-control-item bottom-control-1">
        <div class="control-btn-box">
          <el-tooltip
            effect="dark"
            :disabled="trackPlayer.showMode"
            content="模式切换"
            placement="top"
            :append-to="appendToEl"
          >
            <div class="control-btn" @click="onClickBtn('mode-open')">
              <el-icon><SetUp /></el-icon>
            </div>
          </el-tooltip>
          <div class="control-btn-hover" style="left: 0; bottom: 44px;" v-show="trackPlayer.showMode">
            <ModeHover />
          </div>
        </div>
        <div class="control-btn-box">
          <el-tooltip
            effect="dark"
            :disabled="trackPlayer.showTrack"
            content="轨道数据"
            placement="top"
            :append-to="appendToEl"
          >
            <div class="control-btn filter-btn" @click="onClickBtn('track-open')"></div>
          </el-tooltip>
          <div class="control-btn-hover" style="left: 0; bottom: 44px;" v-show="trackPlayer.showTrack">
            <TrackHover />
          </div>
        </div>
        <div class="control-btn-box">
          <el-tooltip
            effect="dark"
            :disabled="trackPlayer.showSetting"
            content="设置"
            placement="top"
            :append-to="appendToEl"
          >
            <div class="control-btn setting-btn" @click="onClickBtn('setting-open')"></div>
          </el-tooltip>
          <div class="control-btn-hover" style="left: 0; bottom: 44px;" v-if="trackPlayer.showSetting">
            <ToolHover />
          </div>
        </div>
        <div class="control-btn-box">
          <el-tooltip
            effect="dark"
            :disabled="trackPlayer.showSpeed"
            content="速度"
            placement="top"
            :append-to="appendToEl"
          >
            <div class="control-btn speed-btn" @click="onClickBtn('speed-open')"></div>
          </el-tooltip>
          <div class="control-btn-hover" style="left: 0; bottom: 44px;" v-if="trackPlayer.showSpeed">
            <SpeedHover />
          </div>
        </div>
      </div>
      <div class="bottom-control-item bottom-control-2">
        <el-tooltip
          effect="dark"
          content="快退"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn prev-btn" @click="onClickBtn('prev')"></div>
        </el-tooltip>
        <template v-if="!trackPlayer.isPlaying">
          <el-tooltip
            effect="dark"
            content="播放"
            placement="top"
            :append-to="appendToEl"
          >
            <div class="control-btn play-btn" @click="onClickBtn('play')"></div>
          </el-tooltip>
        </template>
        <template v-else>
        <el-tooltip
          effect="dark"
          content="暂停"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn pause-btn" @click="onClickBtn('pause')"></div>
        </el-tooltip>
        </template>
        <el-tooltip
          effect="dark"
          content="快进"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn next-btn" @click="onClickBtn('next')"></div>
        </el-tooltip>
      </div>
      <div class="bottom-control-item bottom-control-3">
        <!-- <el-tooltip
          effect="dark"
          :content="(!trackPlayer.showDefect ? '显示' : '隐藏') + '缺陷'"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn" @click="onClickBtn('show-defect')">
            <el-icon color="#ffffffee" v-if="trackPlayer.showDefect"><View /></el-icon>
            <el-icon color="#ffffffee" v-else><Hide /></el-icon>
          </div>
        </el-tooltip> -->
        <el-tooltip
          effect="dark"
          content="查看历史"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn" @click="onClickBtn('history')">
            <el-icon><Clock /></el-icon>
          </div>
        </el-tooltip>
        <el-tooltip
          effect="dark"
          content="新增缺陷"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn confirmDefect-btn" :class="{'active': trackPlayer.isAdd}" @click="onClickBtn('defect-confirm-open')"></div>
        </el-tooltip>
        <el-tooltip
          effect="dark"
          :content="trackPlayer.download ? '下载中...' : '下载'"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn download-btn" :class="{'downloading': trackPlayer.download}" @click="onClickBtn('download')"></div>
        </el-tooltip>
        <!-- <template v-if="!isFullScreen">
        <el-tooltip
          effect="dark"
          content="全屏"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn fullScreen-btn" @click="onClickBtn('fullScreen')"></div>
        </el-tooltip>
        </template>
        <template v-else>
        <el-tooltip
          effect="dark"
          content="退出全屏"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn fullScreenShrink-btn" @click="onClickBtn('fullScreenShrink')"></div>
        </el-tooltip>
        </template> -->
        <el-tooltip
          effect="dark"
          content="帮助"
          placement="top"
          :append-to="appendToEl"
        >
          <div class="control-btn help-btn" @click="onClickBtn('help-open')"></div>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { fromSeconds } from '../player/utils';
import { trackPlayerStore } from './hooks';
import SpeedHover from './dialog/speedHover.vue';
import ToolHover from './dialog/toolHover.vue';
import ModeHover from './dialog/modeHover.vue';
import TrackHover from './dialog/trackHover.vue';
import { updateCheckDurationApi } from '../../../utils/apis/taskManageApi'
import eventBus from '../../../utils/eventBus';


const props = defineProps<{
  fullScreenElement: HTMLDivElement | null;
}>();

// 全局数据
const trackPlayer = trackPlayerStore();

// 临时变量不需要持久化
const isFullScreen = ref(false);
const closedControl = ref(false);
const rate = ref(1);
const timeStr = ref('00:00:00');
// 时间提示
const timeTips = reactive({
  show: false,
  time: '00:00:00',
  left: 0,
  x: 0,
});
// 标记
const marks = computed(() => {
  const marks = {}
  // console.log('>>> marks', marks)
  return marks
})
const timeTipsStyle = computed(() => {
  return {
    left: `${timeTips.x}px`,
  }
})
// 临时变量
let _playTime = -1;

// 挂载元素
const appendToEl = computed(() => {
  if (isFullScreen.value) {
    return props.fullScreenElement;
  }
  return null;
})
// 播放时间字符串
const durationStr = computed(() => {
  return fromSeconds(0);
})
// 当前文件名
const fileName = computed(() => {
  return ''
})

// 点击按钮
function onClickBtn(type: string) {
  console.log('>>> type', type)
  switch (type) {
    case 'mode-open':
      if (!trackPlayer.showMode) {
        setTimeout(() => {
          trackPlayer.showMode = true;
        }, 0);
      }
      addListener();
      break;
    case 'track-open':
      if (!trackPlayer.showTrack) {
        setTimeout(() => {
          trackPlayer.showTrack = true;
        }, 0);
      }
      addListener();
      break;
    case 'help-open':
      trackPlayer.openShortcut = true;
      break;
    case 'setting-open':
      if (!trackPlayer.showSetting) {
        setTimeout(() => {
          trackPlayer.showSetting = true;
        }, 0);
      }
      addListener();
      break;
    case 'tool-open':
      if (!trackPlayer.showTool) {
        setTimeout(() => {
          trackPlayer.showTool = true;
        }, 0);
      }
      addListener();
      break;
    case 'defect-confirm-open':
      trackPlayer.isPlaying = false
      trackPlayer.isAdd = !trackPlayer.isAdd;
      break;
    case 'speed-open':
      if (!trackPlayer.showSpeed) {
        setTimeout(() => {
          trackPlayer.showSpeed = true;
        }, 0);
      }
      addListener();
      break;
    case 'fullScreen':
    case 'fullScreenShrink':
      fullScreen();
      break;
    case 'closeed':
      closedControl.value = !closedControl.value;
      break;
    case 'history':
    trackPlayer.openHistory = !trackPlayer.openHistory;
      break;
    case 'download':
      if (trackPlayer.download) {
        return;
      }
      break;
    case 'play':
      trackPlayer.isPlaying = true;
      trackPlayer.isAdd = false;
      break;
    case 'pause':
      trackPlayer.isPlaying = false;
      break;
    case 'next':
      break;
    case 'prev':
      break;
    case 'show-defect':
      trackPlayer.showDefect = !trackPlayer.showDefect;
      break;
    default:
      break;
  }
}

function addListener() {
  setTimeout(() => {
    document.addEventListener('click', onClose);
  }, 0);
}

function onClose(event: any) {
  let targetElement = event.target;
  let controlBtnHoverAncestor = targetElement.closest('.control-btn-hover');
  if (controlBtnHoverAncestor) {
    return;
  }
  trackPlayer.showTrack = false;
  trackPlayer.showMode = false;
  trackPlayer.showSetting = false;
  trackPlayer.showTool = false;
  trackPlayer.showSpeed = false;
  document.removeEventListener('click', onClose);
}

const usedRate = computed(() => {
  return 0
})

// 拖拽结束
function onPlayTo() {
  
}

// 拖拽响应修改时间
function onPlayInput(value: number) {
  
}

// 全屏 & 退出全屏
function fullScreen() {
  if (!isFullScreen.value) {
    if (props.fullScreenElement) {
      let docm = props.fullScreenElement
      if (docm.requestFullscreen) {
        docm.requestFullscreen();
      }
      document.onfullscreenchange = () => {
        isFullScreen.value = !isFullScreen.value
        closedControl.value = false
      }
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// 更新复核进度
function updateCheckDuration() {
  //   eventBus.emit('dr-refresh-task-list');
  //   updateCheckDurationApi({
  //     taskId: trackPlayer.taskData.id,
  //     checkDuration
  //   })
}

// 鼠标移动到进度条上
function mousemoveSlider(event) {
  if (event.target.className === 'el-slider__runway' || event.target.className === 'el-slider__bar') {
    timeTips.show = false;
  } else if (event.target?.classList?.contains('el-slider__marks-stop')) {
    const width = event.target.closest('.my-slider')?.getBoundingClientRect()?.width || 0
    const rate = parseFloat(event.target.style.left)
    timeTips.left = rate;
    timeTips.time = fromSeconds(0);
    timeTips.x = rate / 100 * width - 20; // 调整位置
    timeTips.show = true;
  } else {
    timeTips.show = false;
  }
}

</script>

<style scoped lang="less">
.control-btn-box {
  position: relative;
  .control-btn-hover {
    position: absolute;
    z-index: 999;
  }
}
.control-btn {
  width: 34px;
  height: 34px;
  line-height: 40px;
  text-align: center;
  background: no-repeat center center / 18px 18px;
  cursor: pointer;
  color: #fff;
  // opacity: 0.8;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
    // opacity: 1;
  }

  &.filter-btn {
    background-image: url(./assets/filter-btn.png);
  }
  &.setting-btn {
    background-image: url(./assets/setting-btn.png);
  }
  &.speed-btn {
    background-image: url(./assets/speed-btn.png);
  }
  &.prev-btn {
    background-image: url(./assets/prev-btn.png);
  }
  &.play-btn {
    background-image: url(./assets/play-btn.png);
  }
  &.pause-btn {
    background-image: url(./assets/pause-btn.png);
  }
  &.next-btn {
    background-image: url(./assets/next-btn.png);
  }
  &.preview-btn {
    background-image: url(./assets/preview-btn.png);
  }
  &.confirmDefect-btn {
    background-image: url(./assets/confirm-defect-btn.png);
  }
  &.download-btn {
    background-image: url(./assets/download-btn.png);
  }
  &.fullScreen-btn {
    background-image: url(./assets/full-screen-btn.png);
  }
  &.fullScreenShrink-btn {
    background-image: url(./assets/full-screen-shrink-btn.png);
  }
  &.help-btn {
    background-image: url(./assets/more-btn.png);
  }
  &.tool-btn {
    background-image: url(./assets/tool-btn.png);
  }
  &.play-state-btn {
    background: url(./assets/play-state-btn.png) no-repeat center center / 28px 28px;
  }
  &.closeed-btn {
    background-image: url(./assets/closeed-btn.png);
    transform: rotate(180deg);
    &.closeed {
      transform: rotate(0deg);
    }
  }
  &.active {
    background-color: rgba(64, 158, 255, 0.4);
  }
  &.downloading {
    background: url(./assets/loading.gif) no-repeat center center / 28px 28px;
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
  .play-state-btn {
    pointer-events: auto;
    opacity: 1;
    transform: scale(1);
    transition: all 0s ease-in-out;
    &.hide {
      opacity: 0;
      pointer-events: none;
      transform: scale(2);
      transition: all 0.3s ease-in-out;
    }
  }
}

.tool-control {
  position: absolute;
  right: 25px;
  top: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider-control {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 8px;
  position: relative;
  pointer-events: auto;

  .my-slider {
    flex: 1;
    --el-slider-height: 4px;
    --el-slider-button-size: 12px;
    --el-slider-button-wrapper-offset: -16px;
    // --el-slider-button-wrapper-size: 
  }

  .used-rate {
    height: 4px;
    position: absolute;
    left: 8px;
    right: 8px;
    top: 22px;
    pointer-events: none;
    &.full-screen {
      left: 50px;
    }
    .used-rate-bar {
      height: 100%;
      background-color: var(--el-color-primary);
      opacity: 0.5;
      border-radius: 2px;
      width: 0%;
    }
  }

  ::v-deep {
    .el-slider__bar {
      background-color: transparent;
    }
    .el-slider__runway {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .el-slider__button {
      background-color: var(--el-slider-main-bg-color);
      // background-color: #4086FF;
    }
    .el-slider__stop {
      background-color: red
    }
  }

  .file-name {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    position: absolute;
    left: 8px;
    top: 30px;
    max-width: calc(100% - 160px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .play-time {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    position: absolute;
    right: 8px;
    top: 30px;
  }

  .slider-tips {
    color: rgba(255, 255, 255, 0.8);
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 0px;
    font-size: 12px;
    position: absolute;
    padding: 0 4px;
    left: 0px;
    top: 0px;
  }

}

.right-control {
  width: 100%;
  position: absolute;
  left: 0;
  bottom: 0;
  padding: 8px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 100%);
  pointer-events: none;

  .bottom-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    pointer-events: auto;

    .bottom-control-item {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 33.33%;
      column-gap: 8px;

      &.bottom-control-1 {
        justify-content: flex-start;
      }
      
      &.bottom-control-3 {
        justify-content: flex-end;
      }

    }
  }
}
</style>