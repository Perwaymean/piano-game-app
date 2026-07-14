import { useEffect, useRef } from 'react'
import { createKeyMapper, type KeyMapper } from '../engine/key-mapper'
import type { SongNote } from '../engine/song-data'

export interface FallingNotesProps {
  notes: SongNote[]
  currentTime: number
  octave: number                   // 下八度根 C 的八度号
  windowSec?: number
  judgedIds?: Set<string | number>
  height?: number
  className?: string
}

// 白键半音偏移（C D E F G A B）
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

// 黑键定义：半音偏移 + 在前一个白键右侧的偏移比例
const BLACK_DEFS: { semitone: number; afterWhiteIdx: number }[] = [
  { semitone: 1, afterWhiteIdx: 0 },   // C#
  { semitone: 3, afterWhiteIdx: 1 },   // D#
  { semitone: 6, afterWhiteIdx: 3 },   // F#
  { semitone: 8, afterWhiteIdx: 4 },   // G#
  { semitone: 10, afterWhiteIdx: 5 },  // A#
]

const TOTAL_WHITE_KEYS = 14

interface VisibleNote extends SongNote {
  id: string
  physicalKey: string | null
  isBlack: boolean
  leftPct: number
  widthPct: number
  judged: boolean
  isLower: boolean // 下八度 or 上八度
}

export default function FallingNotes(props: FallingNotesProps) {
  const {
    notes,
    currentTime,
    octave,
    windowSec = 3,
    judgedIds,
    height = 480,
    className = '',
  } = props

  const mapperRef = useRef<KeyMapper | null>(null)
  if (!mapperRef.current) mapperRef.current = createKeyMapper()
  const mapper = mapperRef.current
  useEffect(() => { mapper.setOctave(octave) }, [mapper, octave])

  // 每个白键宽度
  const whiteWidthPct = 100 / TOTAL_WHITE_KEYS
  // 黑键宽度
  const blackWidthPct = whiteWidthPct * 0.6

  // 当前 2 八度窗口的 MIDI 基准
  const baseMidi = (octave + 1) * 12 // 下八度 C 的 MIDI

  // 缓存
  const midiPosCache = useRef<Map<number, { leftPct: number; widthPct: number; isBlack: boolean; isLower: boolean }>>(new Map())

  function getMidiPosition(midi: number): { leftPct: number; widthPct: number; isBlack: boolean; isLower: boolean } {
    const cached = midiPosCache.current.get(midi)
    if (cached) return cached

    // 折叠到 2 八度窗口内（0-23）
    const rawOffset = midi - baseMidi
    const offset = ((rawOffset % 24) + 24) % 24
    const octaveIdx = Math.floor(offset / 12) // 0=下八度, 1=上八度
    const noteInOctave = offset % 12
    const isBlack = ![0, 2, 4, 5, 7, 9, 11].includes(noteInOctave)
    const isLower = octaveIdx === 0

    let leftPct: number
    let widthPct: number

    if (!isBlack) {
      // 白键
      const whiteInOctave = WHITE_SEMITONES.indexOf(noteInOctave)
      const whiteIdx = octaveIdx * 7 + whiteInOctave
      leftPct = whiteIdx * whiteWidthPct
      widthPct = whiteWidthPct
    } else {
      // 黑键
      const bkDef = BLACK_DEFS.find(b => b.semitone === noteInOctave)
      if (bkDef) {
        const whiteIdx = octaveIdx * 7 + bkDef.afterWhiteIdx
        const centerPct = (whiteIdx + 0.7) * whiteWidthPct
        leftPct = centerPct - blackWidthPct / 2
        widthPct = blackWidthPct
      } else {
        leftPct = 0
        widthPct = whiteWidthPct
      }
    }

    const result = { leftPct, widthPct, isBlack, isLower }
    midiPosCache.current.set(midi, result)
    return result
  }

  // 计算可见音符
  const visibleNotes: VisibleNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const dt = note.time - currentTime
    if (dt < -0.3 || dt > windowSec) continue
    const id = String(i)
    const mapped = mapper.midiToKey(note.midi)
    const pos = getMidiPosition(note.midi)
    visibleNotes.push({
      ...note,
      id,
      physicalKey: mapped.key,
      isBlack: pos.isBlack,
      leftPct: pos.leftPct,
      widthPct: pos.widthPct,
      isLower: pos.isLower,
      judged: judgedIds?.has(id) ?? false,
    })
  }

  const computeTop = (noteTime: number): number => {
    const dt = noteTime - currentTime
    return (1 - dt / windowSec) * height
  }

  // 白键列背景
  const whiteKeyColumns: { leftPct: number; isC: boolean; isUpperStart: boolean }[] = []
  for (let i = 0; i < TOTAL_WHITE_KEYS; i++) {
    whiteKeyColumns.push({
      leftPct: i * whiteWidthPct,
      isC: i % 7 === 0,
      isUpperStart: i === 7,
    })
  }

  // 八度标签
  const octaveLabels = [
    { leftPct: 0, label: `C${octave}` },
    { leftPct: 7 * whiteWidthPct, label: `C${octave + 1}` },
  ]

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{
        height: `${height}px`,
        background: 'linear-gradient(to bottom, color-mix(in srgb, var(--piano-background) 60%, transparent), var(--piano-card))',
        border: '1px solid var(--piano-border)',
      }}
    >
      {/* 白键列分割线 */}
      <div className="absolute inset-0 pointer-events-none">
        {whiteKeyColumns.map((col, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${col.leftPct}%`,
              width: `${whiteWidthPct}%`,
              borderRight: col.isUpperStart
                ? '2px solid color-mix(in srgb, var(--piano-cyan-400) 50%, transparent)'
                : col.isC
                  ? '1px solid color-mix(in srgb, var(--piano-border) 70%, transparent)'
                  : '1px solid color-mix(in srgb, var(--piano-border) 25%, transparent)',
            }}
          />
        ))}
      </div>

      {/* 下八度背景着色（轻微区分） */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: '0%',
          width: `${7 * whiteWidthPct}%`,
          background: 'color-mix(in srgb, var(--piano-purple-700) 4%, transparent)',
        }}
      />
      {/* 上八度背景着色 */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `${7 * whiteWidthPct}%`,
          width: `${7 * whiteWidthPct}%`,
          background: 'color-mix(in srgb, var(--piano-cyan) 4%, transparent)',
        }}
      />

      {/* 八度标签 */}
      <div className="absolute top-1 left-0 right-0 pointer-events-none z-10">
        {octaveLabels.map((label) => (
          <span
            key={label.label}
            className="absolute text-[11px] font-mono font-semibold"
            style={{
              left: `${label.leftPct}%`,
              color: 'var(--piano-muted-foreground)',
              transform: 'translateX(3px)',
            }}
          >
            {label.label}
          </span>
        ))}
      </div>

      {/* 下落音符 */}
      {visibleNotes.map((note) => {
        const top = computeTop(note.time)
        const noteHeight = Math.max(16, note.duration * 100)

        // 颜色：下八度紫色系，上八度青色系
        const getColor = (isBlack: boolean, isLower: boolean, judged: boolean) => {
          if (judged) {
            return isLower
              ? 'linear-gradient(to bottom, color-mix(in srgb, var(--piano-purple-400) 25%, transparent), color-mix(in srgb, var(--piano-purple-600) 25%, transparent))'
              : 'linear-gradient(to bottom, color-mix(in srgb, var(--piano-cyan-400) 25%, transparent), color-mix(in srgb, var(--piano-cyan-600) 25%, transparent))'
          }
          if (isLower) {
            return isBlack
              ? 'linear-gradient(to bottom, var(--piano-pink-400), var(--piano-pink))'
              : 'linear-gradient(to bottom, var(--piano-purple-400), var(--piano-purple-600))'
          }
          return isBlack
            ? 'linear-gradient(to bottom, color-mix(in srgb, var(--piano-cyan) 70%, var(--piano-pink)), var(--piano-cyan))'
            : 'linear-gradient(to bottom, var(--piano-cyan-400), var(--piano-cyan-600))'
        }

        return (
          <div
            key={note.id}
            className="absolute rounded flex items-center justify-center"
            style={{
              top: `${top}px`,
              left: `${note.leftPct}%`,
              width: `${note.widthPct}%`,
              height: `${noteHeight}px`,
              background: getColor(note.isBlack, note.isLower, note.judged),
              opacity: note.judged ? 0.25 : 0.95,
              transform: note.judged ? 'scale(0.7)' : 'scale(1)',
              transition: 'opacity 200ms, transform 200ms',
              border: '1px solid color-mix(in srgb, var(--piano-foreground) 15%, transparent)',
              boxShadow: note.judged ? 'none' : '0 2px 6px rgba(0,0,0,0.3)',
              zIndex: note.isBlack ? 5 : 3,
            }}
          >
            {/* 键位提示 — 始终显示，确保所有音符块都有键位字母 */}
            {note.physicalKey && (
              <span
                style={{
                  fontFamily: 'var(--piano-font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--piano-primary-foreground)',
                  textTransform: 'uppercase',
                  opacity: 0.9,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {note.physicalKey}
              </span>
            )}
          </div>
        )
      })}

      {/* 底部判定线 */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-20"
        style={{
          bottom: '0',
          height: '3px',
          background: 'linear-gradient(to right, transparent, var(--piano-cyan-400), var(--piano-cyan-400), transparent)',
          boxShadow: '0 0 16px var(--piano-cyan-400), 0 0 32px color-mix(in srgb, var(--piano-cyan) 50%, transparent)',
        }}
      />
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          bottom: '3px',
          height: '50px',
          background: 'linear-gradient(to top, color-mix(in srgb, var(--piano-cyan-400) 12%, transparent), transparent)',
        }}
      />
    </div>
  )
}
