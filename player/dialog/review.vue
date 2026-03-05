<template>
  <template v-if="state.open">
    <div class="pic-mask"></div>
    <div class="pic">
      <template v-if="state.defectImgList?.length">
        <div class="prev-btn review-btn" @click="prevImg">
          <el-icon><ArrowLeftBold /></el-icon>
        </div>
        <div class="next-btn review-btn" @click="nextImg">
          <el-icon><ArrowRightBold /></el-icon>
        </div>
      </template>
      <div title="关闭" class="icon" @click="hiddenImg">
        <el-icon>
          <Close />
        </el-icon>
      </div>
      <ImgEdit :imgInfo="imgInfo" :dwqAngleDTOS="dwqAngleDTOS" :defectPosList="defectPosList" class="img" />
    </div>
  </template>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import ImgEdit from '../../../imgEdit/imgEdit.vue'
import { EFileType } from '../../../../utils/tsApis/defectReviewApi';
import { success } from '../../../../utils/news/news';


const state = reactive({
  open: false,
  data: {} as any,
  /**
   * 缺陷图片列表
   */
  defectImgList: [] as any[],
  currentIndex: 0,
})

const imgInfo = computed(() => {
  return {
    nginxPath: state.data.imgUrl,
  }
})

const defectPosList = computed(() => {
  let list: any = []
  return list
})

const dwqAngleDTOS = computed(() => {
  let list: any = []
  return list
})

const hiddenImg = () => {
  state.open = false
}
const prevImg = () => {
  if (state.currentIndex <= 0) {
    success('已经是第一张缺陷图')
    return;
  }
  state.currentIndex--;
  state.data = state.defectImgList[state.currentIndex]
}
const nextImg = () => {
  if (state.currentIndex >= state.defectImgList.length - 1) {
    success('已经是最后一张缺陷图')
    return;
  }
  state.currentIndex++;
  state.data = state.defectImgList[state.currentIndex]
}
const openDialog = (data: any, defectImgList: any[]) => {
  state.data = {
    ...data
  }
  state.open = true
  if (defectImgList?.length) {
    state.defectImgList = defectImgList;
    const index = defectImgList.findIndex(el => el.id === data.id)
    if (index > -1) {
      state.currentIndex = index
    } else {
      state.currentIndex = 0
    }
  } else {
    state.defectImgList = [];
    state.currentIndex = 0;
  }
}

function listenerKeyEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      hiddenImg()
    }
  }

onMounted(() => { 
  document.addEventListener('keydown', listenerKeyEvent);
})

onUnmounted(() => {
  document.removeEventListener('keydown', listenerKeyEvent);
})

defineExpose({
  openDialog
})
</script>

<style scoped lang="less">
.pic-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 9998;
}

.pic {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  top: 50%;
  left: 50%;
  width: 75%;
  height: 75%;
  transform: translate(-50%, -50%);
  z-index: 999999;
  background-color: #000;

  >.img {
    position: absolute;
    top: 0;
    left: 0;
    min-width: 100%;
    min-height: 100%;
  }

  >.icon {
    position: absolute;
    background: #797979;
    top: 5px;
    right: 6px;
    z-index: 100;
    text-align: center;
    width: 24px;
    height: 24px;
    cursor: pointer;
  }

  >.icon2 {
    position: absolute;
    top: 40%;
    left: 2%;
    width: 5%;
    z-index: 100;
    cursor: pointer;
  }

  >.icon3 {
    position: absolute;
    top: 40%;
    right: 0;
    width: 5%;
    z-index: 100;
    cursor: pointer;
  }

  .prev-btn {
    left: 4px;
  }
  .next-btn {
    right: 4px;
  }
  .review-btn {
    cursor: pointer;
    position: absolute;
    background-color: #79797966;
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    padding: 8px;
    border-radius: 50%;
    top: 50%;
    transform: translateY(-50%);
    z-index: 9;
    transition-duration: .3s;
    &:hover {
      background-color: #797979;
    }
  }

}
</style>