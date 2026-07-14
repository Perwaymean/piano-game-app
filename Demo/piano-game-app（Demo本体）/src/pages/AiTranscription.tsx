import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, ShieldCheck, ChevronRight, Info } from 'lucide-react'
import { transcribeAudio } from '@/engine/transcription'
import type { TranscriptionResult } from '@/engine/transcription'
import { addAiSong, type AiSongRecord } from '@/engine/storage'

// ============================================================
// 类型定义
// ============================================================

type Status = 'idle' | 'processing' | 'done' | 'error'

// ============================================================
// 常量
// ============================================================

const SUPPORTED_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'mp4']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const STAGES = ['解码音频', 'Basic Pitch 推理', '生成乐谱']
const WEBGL_SUPPORTED = (() => {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'))
  } catch {
    return false
  }
})()

// ============================================================
// 辅助函数
// ============================================================

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getStage(progress: number): { label: string; index: number } {
  if (progress < 15) return { label: '解码音频...', index: 0 }
  if (progress < 90) return { label: 'Basic Pitch 推理中...', index: 1 }
  return { label: '生成乐谱...', index: 2 }
}

// ============================================================
// 主组件
// ============================================================

export default function AiTranscription() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const midInputRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef(0)

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // 计时器
  useEffect(() => {
    if (status !== 'processing') return
    startTimeRef.current = Date.now()
    setElapsed(0)
    const timer = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000)
    }, 100)
    return () => clearInterval(timer)
  }, [status])

  // ============================================================
  // 事件处理
  // ============================================================

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!SUPPORTED_FORMATS.includes(ext)) {
      setToast('仅支持 WAV/MP3/OGG/FLAC/MP4')
      return
    }
    if (file.size > MAX_SIZE) {
      setToast('文件超过 10MB 限制')
      return
    }
    setFileName(file.name)
    setProgress(0)
    setResult(null)
    setStatus('processing')

    try {
      const res = await transcribeAudio(file, (p) => {
        setProgress(Math.round(p * 100))
      })
      setResult(res)
      setStatus('done')
    } catch (err) {
      console.error('转谱失败:', err)
      setToast(err instanceof Error ? err.message : '转谱失败，请重试')
      setStatus('error')
    }
  }, [])

  const handleMidFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'mid' && ext !== 'midi') {
      setToast('请选择 .mid 文件')
      return
    }
    setFileName(file.name)
    setProgress(50)
    setStatus('processing')
    try {
      const { Midi } = await import('@tonejs/midi')
      const arrayBuffer = await file.arrayBuffer()
      const midi = new Midi(arrayBuffer)
      // 从所有 track 收集音符
      const notes: { midi: number; time: number; duration: number }[] = []
      for (const track of midi.tracks) {
        for (const n of track.notes) {
          notes.push({
            midi: n.midi,
            time: n.time,
            duration: Math.max(0.1, n.duration),
          })
        }
      }
      notes.sort((a, b) => a.time - b.time)
      const result: TranscriptionResult = {
        notes,
        durationSec: midi.duration,
        bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
        noteCount: notes.length,
      }
      setResult(result)
      setProgress(100)
      setStatus('done')
    } catch (err) {
      console.error('MIDI 解析失败:', err)
      setToast('MIDI 文件解析失败')
      setStatus('error')
    }
  }, [])

  const handleCancel = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setResult(null)
    setElapsed(0)
  }, [])

  const handleEnterFollow = useCallback(async () => {
    if (!result) return
    const timestamp = Date.now()
    const songKey = 'ai-' + timestamp

    // 1. 存入 sessionStorage 供跟弹页即时读取
    sessionStorage.setItem(songKey, JSON.stringify(result))

    // 2. 存入 IndexedDB 曲库（持久化，可在曲库中看到）
    const aiSong: AiSongRecord = {
      id: songKey,
      title: fileName ? fileName.replace(/\.[^.]+$/, '') : 'AI 转谱曲目',
      notes: result.notes.map(n => ({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: 0.8,
      })),
      durationSec: result.durationSec,
      bpm: result.bpm,
      noteCount: result.noteCount,
      timestamp,
      gradient: ['#a855f7', '#06b6d4'],
    }
    await addAiSong(aiSong)

    navigate(`/follow-play?song=${songKey}`)
  }, [result, navigate, fileName])

  // ============================================================
  // 降级：WebGL 不支持
  // ============================================================

  if (!WEBGL_SUPPORTED) {
    return (
      <div
        className="mx-auto w-full max-w-[800px] px-4 sm:px-6"
        style={{ paddingTop: 80, paddingBottom: 48 }}
      >
        <div className="mb-6">
          <h1
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--piano-foreground)',
            }}
          >
            AI 转谱
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: 'var(--piano-font-body)',
              fontSize: 14,
              color: 'var(--piano-muted-foreground)',
            }}
          >
            上传音频，AI 自动生成可弹奏的谱面
          </p>
        </div>
        <div
          className="text-center"
          style={{
            border: '1px solid var(--piano-border)',
            borderRadius: 'var(--piano-radius-lg)',
            padding: 48,
            backgroundColor: 'var(--piano-card)',
          }}
        >
          <div
            className="flex justify-center mb-4"
            style={{ color: 'var(--state-error)' }}
          >
            <Info style={{ width: 48, height: 48 }} />
          </div>
          <p
            style={{
              fontFamily: 'var(--piano-font-body)',
              fontSize: 16,
              color: 'var(--piano-foreground)',
            }}
          >
            您的浏览器不支持 AI 转谱，请使用曲库练习
          </p>
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="mt-4"
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--piano-primary-foreground)',
              backgroundColor: 'var(--piano-primary)',
              border: 'none',
              borderRadius: 'var(--piano-radius-md)',
              padding: '10px 24px',
              cursor: 'pointer',
            }}
          >
            前往曲库
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // 正常渲染
  // ============================================================

  const stage = getStage(progress)
  const clampedProgress = Math.min(100, progress)

  return (
    <div
      className="mx-auto w-full max-w-[800px] px-4 sm:px-6"
      style={{ paddingTop: 80, paddingBottom: 48 }}
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2"
          style={{
            backgroundColor: 'var(--piano-popover)',
            border: '1px solid var(--state-error)',
            borderRadius: 'var(--piano-radius-md)',
            fontFamily: 'var(--piano-font-body)',
            fontSize: 14,
            color: 'var(--piano-foreground)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      {/* 页面标题 */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--piano-font-display)',
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--piano-foreground)',
          }}
        >
          AI 转谱
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: 'var(--piano-font-body)',
            fontSize: 14,
            color: 'var(--piano-muted-foreground)',
          }}
        >
          上传音频，AI 自动生成可弹奏的谱面
        </p>
      </div>

      {/* ============================================================ */}
      {/* 1. 上传区（status === 'idle'） */}
      {/* ============================================================ */}

      {status === 'idle' && (
        <section className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.ogg,.flac,.mp4"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
          <input
            ref={midInputRef}
            type="file"
            accept=".mid,.midi"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleMidFile(file)
              e.target.value = ''
            }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="上传音频文件，支持拖拽或点击选择"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            className="text-center cursor-pointer transition-colors"
            style={{
              border: `2px dashed ${dragOver ? 'var(--piano-primary)' : 'var(--piano-border)'}`,
              borderRadius: 'var(--piano-radius-lg)',
              height: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              backgroundColor: dragOver ? 'var(--piano-muted)' : 'transparent',
            }}
          >
            <div
              className="flex justify-center mb-2"
              style={{ color: 'var(--piano-muted-foreground)' }}
            >
              <UploadCloud style={{ width: 48, height: 48 }} />
            </div>
            <p
              style={{
                fontFamily: 'var(--piano-font-body)',
                fontSize: 16,
                color: 'var(--piano-foreground)',
              }}
            >
              拖拽音频文件到此处，或点击选择
            </p>
            <p
              className="mt-2"
              style={{
                fontFamily: 'var(--piano-font-mono)',
                fontSize: 12,
                color: 'var(--piano-muted-foreground)',
              }}
            >
              WAV / MP3 / OGG / FLAC / MP4
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: 'var(--piano-font-body)',
                fontSize: 12,
                color: 'var(--piano-muted-foreground)',
              }}
            >
              ≤ 10MB
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <ShieldCheck
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--piano-cyan-400)' }}
              />
              <span
                style={{
                  fontFamily: 'var(--piano-font-body)',
                  fontSize: 12,
                  color: 'var(--piano-cyan-400)',
                }}
              >
                文件仅在本地浏览器处理，不上传服务器
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                midInputRef.current?.click()
              }}
              style={{
                fontFamily: 'var(--piano-font-body)',
                fontSize: 12,
                color: 'var(--piano-purple-400)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              直传 .mid 文件跳过 AI
            </button>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 2. 进度区（status === 'processing'） */}
      {/* ============================================================ */}

      {status === 'processing' && (
        <section
          className="mb-6"
          style={{
            backgroundColor: 'var(--piano-card)',
            border: '1px solid var(--piano-border)',
            borderRadius: 'var(--piano-radius-lg)',
            padding: 20,
          }}
        >
          {/* 状态行 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full opacity-75"
                  style={{
                    borderRadius: 'var(--piano-radius-full)',
                    backgroundColor: 'var(--piano-primary)',
                  }}
                />
                <span
                  className="relative inline-flex h-2 w-2"
                  style={{
                    borderRadius: 'var(--piano-radius-full)',
                    backgroundColor: 'var(--piano-primary)',
                  }}
                />
              </span>
              <span
                className="whitespace-nowrap truncate"
                style={{
                  fontFamily: 'var(--piano-font-body)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--piano-foreground)',
                }}
              >
                {stage.label}
              </span>
            </div>
            <span
              className="whitespace-nowrap shrink-0"
              style={{
                fontFamily: 'var(--piano-font-mono)',
                fontSize: 14,
                color: 'var(--piano-foreground)',
              }}
            >
              {Math.round(clampedProgress)}%
            </span>
          </div>

          {/* 进度条 */}
          <div
            role="progressbar"
            aria-valuenow={Math.round(clampedProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="AI 转谱进度"
            className="w-full mb-4"
            style={{
              height: 8,
              backgroundColor: 'var(--piano-muted)',
              borderRadius: 'var(--piano-radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${clampedProgress}%`,
                height: '100%',
                background:
                  'linear-gradient(to right, var(--piano-primary), var(--piano-cyan-400))',
                borderRadius: 'var(--piano-radius-full)',
                transition: 'width 200ms ease-out',
              }}
            />
          </div>

          {/* 阶段面包屑 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {STAGES.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span
                  className="whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--piano-font-body)',
                    fontSize: 12,
                    fontWeight: i === stage.index ? 600 : 400,
                    color:
                      i === stage.index
                        ? 'var(--piano-primary)'
                        : i < stage.index
                          ? 'var(--piano-cyan-400)'
                          : 'var(--piano-muted-foreground)',
                  }}
                >
                  {s}
                </span>
                {i < STAGES.length - 1 && (
                  <ChevronRight
                    className="w-4 h-4 shrink-0"
                    style={{ color: 'var(--piano-muted-foreground)' }}
                  />
                )}
              </span>
            ))}
          </div>

          {/* 计时器 + 取消 */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="whitespace-nowrap truncate min-w-0"
              style={{
                fontFamily: 'var(--piano-font-mono)',
                fontSize: 12,
                color: 'var(--piano-muted-foreground)',
              }}
            >
              {fileName} · 已用 {formatDuration(elapsed)}
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 whitespace-nowrap shrink-0"
              style={{
                fontFamily: 'var(--piano-font-body)',
                fontSize: 13,
                color: 'var(--piano-muted-foreground)',
                border: '1px solid var(--piano-border)',
                borderRadius: 'var(--piano-radius-md)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 3. 结果预览区（status === 'done'） */}
      {/* ============================================================ */}

      {status === 'done' && result && (
        <section className="mb-6">
          <h2
            className="mb-4"
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--piano-foreground)',
            }}
          >
            识别结果
          </h2>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div
              className="text-center min-w-0"
              style={{
                border: '1px solid var(--piano-border)',
                borderRadius: 'var(--piano-radius-md)',
                padding: 16,
              }}
            >
              <div
                className="whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-mono)',
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--piano-foreground)',
                  lineHeight: 1.2,
                }}
              >
                {result.noteCount}
              </div>
              <div
                className="mt-1 whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-body)',
                  fontSize: 12,
                  color: 'var(--piano-muted-foreground)',
                }}
              >
                音符数
              </div>
            </div>
            <div
              className="text-center min-w-0"
              style={{
                border: '1px solid var(--piano-border)',
                borderRadius: 'var(--piano-radius-md)',
                padding: 16,
              }}
            >
              <div
                className="whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-mono)',
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--piano-foreground)',
                  lineHeight: 1.2,
                }}
              >
                {formatDuration(result.durationSec)}
              </div>
              <div
                className="mt-1 whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-body)',
                  fontSize: 12,
                  color: 'var(--piano-muted-foreground)',
                }}
              >
                时长
              </div>
            </div>
            <div
              className="text-center min-w-0"
              style={{
                border: '1px solid var(--piano-border)',
                borderRadius: 'var(--piano-radius-md)',
                padding: 16,
              }}
            >
              <div
                className="whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-mono)',
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--piano-foreground)',
                  lineHeight: 1.2,
                }}
              >
                {result.bpm}
              </div>
              <div
                className="mt-1 whitespace-nowrap"
                style={{
                  fontFamily: 'var(--piano-font-body)',
                  fontSize: 12,
                  color: 'var(--piano-muted-foreground)',
                }}
              >
                估算BPM
              </div>
            </div>
          </div>

          {/* 五线谱预览（SVG） */}
          <div
            className="mb-3"
            style={{
              height: 120,
              backgroundColor: 'var(--piano-card)',
              border: '1px solid var(--piano-border)',
              borderRadius: 'var(--piano-radius-md)',
              padding: 12,
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 96"
              preserveAspectRatio="none"
            >
              {/* 5 条五线谱横线 */}
              {[20, 35, 50, 65, 80].map((y) => (
                <line
                  key={y}
                  x1="10"
                  y1={y}
                  x2="390"
                  y2={y}
                  stroke="var(--piano-muted-foreground)"
                  strokeWidth="1"
                  opacity="0.5"
                />
              ))}
              {/* 谱表左竖线 */}
              <line
                x1="10"
                y1="20"
                x2="10"
                y2="80"
                stroke="var(--piano-muted-foreground)"
                strokeWidth="2"
                opacity="0.6"
              />
              {/* 随机音符点 */}
              {result.notes.slice(0, 15).map((note, i) => {
                const x = 30 + i * 24
                const y = 80 - ((note.midi - 60) / 24) * 60
                return (
                  <ellipse
                    key={i}
                    cx={x}
                    cy={y}
                    rx="5"
                    ry="4"
                    fill="var(--piano-primary)"
                    opacity="0.9"
                  />
                )
              })}
            </svg>
          </div>

          {/* 下落谱面缩略 */}
          <div
            className="mb-4 relative overflow-hidden"
            style={{
              height: 120,
              backgroundColor: 'var(--piano-card)',
              border: '1px solid var(--piano-border)',
              borderRadius: 'var(--piano-radius-md)',
              padding: 8,
            }}
          >
            {/* 7 列分割线 */}
            <div className="absolute inset-0 flex pointer-events-none" style={{ padding: 8 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    borderRight:
                      i < 6
                        ? '1px solid color-mix(in srgb, var(--piano-border) 50%, transparent)'
                        : 'none',
                  }}
                />
              ))}
            </div>
            {/* 10 个音符块 */}
            {result.notes.slice(0, 10).map((note, i) => {
              const col = note.midi % 7
              const colWidthPct = 100 / 7
              const left = col * colWidthPct
              const top = (i / 10) * 88
              const isWhite = note.midi % 2 === 0
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `calc(${left}% + 4px)`,
                    width: `calc(${colWidthPct}% - 8px)`,
                    top: `${top}%`,
                    height: 8,
                    borderRadius: 2,
                    background: isWhite
                      ? 'linear-gradient(to bottom, var(--piano-purple-400), var(--piano-purple-600))'
                      : 'linear-gradient(to bottom, var(--piano-pink-400), var(--piano-pink))',
                    opacity: 0.85,
                  }}
                />
              )
            })}
          </div>

          {/* 免责声明 */}
          <div className="flex items-center gap-1.5">
            <Info
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: 'var(--piano-muted-foreground)' }}
            />
            <span
              style={{
                fontFamily: 'var(--piano-font-body)',
                fontSize: 12,
                color: 'var(--piano-muted-foreground)',
              }}
            >
              AI 识别结果仅供参考，可能存在误差
            </span>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 4. 主 CTA */}
      {/* ============================================================ */}

      {status === 'done' && (
        <section className="mb-8 flex justify-center">
          <button
            type="button"
            data-dom-id="cta-enter-follow"
            onClick={handleEnterFollow}
            className="whitespace-nowrap"
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--piano-primary-foreground)',
              backgroundColor: 'var(--piano-primary)',
              border: 'none',
              borderRadius: 'var(--piano-radius-md)',
              padding: '12px 32px',
              cursor: 'pointer',
            }}
          >
            进入跟弹
          </button>
        </section>
      )}
    </div>
  )
}
