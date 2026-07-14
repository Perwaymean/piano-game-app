import { useState, useCallback, useRef } from 'react'
import { useKeyboardInput } from '../hooks/useKeyboardInput'
import { createKeyMapper, BLACK_KEYS, midiToNote, type KeyMapper } from '../engine/key-mapper'

export interface PianoKeyboardProps {
  mode: 'free' | 'follow'
  activeKeys?: Set<string>
  onKeyPress?: (key: string, midi: number) => void
  onKeyRelease?: (key: string, midi: number) => void
  onOctaveChange?: (octave: number) => void
  initialOctave?: number
  showLetters?: boolean
  enabled?: boolean
  className?: string
}

// 14 白键顺序（下八度 7 + 上八度 7）
const WHITE_KEY_ORDER = [
  'z', 'x', 'c', 'v', 'b', 'n', 'm',  // 下八度 C D E F G A B
  'q', 'w', 'e', 'r', 't', 'y', 'u',  // 上八度 C D E F G A B
]

// 黑键：键字母 + 相对左边白键的索引位置
// 黑键放在 leftKeyIdx 和 leftKeyIdx+1 之间，偏移 70%
const BLACK_KEY_DEFS: { key: string; leftKeyIdx: number }[] = [
  // 下八度黑键
  { key: 's', leftKeyIdx: 0 },  // C# 在 Z(0) 和 X(1) 之间
  { key: 'd', leftKeyIdx: 1 },  // D# 在 X(1) 和 C(2) 之间
  { key: 'g', leftKeyIdx: 3 },  // F# 在 V(3) 和 B(4) 之间
  { key: 'h', leftKeyIdx: 4 },  // G# 在 B(4) 和 N(5) 之间
  { key: 'j', leftKeyIdx: 5 },  // A# 在 N(5) 和 M(6) 之间
  // 上八度黑键
  { key: '2', leftKeyIdx: 7 },  // C# 在 Q(7) 和 W(8) 之间
  { key: '3', leftKeyIdx: 8 },  // D# 在 W(8) 和 E(9) 之间
  { key: '5', leftKeyIdx: 10 }, // F# 在 R(10) 和 T(11) 之间
  { key: '6', leftKeyIdx: 11 }, // G# 在 T(11) 和 Y(12) 之间
  { key: '7', leftKeyIdx: 12 }, // A# 在 Y(12) 和 U(13) 之间
]

const TOTAL_WHITE_KEYS = WHITE_KEY_ORDER.length // 14

export default function PianoKeyboard(props: PianoKeyboardProps) {
  const {
    mode,
    activeKeys,
    onKeyPress,
    onKeyRelease,
    onOctaveChange,
    initialOctave = 4,
    showLetters = true,
    enabled = true,
    className = '',
  } = props

  const mapperRef = useRef<KeyMapper | null>(null)
  if (!mapperRef.current) {
    mapperRef.current = createKeyMapper()
    mapperRef.current.setOctave(initialOctave)
  }
  const mapper = mapperRef.current
  const [octave, setOctave] = useState(initialOctave)

  const { pressedKeys } = useKeyboardInput({
    onPress: (key) => {
      const midi = mapper.keyToMidi(key)
      if (midi !== null) {
        onKeyPress?.(key, midi)
      }
    },
    onRelease: (key) => {
      const midi = mapper.keyToMidi(key)
      if (midi !== null) {
        onKeyRelease?.(key, midi)
      }
    },
    onOctaveUp: () => {
      const next = mapper.octaveUp()
      setOctave(next)
      onOctaveChange?.(next)
    },
    onOctaveDown: () => {
      const next = mapper.octaveDown()
      setOctave(next)
      onOctaveChange?.(next)
    },
    enabled,
  })

  const allPressed = new Set(pressedKeys)
  if (activeKeys) {
    activeKeys.forEach(k => allPressed.add(k))
  }

  const touchedKeysRef = useRef<Map<number, string>>(new Map())

  const handleTouchStart = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault()
    const midi = mapper.keyToMidi(key)
    if (midi !== null) {
      const touch = e.changedTouches[0]
      if (touch) touchedKeysRef.current.set(touch.identifier, key)
      onKeyPress?.(key, midi)
    }
  }, [mapper, onKeyPress])

  const handleTouchEnd = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault()
    const midi = mapper.keyToMidi(key)
    if (midi !== null) {
      const touch = e.changedTouches[0]
      if (touch) touchedKeysRef.current.delete(touch.identifier)
      onKeyRelease?.(key, midi)
    }
  }, [mapper, onKeyRelease])

  const swipeStartXRef = useRef<number | null>(null)
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0]
    if (touch) swipeStartXRef.current = touch.clientX
  }, [])
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const startX = swipeStartXRef.current
    if (startX === null) return
    const touch = e.changedTouches[0]
    swipeStartXRef.current = null
    if (!touch) return
    const deltaX = touch.clientX - startX
    if (Math.abs(deltaX) < 80) return
    if (deltaX > 0) {
      const next = mapper.octaveUp()
      setOctave(next)
      onOctaveChange?.(next)
    } else {
      const next = mapper.octaveDown()
      setOctave(next)
      onOctaveChange?.(next)
    }
  }, [mapper, onOctaveChange])

  const getKeyInfo = (key: string): { midi: number; noteName: string; isBlack: boolean } | null => {
    const midi = mapper.keyToMidi(key)
    if (midi === null) return null
    return {
      midi,
      noteName: midiToNote(midi),
      isBlack: key in BLACK_KEYS,
    }
  }

  const handleOctaveDown = () => {
    const next = mapper.octaveDown()
    setOctave(next)
    onOctaveChange?.(next)
  }
  const handleOctaveUp = () => {
    const next = mapper.octaveUp()
    setOctave(next)
    onOctaveChange?.(next)
  }

  // 每个白键宽度百分比
  const whiteWidthPct = 100 / TOTAL_WHITE_KEYS
  // 黑键宽度（白键的 60%）
  const blackWidthPct = whiteWidthPct * 0.6

  // 判断是否是下八度的键（用于颜色区分）
  const isLowerOctaveKey = (key: string): boolean => {
    return ['z', 'x', 'c', 'v', 'b', 'n', 'm', 's', 'd', 'g', 'h', 'j'].includes(key)
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-mode={mode}>
      {/* 八度指示 + 切换按钮 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ fontFamily: 'var(--piano-font-mono)', color: 'var(--piano-muted-foreground)' }}>
            音域
          </span>
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--piano-font-mono)', color: 'var(--piano-foreground)' }}>
            C{octave}-B{octave + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleOctaveDown}
            disabled={octave <= 1}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-xs font-mono disabled:opacity-40"
            style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
            aria-label="下一八度 (←)"
          >←</button>
          <button
            type="button"
            onClick={handleOctaveUp}
            disabled={octave >= 6}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-xs font-mono disabled:opacity-40"
            style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
            aria-label="上一八度 (→)"
          >→</button>
        </div>
      </div>

      {/* 钢琴键盘主体 */}
      <div
        className="relative w-full"
        style={{ height: '160px', minHeight: '110px' }}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {/* 八度分隔线（在第 7 个白键后） */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-20"
          style={{
            left: `${7 * whiteWidthPct}%`,
            width: '2px',
            background: 'color-mix(in srgb, var(--piano-cyan-400) 40%, transparent)',
          }}
        />

        {/* 白键容器（flex 等分） */}
        <div className="flex w-full h-full gap-0.5">
          {WHITE_KEY_ORDER.map((key, idx) => {
            const info = getKeyInfo(key)
            const isDown = allPressed.has(key)
            const isLower = idx < 7
            return (
              <button
                key={key}
                type="button"
                data-key={key}
                data-midi={info?.midi}
                onTouchStart={(e) => handleTouchStart(e, key)}
                onTouchEnd={(e) => handleTouchEnd(e, key)}
                onMouseDown={() => {
                  if (info) onKeyPress?.(key, info.midi)
                }}
                onMouseUp={() => {
                  if (info) onKeyRelease?.(key, info.midi)
                }}
                onMouseLeave={(e) => {
                  if (e.buttons > 0 && info) onKeyRelease?.(key, info.midi)
                }}
                className="flex-1 rounded-b-md flex flex-col items-center justify-end pb-2 gap-0.5 transition-transform"
                style={{
                  background: isDown
                    ? (isLower
                        ? 'linear-gradient(to bottom, var(--piano-purple-400), var(--piano-purple-600))'
                        : 'linear-gradient(to bottom, var(--piano-cyan-400), var(--piano-cyan-600))')
                    : 'linear-gradient(to bottom, #f5f3ff, #d8d4f0)',
                  color: isDown ? 'var(--piano-primary-foreground)' : '#1a1730',
                  transform: isDown ? 'translateY(2px)' : 'translateY(0)',
                  transition: 'transform 120ms cubic-bezier(.2,.8,.2,1), background 120ms',
                  border: '1px solid var(--piano-border)',
                  minHeight: '44px',
                  boxShadow: isDown ? 'inset 0 -2px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              >
                {showLetters && info && (
                  <>
                    <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                      {key}
                    </span>
                    <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '9px', opacity: 0.7 }}>
                      {info.noteName}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* 黑键（绝对定位） */}
        {BLACK_KEY_DEFS.map(({ key, leftKeyIdx }) => {
          const info = getKeyInfo(key)
          const isDown = allPressed.has(key)
          const isLower = isLowerOctaveKey(key)
          // 黑键中心位置 = (leftKeyIdx + 0.7) * whiteWidthPct
          const centerPct = (leftKeyIdx + 0.7) * whiteWidthPct
          return (
            <button
              key={key}
              type="button"
              data-key={key}
              data-midi={info?.midi}
              onTouchStart={(e) => handleTouchStart(e, key)}
              onTouchEnd={(e) => handleTouchEnd(e, key)}
              onMouseDown={() => {
                if (info) onKeyPress?.(key, info.midi)
              }}
              onMouseUp={() => {
                if (info) onKeyRelease?.(key, info.midi)
              }}
              onMouseLeave={(e) => {
                if (e.buttons > 0 && info) onKeyRelease?.(key, info.midi)
              }}
              className="absolute top-0 rounded-b-md flex flex-col items-center justify-end pb-1.5 gap-0.5 z-10"
              style={{
                left: `calc(${centerPct}% - ${blackWidthPct / 2}%)`,
                width: `${blackWidthPct}%`,
                height: '58%',
                background: isDown
                  ? (isLower
                      ? 'linear-gradient(to bottom, var(--piano-pink-400), var(--piano-pink))'
                      : 'linear-gradient(to bottom, var(--piano-cyan-400), var(--piano-cyan))')
                  : 'linear-gradient(to bottom, #1a1530, #0d0b1a)',
                color: isDown ? 'var(--piano-primary-foreground)' : '#a89fcf',
                transform: isDown ? 'translateY(2px)' : 'translateY(0)',
                transition: 'transform 120ms cubic-bezier(.2,.8,.2,1), background 120ms',
                border: '1px solid var(--piano-border)',
                boxShadow: isDown ? 'inset 0 -2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.4)',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              {showLetters && info && (
                <>
                  <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                    {key}
                  </span>
                  <span style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '9px', opacity: 0.75 }}>
                    {info.noteName}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
