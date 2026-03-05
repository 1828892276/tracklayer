<template>
  <div class="dialog-content">
    
    <!-- 探头状态表格 -->
    <div class="probe-status">
      <div class="p-title">探头状态</div>
      <!-- 轨道选择区 -->
      <div class="track-selection">
        <el-checkbox
          v-model="allChecked"
          :indeterminate="isIndeterminate"
          @change="handleCheckAllChange"
          class="check-all"
        >
          全选
        </el-checkbox>
        <el-checkbox-group v-model="checkedTracks" @change="handleCheckedTracksChange" class="track-checkbox-group">
          <el-checkbox
            v-for="(color, index) in trackPlayer.COLORS"
            :key="index"
            :value="String.fromCharCode(65 + index)"
            :label="String.fromCharCode(65 + index)"
            :style="{ '--track-color': color }"
            class="track-checkbox"
          >
            {{ String.fromCharCode(65 + index) }}
            <span class="track-color-indicator"></span>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <el-table class="my-table" :data="transposedProbeData" stripe style="width: 100%" border >
        <el-table-column prop="property" label="属性">
          <template #default="{ row }">
            {{ probeLabels[row.property] }}
          </template>
        </el-table-column>
        <el-table-column 
          v-for="channel in channels" 
          :key="channel"
          :prop="channel" 
          :label="channel"
          width="60"
          >
          <template #default="{ row }">
            <span :class="row[channel] && row[channel].value < 20 && row.property === 'grassWave' ? 'red-text' : ''">
              {{ row[channel] ? row[channel].value : '' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- 作业参数表格 -->
    <div class="operation-params">
      <div class="p-title">作业参数</div>
      <el-table class="my-table" :data="operationData" stripe style="width: 100%" border >
        <el-table-column prop="time" label="时间" ></el-table-column>
        <el-table-column prop="operator" label="执机人"></el-table-column>
        <el-table-column prop="direction" label="行别" width="70"></el-table-column>
        <el-table-column prop="railSide" label="股别" width="70"></el-table-column>
        <el-table-column prop="fieldNo" label="场号" width="70"></el-table-column>
        <el-table-column prop="trackNo" label="股道号" width="70"></el-table-column>
        <el-table-column prop="railId" label="铁号" width="70"></el-table-column>
        <el-table-column prop="lineName" label="线名" ></el-table-column>
      </el-table>
    </div>
    
    <!-- 仪器设置表格 -->
    <div class="instrument-settings">
      <div class="p-title">仪器设置</div>
      <el-table class="my-table" :data="instrumentData" stripe style="width: 100%" border >
        <el-table-column prop="reflectionAlarm" label="反射报警" >
          <template #default="{ row }">
            {{ row.reflectionAlarm }}
          </template>
        </el-table-column>
        <el-table-column prop="penetrationAlarm" label="穿透报警" >
          <template #default="{ row }">
            {{ row.penetrationAlarm }}
          </template>
        </el-table-column>
        <el-table-column prop="lossDetection" label="失捡" >
          <template #default="{ row }">
            {{ row.lossDetection }}
          </template>
        </el-table-column>
        <el-table-column prop="mode" label="手/自" >
          <template #default="{ row }">
            {{ row.mode }}
          </template>
        </el-table-column>
        <el-table-column prop="railType" label="轨型" >
          <template #default="{ row }">
            {{ row.railType }}
          </template>
        </el-table-column>
        <el-table-column prop="suppression" label="抑/通" >
          <template #default="{ row }">
            {{ row.suppression }}
          </template>
        </el-table-column>
        <el-table-column prop="voltage" label="电压" >
          <template #default="{ row }">
            {{ row.voltage }}
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- GPS信息模块 -->
    <div class="gps-info">
      <div class="p-title">GPS信息</div>
      <div class="gps-content">
        <span>经度{{ gpsData.longitude }}</span>
        <span>纬度{{ gpsData.latitude }}</span>
        <span>记录号：{{ gpsData.recordNum }}</span>
        <span>复位模式：{{ gpsData.resetMode }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { trackPlayerStore } from '../hooks'

// 全局数据
const trackPlayer = trackPlayerStore()

// 轨道选择相关数据
const allChecked = computed({
  get: () => trackPlayer.checkedTracks.length === trackPlayer.COLORS.length,
  set: (value: boolean) => {
    if (value) {
      trackPlayer.checkedTracks = trackPlayer.COLORS.map((_, index) => String.fromCharCode(65 + index));
    } else {
      trackPlayer.checkedTracks = [];
    }
  }
});

const checkedTracks = computed({
  get: () => trackPlayer.checkedTracks,
  set: (value: string[]) => {
    trackPlayer.checkedTracks = value;
  }
});

const isIndeterminate = computed(() => {
  return trackPlayer.checkedTracks.length > 0 && trackPlayer.checkedTracks.length < trackPlayer.COLORS.length;
});

// 探头状态表格数据
const probeData = ref([
  { channel: 'A前外', gain: 45, integration: 98, grassWave: 18 },
  { channel: 'B后内', gain: 52, integration: 102, grassWave: 22 },
  { channel: 'C前内', gain: 38, integration: 95, grassWave: 15 },
  { channel: 'D后外', gain: 60, integration: 105, grassWave: 25 },
  { channel: 'E前', gain: 48, integration: 99, grassWave: 19 },
  { channel: 'F后', gain: 55, integration: 101, grassWave: 21 },
  { channel: 'G前', gain: 42, integration: 97, grassWave: 17 },
  { channel: 'H后', gain: 58, integration: 103, grassWave: 23 },
  { channel: 'I 0*', gain: 50, integration: 100, grassWave: 20 }
])

const probeLabels = {
  gain: '增益',
  integration: '积分',
  grassWave: '草波状%'
}

// 通道名称
const channels = computed(() => probeData.value.map(item => item.channel))

// 转置后的探头状态数据
const transposedProbeData = computed(() => {
  if (!probeData.value || probeData.value.length === 0) return []
  
  // 获取除 channel 外的所有属性名
  const properties = Object.keys(probeData.value[0]).filter(key => key !== 'channel')
  
  // 为每个属性创建一行
  return properties.map(property => {
    const row: any = { property }
    
    // 为每一列（通道）添加数据
    probeData.value.forEach(item => {
      const channel = item.channel
      row[channel] = { value: item[property as keyof typeof item] }
    })
    
    return row
  })
})

// 作业参数表格数据
const operationData = ref([{
  time: '10:30:15',
  operator: '012',
  direction: '上行',
  railSide: '左股',
  fieldNo: '场1',
  trackNo: '道1',
  railId: '铁1',
  lineName: '京沪线'
}])

// 仪器设置表格数据
const instrumentData = ref([{
  reflectionAlarm: '开',
  penetrationAlarm: '开',
  lossDetection: '开',
  mode: '手动',
  railType: '50',
  suppression: '模拟20%',
  voltage: '24V'
}])

// GPS信息数据
const gpsData = ref({
  longitude: '118°12′36″',
  latitude: '31°45′23″',
  recordNum: '14/300',
  resetMode: '4'
})

// 全选/反选功能
const handleCheckAllChange = (val: boolean) => {
  const trackLetters = trackPlayer.COLORS.map((_, index) => String.fromCharCode(65 + index))
  trackPlayer.checkedTracks = val ? [...trackLetters] : []
}

// 选择轨道变化
const handleCheckedTracksChange = (value: string[]) => {
  trackPlayer.checkedTracks = value;
}

onMounted(() => {
  // 初始化时如果checkedTracks为空，则选中所有轨道
  if (trackPlayer.checkedTracks.length === 0) {
    const trackLetters = trackPlayer.COLORS.map((_, index) => String.fromCharCode(65 + index))
    trackPlayer.checkedTracks = [...trackLetters]
  }
})

onUnmounted(() => {
})

</script>

<style scoped lang="less">
.dialog-content {
  padding: 10px;
  width: 640px;
  min-height: 200px;
  background-color: var(--el-bg-color);
  font-size: 14px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  color: var(--el-text-color-regular);
}

.track-selection {
  // margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  :deep(.el-checkbox) {
    margin-right: 10px;
  }
  :deep(.el-checkbox__label) {
    padding-left: 2px;
  }
}

.check-all {
  // margin-right: 4px;
}

.track-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.track-checkbox {
  display: flex;
  align-items: center;
}

.track-color-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-color: var(--track-color);
}

.probe-status,
.operation-params,
.instrument-settings {
  margin-bottom: 20px;
}

.red-text {
  color: red;
}

.gps-info {
  margin-bottom: 10px;
}

.p-title {
  font-size: 14px;
  font-weight: bold;
}

.gps-content {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  // padding: 0 4px;
}

.gps-content span {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

.my-table :deep(.el-table__cell) {
  padding: 2px 0;
}

.my-table :deep(.cell) {
  padding: 0 4px;
  text-align: center;
}

</style>