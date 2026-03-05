import { defineStore } from 'pinia'

// 缺陷数据接口
export interface DefectData {
  id: string;
  x1: number;          // 开始距离 (mm)
  y1: number;          // 开始反射值 (mm)
  x2: number;          // 结束距离 (mm)
  y2: number;          // 结束反射值 (mm)
  type: string;        // 缺陷类型
  note: string;        // 备注
  channel: number;     // 通道号
}

// 轨道探伤原始数据格式
export interface TrackInspectionData {
  /** 公里标标记点数组 */
  kmFlags: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
    meter: number;    // 公里标数值
    time: string;     // 时间戳
  }>;

  /** 起始X坐标 */
  startX: number;

  /** 结束X坐标 */
  stopX: number;

  /** 通道1数据 */
  usw1: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道2数据 */
  usw2: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道3数据 */
  usw3: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道4数据 */
  usw4: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道5数据 */
  usw5: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道6数据 */
  usw6: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道7数据 */
  usw7: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道8数据 */
  usw8: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 通道9数据 */
  usw9: Array<{
    x: number;        // x坐标
    y: number;        // y坐标
  }>;

  /** 窗口配置信息 */
  wins: Array<{
    width: number;                    // 窗口宽度
    height: number;                   // 窗口高度
    auxiliaryLineYScales: number[];   // 辅助线Y轴比例
    bottomLineYScale: number;         // 底线Y轴比例
    minX: number;                     // 最小X值
    maxX: number;                     // 最大X值
    yscales: number[];                // Y轴比例数组
    trackHeight?: number;              // 钢轨高度
  }>;
}


/**
 * 快捷键语义化操作映射表（用于将物理按键映射到业务逻辑动作）
 *
 * 该常量定义了系统中所有支持快捷键触发的**逻辑操作名称（语义标识）**，
 * 每个键（如 ADD_DEFECT）是一个稳定的常量名，值（如 'addDefect'）是用于
 * 在配置、存储或事件分发中使用的字符串标识。
 *
 * 使用此映射可实现：
 * - 快捷键完全可配置（用户可修改绑定的物理键）
 * - 业务逻辑与具体按键解耦
 * - 支持未来扩展（如语音、手势等输入方式复用同一语义）
 */
export const SHORTCUT_ACTIONS = {
  /**
   * 新增缺陷
   */
  ADD_DEFECT: 'addDefect',

  /**
   * 下一个缺陷
   */
  NEXT_DEFECT: 'nextDefect',

  /**
   * 上一个缺陷
   */
  PREV_DEFECT: 'prevDefect',

  /**
   * 确认缺陷
   */
  CONFIRM_DEFECT: 'confirmDefect',

  /**
   * 删除缺陷
   */
  DELETE_DEFECT: 'deleteDefect',

  /**
   * 下一屏
   */
  NEXT_FRAME: 'nextFrame',

  /**
   * 上一屏
   */
  PREV_FRAME: 'prevFrame',

  /**
   * 播放/暂停
   */
  PLAY_PAUSE: 'playPause',

  /**
   * 跳帧
   */
  JUMP_FRAME: 'jumpFrame',

  /**
   * 缺陷下载
   */
  DOWNLOAD_DEFECT: 'downloadDefect',

  /**
   * 自定义播放速度
   */
  CUSTOM_SPEED: 'customSpeed',

  /**
   * 显示或隐藏缺陷框
   */
  TOGGLE_INFO: 'toggleInfo',

  /**
   * 画布复位
   */
  REFRESH: 'refresh',

  /**
   * 长按加速播放
   */
  ACCELERATE_PLAY: 'acceleratePlay',
} as const;

export type ShortcutAction = keyof typeof SHORTCUT_ACTIONS;

/**
 * B显显示模式
 */
export const B_DISPLAY_MODE = {
  /**
   * 组合显示模式 - 多通道数据合并显示
   */
  COMBINE: 'b_combine',
  /**
   * 分解显示模式 - 多通道数据分开显示
   */
  SPLIT: 'b_split',
  /**
   * 居中显示模式 - 数据居中对齐显示
   */
  CENTER: 'b_center',
} as const;

/**
 * @deprecated 请使用 B_DISPLAY_MODE 替代
 */
export const BMODE = B_DISPLAY_MODE;

/**
 * 源数据播放模式
 */
export const PLAY_MODE = {
  /**
   * 全程播放模式 - 播放完整数据
   */
  FULL: 'play_full',
  /**
   * 剪辑播放模式 - 只播放选定区间
   */
  CLIP: 'play_clip',
} as const;

/**
 * 复核模式
 */
export const REVIEW_MODE = {
  /**
   * 传统复核模式 - 按公里标顺序复核
   */
  TRADITIONAL: 'review_traditional',
  /**
   * 缺陷导向模式 - 按缺陷重要性排序复核
   */
  DEFECT_PRIORITY: 'review_defect_priority',
} as const;

/**
 * 播放器的数据仓库
 */
export const trackPlayerStore = defineStore('trackPlayer', {
  state: () => {

    return {
      // 播放器状态
      isPlaying: false, // 播放中
      download: false, // 是否下载
      speed: 1.0, // 播放速度，初始为 1.0

      // 播放器设置
      toolData: {
        showPositionInfo: true, // 是否显示位置信息
        showDefectInfo: true, // 是否显示缺陷信息
        showKm: true, // 是否显示公里标
        bMode: B_DISPLAY_MODE.COMBINE, // B显模式
        playMode: PLAY_MODE.FULL, // 播放模式
      }, // 工具数据

      // 播放器弹窗状态
      showFixedTool: false, // 是否显示固定工具栏
      showSpeed: false, // 是否打开播放速度设置
      showTool: false, // 是否打开工具设置
      showSetting: false, // 是否打开工具设置
      showTrack: false, // 是否打开轨道数据弹窗
      showMode: false, // 是否打开模式弹窗

      openDefectConfirm: false, // 是否打开缺陷确认弹窗
      openDefectDelete: false, // 是否打开缺陷删除弹窗
      openShortcut: false, // 是否打开快捷键设置弹窗
      openHistory: false, // 是否打开历史记录弹窗

      reviewMode: REVIEW_MODE.TRADITIONAL as typeof REVIEW_MODE[keyof typeof REVIEW_MODE], // 复核模式

      COLORS: ['#C000FF', '#00FF00', '#C04000', '#00C0FF', '#000000', '#FF40FF', '#00C000', '#0000FF', '#FF0000'],
      checkedTracks: [] as string[],

      // 缺陷&图片数据
      showDefect: true, // 是否显示缺陷
      isAdd: false, // 是否添加缺陷
      defectData: {} as any, // 缺陷数据
      taskData: {} as any, // 任务数据
      // trackInspectionData: {} as TrackInspectionData, // 注释掉大型数据的响应式存储

      shortcuts: {
        prevDefect: 'W',//上一个缺陷
        nextDefect: 'S', //下一个缺陷
        confirmDefect: 'D', //确认缺陷
        deleteDefect: '双击缺陷框',//删除缺陷
        toggleInfo: 'V', //缺陷信息查看/隐藏
        refresh: 'R', //画布复位(平移/缩放)
        jumpFrame: 'O', //跳转公里标
        playPause: ' ', //播放/暂停
        acceleratePlay: 'ArrowRight', //长按加速播放
        addDefect: 'A', //新增缺陷
        prevFrame: 'Q', //上一屏
        nextFrame: 'E' //下一屏
      } as Record<string, string>,
    }
  },
  getters: {
  },
  actions: {
    setTrackInspectionData(data: TrackInspectionData) {
      // 将大数据存储在实例上，而非响应式状态中
      (this as any)._trackInspectionData = data;
    },

    getTrackInspectionData(): TrackInspectionData | null {
      return (this as any)._trackInspectionData || null;
    },
  },
  persist: {
    key: 'trackDefectReview_shortcuts',
    storage: localStorage,
    pick: ['shortcuts'],
  },
})
