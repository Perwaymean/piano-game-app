import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAudioEngine } from '@/context/AudioContextProvider'
import { useSettings } from '@/context/SettingsContext'
import type { Timbre } from '@/context/SettingsContext'
import {
  BLACK_KEYS,
  WHITE_KEYS,
  midiToNote,
  octaveToMidiC,
} from '@/engine/key-mapper'
import { VisualEngine } from '@/engine/visual-engine'
import PianoKeyboard from '@/components/PianoKeyboard'
import PortraitWarning from '@/components/PortraitWarning'
import CameraPiP from '@/components/CameraPiP'

interface RecordedNote {
  midi: number
  time: number // 录制起点相对偏移（秒）
  duration: number // 持续时间（秒）
  velocity: number
}

interface NoteOverlay {
  id: number
  note: string
}

const TIMBRES: { value: Timbre; label: string }[] = [
  { value: 'piano', label: '三角钢琴' },
  { value: 'music_box', label: '音乐盒' },
  { value: 'pad', label: '合成 Pad' },
  { value: '8bit', label: '8-bit 方波' },
]

// 按键映射表顺序（2 八度 24 键，按钢琴从低到高排列）
// 下八度：Z X C V B N M（白） + S D G H J（黑）
// 上八度：Q W E R T Y U（白） + 2 3 5 6 7（黑）
const KEY_ORDER: { key: string; isBlack: boolean }[] = [
  // 下八度（C-B）
  { key: 'z', isBlack: false },  // C
  { key: 's', isBlack: true },   // C#
  { key: 'x', isBlack: false },  // D
  { key: 'd', isBlack: true },   // D#
  { key: 'c', isBlack: false },  // E
  { key: 'v', isBlack: false },  // F
  { key: 'g', isBlack: true },   // F#
  { key: 'b', isBlack: false },  // G
  { key: 'h', isBlack: true },   // G#
  { key: 'n', isBlack: false },  // A
  { key: 'j', isBlack: true },   // A#
  { key: 'm', isBlack: false },  // B
  // 上八度（C-B）
  { key: 'q', isBlack: false },  // C
  { key: '2', isBlack: true },   // C#
  { key: 'w', isBlack: false },  // D
  { key: '3', isBlack: true },   // D#
  { key: 'e', isBlack: false },  // E
  { key: 'r', isBlack: false },  // F
  { key: '5', isBlack: true },   // F#
  { key: 't', isBlack: false },  // G
  { key: '6', isBlack: true },   // G#
  { key: 'y', isBlack: false },  // A
  { key: '7', isBlack: true },   // A#
  { key: 'u', isBlack: false },  // B
]

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function FreePlay() {
  const { engine } = useAudioEngine()
  const { settings, update } = useSettings()
  const currentTimbre: Timbre = settings.defaultTimbre

  // 3D 模式：从 URL 参数读取初始值，之后用页面内 state 切换
  const [searchParams] = useSearchParams()
  const [is3DMode, setIs3DMode] = useState(searchParams.get('mode') === '3d')
  const [modeSwitching, setModeSwitching] = useState(false)

  // 2D ↔ 3D 丝滑切换（带淡出/淡入过渡）
  const toggleMode = useCallback(() => {
    setModeSwitching(true)
    window.setTimeout(() => {
      setIs3DMode(prev => !prev)
      // 等 canvas 挂载后再解除过渡
      window.setTimeout(() => setModeSwitching(false), 50)
    }, 250)
  }, [])

  const [octave, setOctave] = useState(4)
  const [sustain, setSustain] = useState(false)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [bpm, setBpm] = useState(120)

  // 摄像头画中画开关（弹奏时可见自己）
  const [cameraOn, setCameraOn] = useState(false)

  // 当前音名浮层
  const [overlay, setOverlay] = useState<NoteOverlay | null>(null)
  const overlayIdRef = useRef(0)
  const overlayTimerRef = useRef<number | null>(null)

  // 3D 引擎实例
  const visualEngineRef = useRef<VisualEngine | null>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const [webglUnsupported, setWebglUnsupported] = useState(false)

  // 力度
  const [lastVelocity, setLastVelocity] = useState(0.8)

  // 录音
  const [recState, setRecState] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [recStart, setRecStart] = useState(0) // performance.now() 毫秒
  const [recNotes, setRecNotes] = useState<RecordedNote[]>([])
  const [recDuration, setRecDuration] = useState(0) // 秒
  const [recElapsed, setRecElapsed] = useState(0) // 秒（录制中实时）
  const recNoteStartRef = useRef<Map<number, number>>(new Map()) // midi → performance.now() 毫秒

  // 移动端抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 按键映射表（当前八度）
  const mapping = KEY_ORDER.map(({ key, isBlack }) => {
    const offset = isBlack ? BLACK_KEYS[key] : WHITE_KEYS[key]
    const midi = octaveToMidiC(octave) + offset
    return { key, note: midiToNote(midi), isBlack }
  })

  // ====== 按键 / 松键 ======
  const handlePress = useCallback((_key: string, midi: number) => {
    const velocity = 0.6 + Math.random() * 0.4
    setLastVelocity(velocity)
    engine.playNote(midi, {
      timbre: currentTimbre,
      velocity,
      ...(sustain ? {} : { duration: 0.18 }),
    })
    // 3D 模式：触发键按下动画 + 命中粒子爆发
    if (visualEngineRef.current) {
      visualEngineRef.current.pressKey(midi)
      visualEngineRef.current.triggerBurst(midi, 'perfect')
    }
    // 音名浮层
    overlayIdRef.current += 1
    const id = overlayIdRef.current
    setOverlay({ id, note: midiToNote(midi) })
    if (overlayTimerRef.current !== null) window.clearTimeout(overlayTimerRef.current)
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlay((cur) => (cur && cur.id === id ? null : cur))
    }, 300)
    // 录音
    if (recState === 'recording') {
      recNoteStartRef.current.set(midi, performance.now())
    }
  }, [engine, currentTimbre, sustain, recState])

  const handleRelease = useCallback((_key: string, midi: number) => {
    if (recState === 'recording') {
      const startMs = recNoteStartRef.current.get(midi)
      if (startMs !== undefined) {
        const nowMs = performance.now()
        const recStartSec = recStart / 1000
        const startSec = startMs / 1000
        const durSec = (nowMs - startMs) / 1000
        setRecNotes((prev) => [...prev, {
          midi,
          time: startSec - recStartSec,
          duration: durSec,
          velocity: 0.8,
        }])
        recNoteStartRef.current.delete(midi)
      }
    }
  }, [recState, recStart])

  // ====== 八度切换（左面板按钮） ======
  const changeOctave = useCallback((next: number) => {
    setOctave(Math.max(1, Math.min(6, next)))
  }, [])

  // ====== 录音控制 ======
  const startRec = useCallback(() => {
    recNoteStartRef.current.clear()
    setRecNotes([])
    setRecDuration(0)
    setRecElapsed(0)
    setRecStart(performance.now())
    setRecState('recording')
  }, [])

  const stopRec = useCallback(() => {
    setRecDuration((performance.now() - recStart) / 1000)
    setRecState('recorded')
    recNoteStartRef.current.clear()
  }, [recStart])

  const clearRec = useCallback(() => {
    setRecState('idle')
    setRecNotes([])
    setRecDuration(0)
    setRecElapsed(0)
    recNoteStartRef.current.clear()
  }, [])

  const playback = useCallback(() => {
    recNotes.forEach((n) => {
      window.setTimeout(() => {
        engine.playNote(n.midi, {
          timbre: currentTimbre,
          duration: Math.max(0.1, n.duration),
          velocity: n.velocity,
        })
      }, n.time * 1000)
    })
  }, [recNotes, engine, currentTimbre])

  // ====== 录制中计时 ======
  useEffect(() => {
    if (recState !== 'recording') return
    const id = window.setInterval(() => {
      setRecElapsed((performance.now() - recStart) / 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [recState, recStart])

  // ====== 节拍器 ======
  useEffect(() => {
    if (!metronomeOn) return
    const intervalMs = 60000 / Math.max(40, Math.min(240, bpm))
    let beat = 0
    const tick = () => {
      const accent = beat % 4 === 0
      engine.playNote(accent ? 88 : 84, {
        timbre: '8bit',
        duration: 0.04,
        velocity: accent ? 0.5 : 0.3,
      })
      beat += 1
    }
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [metronomeOn, bpm, engine])

  // ====== 卸载清理 ======
  useEffect(() => {
    return () => {
      if (overlayTimerRef.current !== null) window.clearTimeout(overlayTimerRef.current)
    }
  }, [])

  // ====== 3D 引擎初始化（仅 3D 模式） ======
  useEffect(() => {
    if (!is3DMode) return
    const canvas = canvas3DRef.current
    if (!canvas) return

    try {
      const ve = new VisualEngine(canvas, settings.visualStyle)
      visualEngineRef.current = ve
      setWebglUnsupported(false)
    } catch {
      setWebglUnsupported(true)
      visualEngineRef.current = null
    }

    // 响应窗口尺寸变化
    const handleResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w > 0 && h > 0) visualEngineRef.current?.resize(w, h)
    }
    window.addEventListener('resize', handleResize)
    // 初始尺寸
    requestAnimationFrame(handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      visualEngineRef.current?.dispose()
      visualEngineRef.current = null
    }
    // 仅在 is3DMode 切换时初始化；visualStyle 变化通过下方 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3DMode])

  // ====== 视觉风格切换同步到 3D 引擎 ======
  useEffect(() => {
    if (visualEngineRef.current && settings.visualStyle) {
      visualEngineRef.current.setStyle(settings.visualStyle)
    }
  }, [settings.visualStyle])

  const velocityPct = Math.round(lastVelocity * 100)
  const velocityMidi = Math.round(lastVelocity * 127)

  // ====== 左控件栏内容（桌面侧栏与移动端抽屉共用） ======
  const renderLeftControls = () => (
    <div className="flex flex-col gap-5 p-4">
      {/* 八度 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>音域</span>
        <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--piano-foreground)' }}>C{octave}-B{octave + 1}</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="下一八度 (←)"
            onClick={() => changeOctave(octave - 1)}
            disabled={octave <= 1}
            className="flex-1 py-2 rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ fontFamily: 'var(--piano-font-mono)', border: '1px solid var(--piano-border)', color: 'var(--piano-foreground)' }}
          >← 降八度</button>
          <button
            type="button"
            aria-label="上一八度 (→)"
            onClick={() => changeOctave(octave + 1)}
            disabled={octave >= 6}
            className="flex-1 py-2 rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ fontFamily: 'var(--piano-font-mono)', border: '1px solid var(--piano-border)', color: 'var(--piano-foreground)' }}
          >升八度 →</button>
        </div>
      </div>

      {/* 音色 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>音色</span>
        <div className="flex flex-col gap-1.5">
          {TIMBRES.map((t) => {
            const active = t.value === currentTimbre
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ defaultTimbre: t.value })}
                className="text-left px-3 py-2 rounded-md transition-opacity hover:opacity-80"
                style={active
                  ? { background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)', border: '1px solid var(--piano-primary)', fontSize: 13 }
                  : { border: '1px solid var(--piano-border)', color: 'var(--piano-foreground)', fontSize: 13 }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 延音 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>延音踏板</span>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--piano-foreground)' }}>{sustain ? '已开启' : '已关闭'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={sustain}
            aria-label="延音开关"
            onClick={() => setSustain((v) => !v)}
            className="relative h-5 w-9 rounded-full shrink-0 transition-colors"
            style={{ background: sustain ? 'var(--piano-primary)' : 'var(--piano-border)' }}
          >
            <span
              className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform"
              style={{ background: 'var(--piano-foreground)', transform: sustain ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </div>

      {/* 节拍器 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>节拍器</span>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--piano-foreground)' }}>{metronomeOn ? '已开启' : '已关闭'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={metronomeOn}
            aria-label="节拍器开关"
            onClick={() => setMetronomeOn((v) => !v)}
            className="relative h-5 w-9 rounded-full shrink-0 transition-colors"
            style={{ background: metronomeOn ? 'var(--piano-primary)' : 'var(--piano-border)' }}
          >
            <span
              className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform"
              style={{ background: 'var(--piano-foreground)', transform: metronomeOn ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="fp-bpm" className="text-xs" style={{ color: 'var(--piano-muted-foreground)' }}>BPM</label>
          <input
            id="fp-bpm"
            type="number"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || 120)}
            className="w-20 px-2 py-1 rounded-md"
            style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 13, background: 'var(--piano-input)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
          />
        </div>
      </div>

      {/* 录音三态 */}
      <div className="flex flex-col gap-2 items-center">
        <span className="self-start text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>录音</span>
        {recState === 'idle' && (
          <button
            type="button"
            onClick={startRec}
            aria-label="开始录音"
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: 'var(--piano-pink)', color: 'var(--piano-primary-foreground)' }}
          >开始录音</button>
        )}
        {recState === 'recording' && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={stopRec}
              aria-label="停止录音"
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: 'var(--piano-pink)', color: 'var(--piano-primary-foreground)' }}
            >停止</button>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--piano-pink)', animation: 'fpRecPulse 1s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 14, color: 'var(--piano-muted-foreground)' }}>{formatTime(recElapsed)}</span>
            </div>
          </div>
        )}
        {recState === 'recorded' && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={playback}
                aria-label="回放录音"
                className="px-3 py-1.5 rounded-md text-sm"
                style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)' }}
              >回放</button>
              <button
                type="button"
                onClick={clearRec}
                aria-label="清除录音"
                className="px-3 py-1.5 rounded-md text-sm"
                style={{ border: '1px solid var(--piano-border)', color: 'var(--piano-foreground)' }}
              >清除</button>
            </div>
            <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 13, color: 'var(--piano-muted-foreground)' }}>{formatTime(recDuration)} · {recNotes.length} 音</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <PortraitWarning />
      <style>{`
        @keyframes fpNoteFade { 0% { opacity: 0.92; transform: scale(1); } 100% { opacity: 0; transform: scale(1.25); } }
        @keyframes fpRecPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
        .fp-scroll::-webkit-scrollbar { display: none; }
        .fp-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ====== 三列主区 ====== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左控件栏 — 桌面 */}
        <aside
          className="hidden lg:flex w-[240px] shrink-0 flex-col overflow-y-auto fp-scroll"
          style={{ background: 'var(--piano-card)', borderRight: '1px solid var(--piano-border)' }}
        >
          {renderLeftControls()}
        </aside>

        {/* 中央舞台 */}
        <div className="flex-1 relative flex flex-col min-w-0">
          {/* 3D 钢琴舞台 / 2D 占位区 */}
          <div
            className="flex-1 relative overflow-hidden"
            style={{
              minHeight: 300,
              opacity: modeSwitching ? 0 : 1,
              transition: 'opacity 250ms ease-in-out',
              background: 'radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--piano-purple-700) 45%, transparent), var(--piano-background) 75%)',
            }}
          >
            {/* 3D 模式：Three.js canvas 舞台 */}
            {is3DMode && !webglUnsupported && (
              <canvas
                ref={canvas3DRef}
                className="absolute inset-0 w-full h-full"
                style={{ display: 'block' }}
              />
            )}
            {/* 3D 模式但 WebGL 不支持：降级提示 */}
            {is3DMode && webglUnsupported && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <span style={{ fontSize: 14, color: 'var(--state-error)' }}>⚠</span>
                  <p className="mt-2" style={{ fontSize: 14, color: 'var(--piano-muted-foreground)' }}>您的浏览器不支持 WebGL，已降级为 2D 模式</p>
                </div>
              </div>
            )}
            {/* 2D 模式：纯占位（无 3D 内容） */}
            {!is3DMode && (
              <div className="absolute inset-0" />
            )}

            {/* 模式标识 + 切换按钮 */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
              <button
                type="button"
                onClick={toggleMode}
                aria-label={is3DMode ? '切换到 2D 模式' : '切换到 3D 模式'}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: is3DMode ? 'color-mix(in srgb, var(--piano-cyan) 18%, transparent)' : 'var(--piano-muted)',
                  color: is3DMode ? 'var(--piano-cyan-400)' : 'var(--piano-muted-foreground)',
                  border: is3DMode ? '1px solid var(--piano-cyan)' : '1px solid var(--piano-border)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {is3DMode ? '✦ 3D 沉浸模式' : '2D 标准模式'}
                <span style={{ fontSize: '10px', opacity: 0.6 }}>⇄</span>
              </button>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {overlay && (
                <span
                  key={overlay.id}
                  className="whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--piano-font-mono)',
                    fontSize: 48,
                    fontWeight: 700,
                    color: is3DMode ? 'var(--piano-cyan-400)' : 'var(--piano-purple-400)',
                    textShadow: is3DMode ? '0 0 24px var(--piano-cyan-400)' : 'none',
                    animation: 'fpNoteFade 300ms ease-out forwards',
                  }}
                >
                  {overlay.note}
                </span>
              )}
            </div>

            {/* 移动端控件入口 */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="打开控件"
              className="lg:hidden absolute top-4 left-4 z-20 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--piano-card)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
            >控件</button>

            {/* 摄像头开关（弹奏时可见自己） */}
            <button
              type="button"
              onClick={() => setCameraOn((v) => !v)}
              aria-label={cameraOn ? '关闭摄像头' : '开启摄像头'}
              aria-pressed={cameraOn}
              className="absolute top-4 left-4 lg:left-auto lg:right-28 z-20 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
              style={{
                background: cameraOn ? 'var(--piano-pink)' : 'var(--piano-card)',
                color: cameraOn ? 'var(--piano-primary-foreground)' : 'var(--piano-foreground)',
                border: '1px solid ' + (cameraOn ? 'var(--piano-pink)' : 'var(--piano-border)'),
              }}
            >
              <span style={{ fontSize: 14 }}>{cameraOn ? '●' : '○'}</span>
              摄像头
            </button>

            <span className="absolute bottom-3 left-3 whitespace-nowrap" style={{ fontSize: 12, color: 'var(--piano-muted-foreground)' }}>按下键盘 A-J 弹奏 · ← → 方向键切换八度</span>
          </div>

          {/* 选曲跟弹入口 */}
          <Link
            to="/library"
            data-dom-id="cta-to-follow-play"
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-5 py-2 transition-opacity hover:opacity-90"
            style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)', fontFamily: 'var(--piano-font-display)', fontSize: 13, fontWeight: 600 }}
          >选曲跟弹 →</Link>
        </div>

        {/* 右信息栏 — 桌面 */}
        <aside
          className="hidden lg:flex w-[240px] shrink-0 flex-col gap-5 overflow-y-auto fp-scroll p-4"
          style={{ background: 'var(--piano-card)', borderLeft: '1px solid var(--piano-border)' }}
        >
          {/* 按键映射 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>按键映射 · C{octave}-B{octave + 1}</span>
            <div className="flex flex-col gap-1">
              {mapping.map(({ key, note, isBlack }) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5"
                    style={{
                      background: isBlack ? 'var(--piano-foreground)' : 'var(--piano-muted)',
                      color: isBlack ? 'var(--piano-primary-foreground)' : 'var(--piano-foreground)',
                      fontFamily: 'var(--piano-font-mono)',
                      fontSize: 12,
                      minWidth: 24,
                      textTransform: 'uppercase',
                    }}
                  >{key}</span>
                  <span style={{ color: 'var(--piano-muted-foreground)', fontSize: 12 }}>→</span>
                  <span className="ml-auto whitespace-nowrap" style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 12, color: 'var(--piano-foreground)' }}>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 力度指示（垂直进度条） */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>力度</span>
            <div className="flex items-end gap-3">
              <div className="relative w-3 rounded-full overflow-hidden" style={{ height: 96, background: 'var(--piano-muted)' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
                  style={{ height: `${velocityPct}%`, background: 'var(--piano-purple-500)' }}
                />
              </div>
              <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 12, color: 'var(--piano-muted-foreground)' }}>{velocityMidi}</span>
            </div>
          </div>

          {/* 录音信息 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>录音信息</span>
            {recState === 'idle' && (
              <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 14, color: 'var(--piano-muted-foreground)' }}>未录制</span>
            )}
            {recState === 'recording' && (
              <div className="flex flex-col gap-1">
                <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 16, color: 'var(--piano-foreground)' }}>{formatTime(recElapsed)}</span>
                <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 12, color: 'var(--piano-muted-foreground)' }}>{recNotes.length} 个音符</span>
              </div>
            )}
            {recState === 'recorded' && (
              <div className="flex flex-col gap-1">
                <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 16, color: 'var(--piano-foreground)' }}>{formatTime(recDuration)}</span>
                <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: 12, color: 'var(--piano-muted-foreground)' }}>{recNotes.length} 个音符 · 可回放</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ====== 底部钢琴键盘 ====== */}
      <div
        className="shrink-0 px-3 py-2"
        style={{ background: 'var(--piano-card)', borderTop: '1px solid var(--piano-border)' }}
      >
        <PianoKeyboard
          key={octave}
          mode="free"
          onKeyPress={handlePress}
          onKeyRelease={handleRelease}
          onOctaveChange={setOctave}
          initialOctave={octave}
          showLetters
        />
      </div>

      {/* ====== 移动端控件抽屉 ====== */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] overflow-y-auto fp-scroll"
            style={{ background: 'var(--piano-card)', borderRight: '1px solid var(--piano-border)' }}
          >
            <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid var(--piano-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--piano-foreground)' }}>控件</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭控件"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md"
                style={{ color: 'var(--piano-muted-foreground)' }}
              >✕</button>
            </div>
            {renderLeftControls()}
          </div>
        </div>
      )}

      {/* ====== 摄像头画中画（弹奏时可见自己） ====== */}
      <CameraPiP enabled={cameraOn} onToggle={setCameraOn} />
    </div>
  )
}
