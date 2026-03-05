<template>
  <el-dialog
    v-model="trackPlayer.openDefectConfirm"
    :title="trackPlayer.defectData.defectId ? '编辑缺陷' : '确认缺陷'"
    width="800px"
    :align-center="true"
    :before-close="handleClose"
    draggable
    :modal="true"
  >
    <el-form ref="form" :model="formData" label-width="120px" :rules="rules" label-position="right">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="线路名称：" prop="lineId">
            <el-select disabled="disabled" v-model="formData.lineId" placeholder="请选择" :append-to="fullScreenElement">
              <el-option v-for="item in lineNameList" :key="item.id" :value="item.id" :label="item.lineName"></el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="线路行别：" prop="lineDirection">
            <el-select disabled="disabled" v-model="formData.lineDirection" placeholder="请选择" :append-to="fullScreenElement">
              <el-option v-for="item in lineDirectionList" :key="item.value" :value="item.value" :label="item.label"></el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="里程：" prop="km">
            <el-input v-model="formData.km" placeholder="请输入" />
          </el-form-item>
        </el-col>
        <!-- <el-col :span="12">
          <el-form-item label="负责车间：" prop="deptId">
            <el-cascader :append-to="fullScreenElement" v-model="formData.deptId" :options="deptList" :show-all-levels="false" :props="props1" clearable style="width: 100%;"/>
          </el-form-item>
        </el-col> -->
        <el-col :span="12">
          <el-form-item label="缺陷类型：" prop="defectType">
            <el-select
              v-model="formData.defectType"
              placeholder="请输入"
              style="width: 100%"
              :append-to="fullScreenElement"
            >
              <el-option
                v-for="item in defectTypeList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="缺陷等级：" prop="defectLevel">
            <el-select v-model="formData.defectLevel" placeholder="请选择" :append-to="fullScreenElement">
              <el-option
                v-for="item in levelList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="股道：" prop="track">
            <el-select v-model="formData.track" placeholder="请选择" :append-to="fullScreenElement">
              <el-option
                v-for="item in trackList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="缺陷描述：" prop="defectDesc">
            <el-input v-model="formData.defectDesc" type="textarea" :rows="2" placeholder="请输入" />
          </el-form-item>
        </el-col>
        <!-- <el-col :span="12">
          <el-form-item label="额外参数：" prop="extraParam">
            <el-input v-model="formData.extraParam" type="textarea" :rows="2" placeholder="请输入" />
          </el-form-item>
        </el-col> -->
        <el-col :span="12">
          <el-form-item label="缺陷状态：" prop="defectStatus">
            <el-select v-model="formData.defectStatus" placeholder="请选择" :append-to="fullScreenElement">
              <el-option
                v-for="item in defectStatusList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="备注信息：" prop="remark">
            <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">确认</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { trackPlayerStore } from '../hooks'
import { addDefectReviewApi, editDefectReviewApi } from '../../../../utils/apis/defectReviewApi'
import { getSysDefectLevelApi, getDefectStatusApi, getSysDefectTypeApi, getSysLineDirectionApi, getSysTrackApi } from '../../../../utils/apis/dict'
import {get_line_name_list_api}  from '../../../../utils/apis/lineManageApi';
import eventBus from '../../../../utils/eventBus';
import { mainDataStore } from '../../../../piniaStore'

const props = defineProps<{
  taskId: number,
  fullScreenElement: HTMLDivElement | null,
  playRef: any
}>()
// 全局数据
const trackPlayer = trackPlayerStore()
const store = mainDataStore()

interface Option {
  label: string;
  value: string | number;
}


const form = ref()
const loading = ref(false)
const initData = {
  lineId: '',
  lineDirection: '',
  defectStatus: '',
  km: '',
  // deptId: '',
  defectType: '',
  defectLevel: '',
  // defectLocation: '',
  defectDesc: '',
  // extraParam: '',
  remark: '',
  track: '',
  defectId: undefined,
}
const formData = ref({
  ...initData
})

// 表单校验规则（可根据实际需求扩展）
const rules = {
  lineId: [{ required: true, message: '请选择线路名称', trigger: 'change' }],
  lineDirection: [{ required: true, message: '请选择线路行别', trigger: 'change' }],
  // stationId: [{ required: true, message: '请选择所在区站', trigger: 'change' }],
  pillarNum: [{ required: true, message: '请输入支柱杆号', trigger: 'blur' }],
  // km: [{ required: true, message: '请输入公里标', trigger: 'blur' }],
  // deptId: [{ required: true, message: '请选择负责车间', trigger: 'change' }],
  defectType: [{ required: true, message: '请选择缺陷类型', trigger: 'blur' }],
  defectLevel: [{ required: true, message: '请选择缺陷等级', trigger: 'change' }],
  defectDesc: [{ required: true, message: '请输入缺陷描述', trigger: 'blur' }],
}

/**
 * 线路名称下拉
 */
 const lineNameList = ref<any[]>([])
const getLineNameList = async () => {
  if (lineNameList.value.length) {
    return;
  }
  let data = {
    params:{
      pageNum:1,
      pageSize:1000
    }
  }
  const res:any = await get_line_name_list_api(data)
  lineNameList.value = res.rows.map((it:any)=>{
    return {
      id: it.lineId,
      lineName: it.lineName
    }
  })
}


// 获取缺陷等级
const levelList = ref<Option[]>([])
const getDefectLevelList = async () => {
  if (levelList.value.length) {
    return;
  }
  const res = await getSysDefectLevelApi()
  if (res.code === 200) {
    levelList.value = res.data.map((item: any) => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }
}

//缺陷类型
const defectTypeList = ref<Option[]>([])
const getDefectTypeList = async () => {
  if (defectTypeList.value.length) {
    return;
  }
  const res = await getSysDefectTypeApi()
  if (res.code === 200) {
    defectTypeList.value = res.data.map((item: any) => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }
}

// 股道
const trackList = ref<Option[]>([])
const getTrackList = async () => {
  if (trackList.value.length) {
    return;
  }
  const res = await getSysTrackApi()
  if (res.code === 200) {
    trackList.value = res.data.map((item: any) => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }
}

// 缺陷状态
const defectStatusList = ref<Option[]>([])
const getDefectStatusList = async () => {
  if (defectStatusList.value.length) {
    return;
  }
  const res = await getDefectStatusApi()
  if (res.code === 200) {
    defectStatusList.value = res.data.map((item: any) => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }
}

// 路线行别
const lineDirectionList = ref<Option[]>([])
const getLineDirectionList = async () => {
  if (lineDirectionList.value.length) {
    return;
  }
  const res = await getSysLineDirectionApi()
  if (res.code === 200) {
    lineDirectionList.value = res.data.map((item: any) => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }
}

// 监听 visible 变化
watch(
  () => trackPlayer.openDefectConfirm,
  (newVal) => {
    if (newVal) {
      form.value?.resetFields() // 重置表单
      const taskData = trackPlayer.taskData
      form.value?.resetFields() // 重置表单
      formData.value = {
        ...initData,
        ...trackPlayer.defectData,
        lineId: trackPlayer.defectData?.lineId || taskData.lineId,
        lineDirection: trackPlayer.defectData?.lineDirection || taskData.lineDirection + '',
        defectStatus: trackPlayer.defectData.defectStatus === undefined ? '' : trackPlayer.defectData.defectStatus + ''
      }
      console.log('>>> formData.value', formData.value)
      getLineNameList()
      getDefectLevelList()
      getDefectTypeList()
      getTrackList()
      getDefectStatusList()
      getLineDirectionList()

    }

  },
)

// 提交表单
const handleSubmit = () => {
  if (loading.value) return // 防止重复提交
  form.value?.validate(async (valid) => {
    if (valid) {
      try {
        loading.value = true
        // const filePath = undefined
        // const originImagePath = undefined
        // const file = formData.value.defectType === trackPlayer.defectData?.defectType ? undefined : window._player?.getDataURL(true, formData.value)
        // const originImage = trackPlayer.defectData?.originImagePath ? undefined : window._player?.getDataURL(false, formData.value)
        const api = formData.value.defectId ? editDefectReviewApi : addDefectReviewApi
        await api({
          ...formData.value,
          // taskId: props.taskId,
          // file,
          // originImage,
          // filePath,
          // originImagePath,
          // deptId: formData.value.deptId?.[formData.value.deptId.length - 1] || '',
        })
        loading.value = false
        eventBus.emit('dr-refresh-list') // 刷新列表
        handleClose()
      } catch (error) {
        loading.value = false
      }
    } else {
    }
  })
}

// 关闭弹窗
const handleClose = () => {
  trackPlayer.openDefectConfirm = false
}
</script>

<style scoped>
.dialog-footer {
  text-align: right;
}
</style>