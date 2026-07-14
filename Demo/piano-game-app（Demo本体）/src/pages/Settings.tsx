import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, Info, Camera, AlertCircle } from 'lucide-react'
import { useSettings } from '@/context/SettingsContext'
import type { Timbre, VisualStyle, ColorBlindPalette } from '@/context/SettingsContext'

/* ============================================================
   Toggle 开关 — 内联实现（不单独建文件）
   ============================================================ */
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-sm whitespace-nowrap"
          style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
        >
          {label}
        </span>
        {description && (
          <span
            className="text-xs truncate"
            style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
          >
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative w-[42px] h-[24px] rounded-full transition-colors shrink-0"
        style={{ background: checked ? 'var(--piano-primary)' : 'var(--piano-muted)' }}
      >
        <span
          className="absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </button>
    </label>
  )
}

/* ============================================================
   静态配置
   ============================================================ */

type SectionKey = 'visual-style' | 'audio' | 'accessibility' | 'camera' | 'about'

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'visual-style', label: '视觉风格' },
  { key: 'audio', label: '音频' },
  { key: 'accessibility', label: '无障碍' },
  { key: 'camera', label: '摄像头' },
  { key: 'about', label: '关于' },
]

const STYLE_PREVIEWS: Record<
  VisualStyle,
  { label: string; desc: string; background: string }
> = {
  starry: {
    label: '星空',
    desc: '深紫宇宙 · 星点粒子',
    background: `
      radial-gradient(2px 2px at 20px 20px, #ffffff, transparent),
      radial-gradient(1px 1px at 50px 50px, #ffffff, transparent),
      radial-gradient(1.5px 1.5px at 90px 30px, #ffffff, transparent),
      radial-gradient(1px 1px at 130px 70px, #ffffff, transparent),
      radial-gradient(2px 2px at 70px 90px, #ffffff, transparent),
      linear-gradient(135deg, #0d0b1a, #5b21b6)
    `,
  },
  sakura: {
    label: '樱花',
    desc: '粉色飘落 · 柔和氛围',
    background: `
      radial-gradient(3px 2px at 20px 25px, #f9a8d4, transparent),
      radial-gradient(2px 3px at 60px 60px, #f472b6, transparent),
      radial-gradient(3px 2px at 100px 35px, #f9a8d4, transparent),
      radial-gradient(2px 2px at 135px 75px, #f472b6, transparent),
      linear-gradient(135deg, #1a0d14, #db2777)
    `,
  },
  cyber: {
    label: '赛博',
    desc: '霓虹网格 · 赛博朋克',
    background: `
      linear-gradient(90deg, transparent 49%, rgba(34,211,238,0.4) 50%, transparent 51%) 0 0 / 20px 20px,
      linear-gradient(0deg, transparent 49%, rgba(34,211,238,0.4) 50%, transparent 51%) 0 0 / 20px 20px,
      linear-gradient(135deg, #0a0e1a, #0891b2)
    `,
  },
}

const TIMBRE_OPTIONS: { value: Timbre; label: string }[] = [
  { value: 'piano', label: '三角钢琴' },
  { value: 'music_box', label: '音乐盒' },
  { value: 'pad', label: '合成 Pad' },
  { value: '8bit', label: '8-bit 方波' },
]

const ERROR_CODES: { code: string; desc: string }[] = [
  { code: 'E001', desc: '音频初始化失败' },
  { code: 'E002', desc: '存储已满' },
  { code: 'E003', desc: '模型加载失败' },
  { code: 'E004', desc: '摄像头不可用' },
]

const CALIBRATION_TARGET_MS = 500 // 120 BPM → 500ms / 拍
const CALIBRATION_CLICKS = 5

/* ============================================================
   主组件
   ============================================================ */
export default function Settings() {
  const { settings, update } = useSettings()
  const [activeSection, setActiveSection] = useState<SectionKey>('visual-style')

  /* ---------- Toast ---------- */
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500)
  }, [])
  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    },
    [],
  )

  /* ---------- 延迟校准 ---------- */
  const clickTimesRef = useRef<number[]>([])
  const [calib, setCalib] = useState<{ active: boolean; count: number; result: number | null }>({
    active: false,
    count: 0,
    result: null,
  })

  const handleCalibrationClick = () => {
    const now = performance.now()

    // 未在校准中 → 开始（并记录第 1 次）
    if (!calib.active) {
      clickTimesRef.current = [now]
      setCalib({ active: true, count: 1, result: null })
      return
    }

    // 校准中 → 追加
    const newTimes = [...clickTimesRef.current, now]
    if (newTimes.length >= CALIBRATION_CLICKS) {
      // 计算间隔
      const intervals: number[] = []
      for (let i = 1; i < newTimes.length; i++) {
        intervals.push(newTimes[i] - newTimes[i - 1])
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const offset = Math.round(avg - CALIBRATION_TARGET_MS)
      clickTimesRef.current = []
      setCalib({ active: false, count: 0, result: offset })
      update({ latencyOffsetMs: offset })
    } else {
      clickTimesRef.current = newTimes
      setCalib({ active: true, count: newTimes.length, result: null })
    }
  }

  /* ---------- 摄像头 ---------- */
  const [showCameraModal, setShowCameraModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraConfirmedRef = useRef(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const enableCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia unavailable')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      update({ cameraEnabled: true })
    } catch {
      showToast('无法访问摄像头')
      update({ cameraEnabled: false })
    }
  }, [update, showToast])

  const handleCameraToggle = (v: boolean) => {
    if (v) {
      if (!cameraConfirmedRef.current) {
        setShowCameraModal(true)
      } else {
        void enableCamera()
      }
    } else {
      stopCamera()
      update({ cameraEnabled: false })
    }
  }

  const confirmCameraModal = () => {
    setShowCameraModal(false)
    cameraConfirmedRef.current = true
    void enableCamera()
  }

  const cancelCameraModal = () => {
    setShowCameraModal(false)
    update({ cameraEnabled: false })
  }

  // 卸载时释放摄像头
  useEffect(() => () => stopCamera(), [stopCamera])

  /* ---------- 无障碍联动 ---------- */
  const handleHighContrast = (v: boolean) => {
    if (v) {
      update({ highContrast: true, theme: 'light' })
    } else {
      update({ highContrast: false, theme: 'dark' })
    }
  }

  const colorBlindEnabled = settings.colorBlindPalette !== 'none'
  const handleColorBlind = (v: boolean) => {
    const next: ColorBlindPalette = v ? 'deuteranopia' : 'none'
    update({ colorBlindPalette: next })
  }

  /* ---------- 渲染 ---------- */
  const cardStyle = {
    background: 'var(--piano-card)',
    border: '1px solid var(--piano-border)',
  } as const

  const sectionTitleStyle = {
    fontFamily: 'var(--piano-font-display)',
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--piano-foreground)',
  } as const

  const dividerStyle = { borderTop: '1px solid var(--piano-border)' } as const

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 pt-6 pb-12">
      <div className="lg:flex lg:gap-8">
        {/* ---------- 左侧 / 顶部导航 ---------- */}
        <aside className="lg:w-[200px] lg:shrink-0 lg:self-start lg:sticky lg:top-20 mb-4 lg:mb-0">
          <nav
            className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:overflow-visible pb-2 lg:pb-0"
            role="tablist"
            aria-label="设置分区"
          >
            {SECTIONS.map((s) => {
              const active = activeSection === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSection(s.key)}
                  className="shrink-0 whitespace-nowrap py-2 px-4 rounded-md transition-opacity hover:opacity-80 text-left"
                  style={{
                    background: active ? 'var(--piano-card)' : 'transparent',
                    color: active ? 'var(--piano-primary)' : 'var(--piano-muted-foreground)',
                    fontWeight: active ? 600 : 400,
                    borderLeft: `3px solid ${active ? 'var(--piano-primary)' : 'transparent'}`,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ---------- 右侧内容 ---------- */}
        <div className="flex-1 min-w-0">
          {/* ===== 视觉风格 ===== */}
          {activeSection === 'visual-style' && (
            <section id="visual-style">
              <h2 className="mb-4 whitespace-nowrap" style={sectionTitleStyle}>
                视觉风格
              </h2>
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                role="radiogroup"
                aria-label="视觉风格选择"
              >
                {(Object.keys(STYLE_PREVIEWS) as VisualStyle[]).map((key) => {
                  const preview = STYLE_PREVIEWS[key]
                  const selected = settings.visualStyle === key
                  return (
                    <div
                      key={key}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => update({ visualStyle: key })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          update({ visualStyle: key })
                        }
                      }}
                      className="relative cursor-pointer rounded-md p-3 flex flex-col gap-2 transition-colors hover:opacity-90"
                      style={{
                        border: `2px solid ${selected ? 'var(--piano-primary)' : 'var(--piano-border)'}`,
                        boxShadow: selected
                          ? '0 0 0 3px color-mix(in srgb, var(--piano-primary) 22%, transparent)'
                          : 'none',
                      }}
                    >
                      {selected && (
                        <span
                          className="absolute top-2 right-2 z-10"
                          style={{ color: 'var(--piano-primary)' }}
                        >
                          <Check className="h-5 w-5" />
                        </span>
                      )}
                      <div
                        className="w-[160px] h-[100px] rounded-sm max-w-full"
                        style={{ background: preview.background }}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="truncate"
                          style={{
                            fontFamily: 'var(--piano-font-body)',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--piano-foreground)',
                          }}
                        >
                          {preview.label}
                        </span>
                        <span
                          className="truncate"
                          style={{
                            fontFamily: 'var(--piano-font-body)',
                            fontSize: '11px',
                            color: 'var(--piano-muted-foreground)',
                          }}
                        >
                          {preview.desc}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ===== 音频 ===== */}
          {activeSection === 'audio' && (
            <section id="audio">
              <h2 className="mb-4 whitespace-nowrap" style={sectionTitleStyle}>
                音频
              </h2>
              <div className="rounded-md p-4 sm:p-5 flex flex-col" style={cardStyle}>
                {/* 默认音色 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
                  <span
                    className="text-sm whitespace-nowrap shrink-0"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                  >
                    默认音色
                  </span>
                  <select
                    value={settings.defaultTimbre}
                    onChange={(e) => update({ defaultTimbre: e.target.value as Timbre })}
                    className="rounded-md px-3 py-2 text-sm cursor-pointer"
                    style={{
                      background: 'var(--piano-card)',
                      border: '1px solid var(--piano-border)',
                      color: 'var(--piano-foreground)',
                      fontFamily: 'var(--piano-font-body)',
                    }}
                  >
                    {TIMBRE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 节拍器音量 */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4"
                  style={dividerStyle}
                >
                  <span
                    className="text-sm whitespace-nowrap shrink-0"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                  >
                    节拍器音量
                  </span>
                  <div className="flex items-center gap-3 flex-1 sm:flex-none sm:max-w-[260px]">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(settings.metronomeVolume * 100)}
                      onChange={(e) =>
                        update({ metronomeVolume: Number(e.target.value) / 100 })
                      }
                      className="flex-1"
                      style={{ accentColor: 'var(--piano-primary)', height: '4px', cursor: 'pointer' }}
                      aria-label="节拍器音量"
                    />
                    <span
                      className="w-10 text-right whitespace-nowrap"
                      style={{
                        fontFamily: 'var(--piano-font-mono)',
                        fontSize: '14px',
                        color: 'var(--piano-foreground)',
                      }}
                    >
                      {Math.round(settings.metronomeVolume * 100)}%
                    </span>
                  </div>
                </div>

                {/* 延迟校准 */}
                <div className="flex flex-col gap-3 py-4" style={dividerStyle}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span
                      className="text-sm whitespace-nowrap shrink-0"
                      style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                    >
                      延迟校准
                    </span>
                    <button
                      type="button"
                      onClick={handleCalibrationClick}
                      className="px-4 py-2 rounded-md text-sm whitespace-nowrap transition-opacity hover:opacity-80"
                      style={{
                        background: calib.active ? 'var(--piano-pink)' : 'var(--piano-primary)',
                        color: 'var(--piano-primary-foreground)',
                      }}
                    >
                      {calib.active
                        ? `点击节拍 (${calib.count}/${CALIBRATION_CLICKS})`
                        : '点击校准'}
                    </button>
                  </div>
                  <p
                    className="text-xs flex items-start gap-1"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
                  >
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      点击上方按钮 {CALIBRATION_CLICKS} 次，系统将根据平均间隔与标准节拍（120BPM = {CALIBRATION_TARGET_MS}ms）的差值自动计算设备延迟。
                    </span>
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="text-sm"
                      style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                    >
                      当前延迟：
                    </span>
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: 'var(--piano-font-mono)',
                        color: calib.result !== null ? 'var(--piano-primary)' : 'var(--piano-muted-foreground)',
                      }}
                    >
                      {settings.latencyOffsetMs} ms
                    </span>
                    {calib.result !== null && (
                      <span
                        className="text-xs"
                        style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
                      >
                        （本次校准结果：{calib.result} ms）
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===== 无障碍 ===== */}
          {activeSection === 'accessibility' && (
            <section id="accessibility">
              <h2 className="mb-4 whitespace-nowrap" style={sectionTitleStyle}>
                无障碍
              </h2>
              <div className="rounded-md p-4 sm:p-5 flex flex-col" style={cardStyle}>
                <div className="py-4">
                  <Toggle
                    label="高对比模式"
                    description="切换至浅色高对比主题"
                    checked={settings.highContrast}
                    onChange={handleHighContrast}
                  />
                </div>
                <div className="py-4" style={dividerStyle}>
                  <Toggle
                    label="键盘可达"
                    description="所有控件支持 Tab 键聚焦"
                    checked={settings.keyboardNav}
                    onChange={(v) => update({ keyboardNav: v })}
                  />
                </div>
                <div className="py-4" style={dividerStyle}>
                  <Toggle
                    label="振动反馈"
                    description="按键时触发设备振动（移动端）"
                    checked={settings.vibration}
                    onChange={(v) => update({ vibration: v })}
                  />
                </div>
                <div className="py-4" style={dividerStyle}>
                  <Toggle
                    label="色弱配色"
                    description="使用更高对比度的判定色"
                    checked={colorBlindEnabled}
                    onChange={handleColorBlind}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ===== 摄像头 ===== */}
          {activeSection === 'camera' && (
            <section id="camera">
              <h2 className="mb-4 whitespace-nowrap" style={sectionTitleStyle}>
                摄像头画中画
              </h2>
              <div className="rounded-md p-4 sm:p-5 flex flex-col gap-4" style={cardStyle}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-sm flex items-center gap-1.5 whitespace-nowrap"
                      style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                    >
                      <Camera className="h-4 w-4 shrink-0" />
                      摄像头画中画
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
                    >
                      仅本地显示，不上传
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.cameraEnabled}
                    aria-label="摄像头画中画"
                    onClick={() => handleCameraToggle(!settings.cameraEnabled)}
                    className="relative w-[42px] h-[24px] rounded-full transition-colors shrink-0"
                    style={{
                      background: settings.cameraEnabled
                        ? 'var(--piano-primary)'
                        : 'var(--piano-muted)',
                    }}
                  >
                    <span
                      className="absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full bg-white transition-transform"
                      style={{ transform: settings.cameraEnabled ? 'translateX(18px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>

                {/* 预览窗 */}
                {settings.cameraEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-[320px] aspect-video rounded-md"
                    style={{ background: 'var(--piano-background)', border: '1px solid var(--piano-border)' }}
                  />
                ) : (
                  <div
                    className="w-full max-w-[320px] aspect-video rounded-md flex items-center justify-center"
                    style={{ background: 'var(--piano-muted)', border: '1px dashed var(--piano-border)' }}
                  >
                    <span
                      className="text-xs"
                      style={{ color: 'var(--piano-muted-foreground)' }}
                    >
                      摄像头未开启
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ===== 关于 ===== */}
          {activeSection === 'about' && (
            <section id="about">
              <h2 className="mb-4 whitespace-nowrap" style={sectionTitleStyle}>
                关于
              </h2>
              <div className="rounded-md p-4 sm:p-5 flex flex-col" style={cardStyle}>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                  >
                    版本
                  </span>
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-mono)', color: 'var(--piano-muted-foreground)' }}
                  >
                    v1.0.0
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3" style={dividerStyle}>
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                  >
                    数据存储
                  </span>
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
                  >
                    所有数据存储在本地浏览器，无需联网
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3" style={dividerStyle}>
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-foreground)' }}
                  >
                    参赛信息
                  </span>
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
                  >
                    TRAE AI Creative Competition 参赛作品
                  </span>
                </div>
              </div>

              {/* 错误码表 */}
              <div className="rounded-md p-4 sm:p-5 mt-4" style={cardStyle}>
                <h3
                  className="text-sm mb-3"
                  style={{
                    fontFamily: 'var(--piano-font-body)',
                    fontWeight: 600,
                    color: 'var(--piano-foreground)',
                  }}
                >
                  错误码参考
                </h3>
                <ul className="flex flex-col gap-2">
                  {ERROR_CODES.map((e) => (
                    <li key={e.code} className="flex items-center gap-3 text-[13px]">
                      <span
                        className="px-2 py-0.5 rounded-sm whitespace-nowrap"
                        style={{
                          fontFamily: 'var(--piano-font-mono)',
                          background: 'var(--piano-muted)',
                          color: 'var(--piano-pink-300)',
                        }}
                      >
                        {e.code}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--piano-font-body)',
                          color: 'var(--piano-muted-foreground)',
                        }}
                      >
                        {e.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ---------- 摄像头隐私 Modal ---------- */}
      {showCameraModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          role="dialog"
          aria-modal="true"
          aria-label="摄像头隐私提示"
        >
          <div
            className="w-full max-w-sm rounded-md p-5 flex flex-col gap-4"
            style={{ background: 'var(--piano-popover)', border: '1px solid var(--piano-border)' }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                className="h-5 w-5 shrink-0 mt-0.5"
                style={{ color: 'var(--piano-pink)' }}
              />
              <h3
                className="text-base"
                style={{
                  fontFamily: 'var(--piano-font-display)',
                  fontWeight: 700,
                  color: 'var(--piano-foreground)',
                }}
              >
                隐私提示
              </h3>
            </div>
            <p
              className="text-sm"
              style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
            >
              视频仅本地处理，不会上传到任何服务器。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelCameraModal}
                className="px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                style={{ border: '1px solid var(--piano-border)', color: 'var(--piano-muted-foreground)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmCameraModal}
                className="px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--piano-primary)',
                  color: 'var(--piano-primary-foreground)',
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-md text-sm"
          style={{
            background: 'var(--piano-popover)',
            border: '1px solid var(--piano-border)',
            color: 'var(--piano-foreground)',
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
