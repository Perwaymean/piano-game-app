import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Play, Pause, RotateCcw, Sparkles, ChevronLeft, ChevronRight, ArrowLeft, Flag } from 'lucide-react'
import { useAudioEngine } from '@/context/AudioContextProvider'
import { useSettings } from '@/context/SettingsContext'
import { getSongById } from '@/engine/song-data'
import type { Song } from '@/engine/song-data'
import { Judger } from '@/engine/judger'
import type { JudgerStats } from '@/engine/judger'
import { createKeyMapper } from '@/engine/key-mapper'
import type { KeyMapper } from '@/engine/key-mapper'
import type { Difficulty } from '@/engine/storage'
import PianoKeyboard from '@/components/PianoKeyboard'
import PortraitWarning from '@/components/PortraitWarning'
import CameraPiP from '@/components/CameraPiP'
import FallingNotes from '@/components/FallingNotes'
import HUD from '@/components/HUD'
import JudgmentPopup, { nextPopupId } from '@/components/JudgmentPopup'
import type { JudgmentPopupItem } from '@/components/JudgmentPopup'

type GameState = 'ready' | 'playing' | 'paused' | 'ended'

const INITIAL_STATS: JudgerStats = {
  score: 0,
  maxScore: 0,
  combo: 0,
  maxCombo: 0,
  accuracy: 0,
  distribution: { perfect: 0, great: 0, good: 0, miss: 0 },
  rank: 'C',
  totalNotes: 0,
  judgedNotes: 0,
}

const DIFFICULTY_META: Record<Difficulty, { label: string; color: string; bg: string }> = {
  entry: { label: '入门', color: 'var(--state-success)', bg: 'color-mix(in srgb, var(--state-success) 16%, transparent)' },
  intermediate: { label: '进阶', color: 'var(--state-info)', bg: 'color-mix(in srgb, var(--state-info) 16%, transparent)' },
  challenge: { label: '挑战', color: 'var(--state-warning)', bg: 'color-mix(in srgb, var(--state-warning) 16%, transparent)' },
}

// 接近判定线的窗口（秒），用于高亮应按键
const ACTIVE_WINDOW_SEC = 0.2

export default function FollowPlay() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const songId = searchParams.get('song') || 'twinkle'

  const { engine, resume } = useAudioEngine()
  const { settings } = useSettings()

  // ===== 曲目加载 =====
  const [song, setSong] = useState<Song | null>(null)
  useEffect(() => {
    let cancelled = false
    async function loadSong() {
      if (songId.startsWith('ai-')) {
        // 先从 sessionStorage 读取（刚转谱完）
        const stored = sessionStorage.getItem(songId)
        if (stored) {
          try {
            const data = JSON.parse(stored) as { notes: Song['notes']; durationSec: number; bpm: number }
            if (!cancelled) {
              setSong({
                id: songId,
                title: 'AI 转谱作品',
                difficulty: 'intermediate',
                bpm: data.bpm,
                durationSec: data.durationSec,
                notes: data.notes,
                gradient: ['#8b5cf6', '#0891b2'],
              })
            }
            return
          } catch {
            // fall through to IndexedDB
          }
        }
        // sessionStorage 没有，从 IndexedDB 曲库读取
        const { getAiSong } = await import('@/engine/storage')
        const res = await getAiSong(songId)
        if (!cancelled) {
          if (res.success && res.data) {
            const r = res.data
            setSong({
              id: r.id,
              title: r.title,
              difficulty: 'intermediate',
              bpm: r.bpm,
              durationSec: r.durationSec,
              notes: r.notes.map(n => ({ midi: n.midi, time: n.time, duration: n.duration })),
              gradient: r.gradient,
            })
          } else {
            setSong(null)
          }
        }
      } else {
        const s = getSongById(songId)
        if (!cancelled) setSong(s ?? null)
      }
    }
    loadSong()
    return () => { cancelled = true }
  }, [songId])

  // ===== 游戏状态 =====
  const [gameState, setGameState] = useState<GameState>('ready')
  const [currentTime, setCurrentTime] = useState(0)
  const [stats, setStats] = useState<JudgerStats>(INITIAL_STATS)
  const [popupItems, setPopupItems] = useState<JudgmentPopupItem[]>([])
  const [judgedIds, setJudgedIds] = useState<Set<string>>(new Set())
  const [octave, setOctave] = useState(4)
  const [autoPlay, setAutoPlay] = useState(false)
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false)
  const [stageHeight, setStageHeight] = useState(420)
  // 摄像头画中画（弹奏时可见自己）
  const [cameraOn, setCameraOn] = useState(false)

  // ===== Refs =====
  const judgerRef = useRef<Judger | null>(null)
  if (judgerRef.current === null) {
    const j = new Judger()
    j.onJudgment((noteId, result) => {
      setJudgedIds(prev => new Set(prev).add(String(noteId)))
      setPopupItems(prev =>
        [...prev, { id: nextPopupId(), tier: result.tier, offsetMs: result.offsetMs }].slice(-8),
      )
    })
    judgerRef.current = j
  }
  const judger = judgerRef.current

  const mapperRef = useRef<KeyMapper | null>(null)
  if (mapperRef.current === null) mapperRef.current = createKeyMapper()
  const mapper = mapperRef.current

  const startTimeRef = useRef(0)
  const pauseStartRef = useRef(0)
  const rafRef = useRef(0)
  const autoPlayRef = useRef(false)
  const autoPlayedRef = useRef<Set<number>>(new Set())
  const songRef = useRef<Song | null>(null)
  const timbreRef = useRef(settings.defaultTimbre)

  useEffect(() => { songRef.current = song }, [song])
  useEffect(() => { timbreRef.current = settings.defaultTimbre }, [settings.defaultTimbre])
  useEffect(() => { mapper.setOctave(octave) }, [mapper, octave])

  // 谱面加载到 judger
  useEffect(() => {
    if (!song) return
    judger.loadNotes(song.notes.map((n, i) => ({ id: String(i), midi: n.midi, time: n.time })))
    setStats(judger.getStats())
  }, [song, judger])

  // 测量舞台高度，让 FallingNotes 自适应
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStageHeight(Math.max(280, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ===== 曲终跳转 =====
  const endGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setGameState('ended')
    const s = judger.getStats()
    const id = songRef.current?.id ?? songId
    navigate(
      `/results?song=${id}&score=${s.score}&rank=${s.rank}&p=${s.distribution.perfect}&g=${s.distribution.great}&gd=${s.distribution.good}&m=${s.distribution.miss}&combo=${s.maxCombo}&accuracy=${s.accuracy}`,
    )
  }, [judger, navigate, songId])

  // ===== 主循环 =====
  useEffect(() => {
    if (gameState !== 'playing') return
    const loop = () => {
      const s = songRef.current
      if (s) {
        const t = engine.currentTime - startTimeRef.current
        setCurrentTime(t)

        // 自动演示：按 note.time 发声 + 标记判定
        if (autoPlayRef.current) {
          for (let i = 0; i < s.notes.length; i++) {
            if (autoPlayedRef.current.has(i)) continue
            const note = s.notes[i]
            if (note.time <= t) {
              engine.playNote(note.midi, { timbre: timbreRef.current, duration: note.duration })
              autoPlayedRef.current.add(i)
              const idx = i
              setJudgedIds(prev => {
                const next = new Set(prev)
                next.add(String(idx))
                return next
              })
            }
          }
        } else {
          // 检查超时 miss（onJudgment 回调会推入 popup 与 judgedIds）
          const misses = judger.checkMisses(t)
          if (misses.length > 0) {
            setStats(judger.getStats())
          }
        }

        // 曲终
        if (t > s.durationSec + 1) {
          endGame()
          return
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameState, engine, judger, endGame])

  // 卸载时兜底清理
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ===== 开始 / 重启 =====
  const beginGame = useCallback(async () => {
    const s = songRef.current
    if (!s) return
    await resume()
    judger.reset()
    autoPlayedRef.current = new Set()
    autoPlayRef.current = false
    setAutoPlay(false)
    setJudgedIds(new Set())
    setPopupItems([])
    setCurrentTime(0)
    setStats(judger.getStats())
    startTimeRef.current = engine.currentTime
    setGameState('playing')
  }, [resume, engine, judger])

  // ===== 暂停 / 继续 =====
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      pauseStartRef.current = engine.currentTime
      setGameState('paused')
    } else if (gameState === 'paused') {
      void resume().then(() => {
        startTimeRef.current += engine.currentTime - pauseStartRef.current
        setGameState('playing')
      })
    }
  }, [gameState, engine, resume])

  // ===== 自动演示切换 =====
  const toggleAutoPlay = useCallback(() => {
    const next = !autoPlayRef.current
    autoPlayRef.current = next
    setAutoPlay(next)
    if (next) {
      // 跳过已过音符，避免一次性爆发
      const s = songRef.current
      if (s) {
        const t = engine.currentTime - startTimeRef.current
        for (let i = 0; i < s.notes.length; i++) {
          if (s.notes[i].time < t) autoPlayedRef.current.add(i)
        }
      }
    }
  }, [engine])

  // ===== 按键处理 =====
  const handlePress = useCallback((_key: string, midi: number) => {
    if (gameState !== 'playing') return
    if (autoPlayRef.current) return // 自动演示不判定
    engine.playNote(midi, { timbre: timbreRef.current })
    const t = engine.currentTime - startTimeRef.current
    const result = judger.onInput(midi, t)
    if (result) {
      setStats(judger.getStats())
    }
  }, [gameState, engine, judger])

  const handleOctaveChange = useCallback((o: number) => setOctave(o), [])

  // ===== 应按高亮键集合 =====
  const activeKeys = useMemo(() => {
    const set = new Set<string>()
    if (!song || gameState !== 'playing') return set
    for (let i = 0; i < song.notes.length; i++) {
      const note = song.notes[i]
      const dt = note.time - currentTime
      if (dt < -ACTIVE_WINDOW_SEC || dt > ACTIVE_WINDOW_SEC) continue
      const mapped = mapper.midiToKey(note.midi)
      if (mapped.key) set.add(mapped.key)
    }
    return set
  }, [song, currentTime, gameState, mapper])

  const diffMeta = song ? DIFFICULTY_META[song.difficulty] : null

  return (
    <div
      className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden"
      style={{ background: 'var(--piano-background)' }}
    >
      <PortraitWarning />
      {/* ===== 曲目信息条 ===== */}
      <div
        className="shrink-0 h-12 flex items-center gap-3 px-4"
        style={{ background: 'var(--piano-card)', borderBottom: '1px solid var(--piano-border)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          data-dom-id="back-home"
          className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md transition-opacity hover:opacity-80"
          style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
          aria-label="返回首页"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="truncate"
          style={{
            fontFamily: 'var(--piano-font-display)',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--piano-foreground)',
          }}
        >
          {song?.title ?? '加载中...'}
        </span>
        {song && diffMeta && (
          <span
            className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 shrink-0"
            style={{ background: diffMeta.bg, color: diffMeta.color, fontSize: '11px' }}
          >
            {diffMeta.label}
          </span>
        )}
        {song && (
          <span
            className="whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '12px', color: 'var(--piano-muted-foreground)' }}
          >
            {song.bpm} BPM
          </span>
        )}
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          onClick={endGame}
          data-dom-id="cta-results"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 whitespace-nowrap transition-opacity hover:opacity-90"
          style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)', fontSize: '13px', fontWeight: 500 }}
        >
          <Flag className="h-3.5 w-3.5" />
          <span>结束本曲</span>
        </button>

        {/* 摄像头开关（弹奏时可见自己） */}
        <button
          type="button"
          onClick={() => setCameraOn((v) => !v)}
          aria-label={cameraOn ? '关闭摄像头' : '开启摄像头'}
          aria-pressed={cameraOn}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-opacity hover:opacity-90"
          style={{
            background: cameraOn ? 'var(--piano-pink)' : 'var(--piano-card)',
            color: cameraOn ? 'var(--piano-primary-foreground)' : 'var(--piano-foreground)',
            border: '1px solid ' + (cameraOn ? 'var(--piano-pink)' : 'var(--piano-border)'),
            fontSize: '13px',
          }}
        >
          <span>{cameraOn ? '●' : '○'}</span>
          <span className="hidden sm:inline">摄像头</span>
        </button>
      </div>

      {/* ===== HUD ===== */}
      <div className="shrink-0 px-4 py-2">
        <HUD
          stats={stats}
          currentTime={currentTime}
          totalTime={song?.durationSec ?? 0}
        />
      </div>

      {/* ===== 中央舞台 ===== */}
      <div ref={stageRef} className="flex-1 min-h-0 relative flex">
        <div className="flex-1 relative min-w-0">
          <FallingNotes
            notes={song?.notes ?? []}
            currentTime={currentTime}
            octave={octave}
            windowSec={3}
            judgedIds={judgedIds}
            height={stageHeight}
            className="w-full"
          />

          {/* 判定弹字叠加 */}
          <JudgmentPopup
            items={popupItems}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20"
          />

          {/* ScoreSheet 折叠按钮 */}
          <button
            type="button"
            onClick={() => setScoreSheetOpen(o => !o)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center h-12 w-7 rounded-l-md transition-opacity hover:opacity-80"
            style={{ background: 'var(--piano-card)', color: 'var(--piano-muted-foreground)', border: '1px solid var(--piano-border)', borderRight: 'none' }}
            aria-label={scoreSheetOpen ? '收起乐谱' : '展开乐谱'}
          >
            {scoreSheetOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* ScoreSheet 面板（占位，Task 23 填充） */}
          {scoreSheetOpen && (
            <div
              className="absolute right-0 top-0 bottom-0 w-64 z-20 flex flex-col p-4 gap-2"
              style={{ background: 'var(--piano-card)', borderLeft: '1px solid var(--piano-border)' }}
            >
              <h3
                className="text-sm font-semibold"
                style={{ fontFamily: 'var(--piano-font-display)', color: 'var(--piano-foreground)' }}
              >
                乐谱
              </h3>
              <p className="text-xs" style={{ color: 'var(--piano-muted-foreground)' }}>
                乐谱加载中...
              </p>
            </div>
          )}

          {/* 加载占位 */}
          {!song && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--piano-muted-foreground)' }}>曲目加载中...</p>
            </div>
          )}

          {/* 准备 / 暂停 遮罩 */}
          {(gameState === 'ready' || gameState === 'paused') && song && (
            <div
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4"
              style={{ background: 'color-mix(in srgb, var(--piano-background) 72%, transparent)' }}
            >
              <h2
                style={{
                  fontFamily: 'var(--piano-font-display)',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'var(--piano-foreground)',
                }}
              >
                {gameState === 'paused' ? '已暂停' : song.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--piano-muted-foreground)' }}>
                {gameState === 'paused' ? '点击继续恢复游戏' : '跟随下落音符按下对应键，准时按下获得 Perfect'}
              </p>
              <button
                type="button"
                onClick={gameState === 'paused' ? togglePause : () => { void beginGame() }}
                className="inline-flex items-center gap-2 rounded-md px-8 py-3 text-base font-semibold transition-transform hover:scale-[1.02]"
                style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)' }}
              >
                <Play className="h-5 w-5" />
                <span>{gameState === 'paused' ? '继续' : '开始'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== 控制条 ===== */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-2"
        style={{ background: 'var(--piano-card)', borderTop: '1px solid var(--piano-border)' }}
      >
        <button
          type="button"
          onClick={togglePause}
          disabled={gameState !== 'playing' && gameState !== 'paused'}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)', fontSize: '12px' }}
        >
          {gameState === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          <span>{gameState === 'paused' ? '继续' : '暂停'}</span>
        </button>
        <button
          type="button"
          onClick={() => { void beginGame() }}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-opacity hover:opacity-80"
          style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)', fontSize: '12px' }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>重启</span>
        </button>
        <button
          type="button"
          onClick={toggleAutoPlay}
          data-active={autoPlay}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-opacity hover:opacity-80"
          style={{
            background: autoPlay ? 'color-mix(in srgb, var(--piano-cyan-400) 20%, transparent)' : 'var(--piano-muted)',
            color: autoPlay ? 'var(--piano-cyan-400)' : 'var(--piano-foreground)',
            border: '1px solid var(--piano-border)',
            fontSize: '12px',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>自动演示</span>
        </button>
        <div className="flex-1" />
        {autoPlay && (
          <span className="text-xs" style={{ fontFamily: 'var(--piano-font-mono)', color: 'var(--piano-cyan-400)' }}>
            自动演示中
          </span>
        )}
      </div>

      {/* ===== 键盘 ===== */}
      <div className="shrink-0 px-2 pb-2" style={{ background: 'var(--piano-card)' }}>
        <PianoKeyboard
          mode="follow"
          activeKeys={activeKeys}
          onKeyPress={handlePress}
          initialOctave={4}
          onOctaveChange={handleOctaveChange}
        />
      </div>

      {/* ====== 摄像头画中画（弹奏时可见自己） ====== */}
      <CameraPiP enabled={cameraOn} onToggle={setCameraOn} />
    </div>
  )
}
