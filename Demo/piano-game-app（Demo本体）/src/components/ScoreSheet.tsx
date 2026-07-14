// 简化版五线谱组件：用纯 SVG 绘制音符，支持高亮当前播放音符
// 不依赖 opensheetmusicdisplay，包体积可控

export interface ScoreSheetProps {
  notes: { midi: number; time: number; duration: number }[]
  bpm?: number
  currentNoteIndex?: number  // 高亮当前播放音符
  className?: string
}

// midi → 五线谱 Y 偏移（以五线谱底线为 0，向上为正）
// 五线谱按自然音级，不是半音；C4=60 对应下加一线（offset 0）
function midiToStaffOffset(midi: number): number {
  // 自然音级（C D E F G A B）对应的线/间偏移
  const noteOffsets: Record<number, number> = {
    0: 0,   // C
    2: 1,   // D
    4: 2,   // E
    5: 3,   // F
    7: 4,   // G
    9: 5,   // A
    11: 6,  // B
  }
  // C4=60 → octave -1，C5=72 → octave 0
  const octave = Math.floor(midi / 12) - 5
  const note = midi % 12
  const isBlack = ![0, 2, 4, 5, 7, 9, 11].includes(note)
  // 黑键取其下方自然音级（如 C# → C）
  const naturalNote = isBlack ? note - 1 : note
  const baseOffset = noteOffsets[naturalNote] ?? 0
  return baseOffset + octave * 7
}

// 判断是否为黑键（用于标注升号）
function isBlackKey(midi: number): boolean {
  return ![0, 2, 4, 5, 7, 9, 11].includes(midi % 12)
}

export default function ScoreSheet({ notes, bpm = 120, currentNoteIndex, className = '' }: ScoreSheetProps) {
  const lineSpacing = 12          // 五线谱线间距
  const baseY = 80                // 第五线（最高线）的 Y 坐标
  const pxPerSecond = bpm         // bpm 越高，单位时长占的像素越多
  const minNoteWidth = 32         // 单个音符最小占用宽度
  const maxNoteWidth = 100        // 单个音符最大占用宽度

  // 预计算每个音符的 X 坐标（按 duration 累积，间距随 duration 调整）
  let cursorX = 60
  const noteXs: number[] = []
  for (const note of notes) {
    noteXs.push(cursorX)
    const w = Math.max(minNoteWidth, Math.min(maxNoteWidth, note.duration * pxPerSecond))
    cursorX += w
  }
  const width = Math.max(400, cursorX + 40)

  return (
    <div
      className={`overflow-x-auto ${className}`}
      style={{ background: 'var(--piano-card)', borderRadius: 'var(--piano-radius-lg)' }}
    >
      <svg width={width} height={160} style={{ minWidth: '100%', display: 'block' }}>
        {/* 五线谱：5 条横线 */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={i}
            x1={40}
            y1={baseY + i * lineSpacing}
            x2={width - 20}
            y2={baseY + i * lineSpacing}
            stroke="var(--piano-muted-foreground)"
            strokeWidth={1}
          />
        ))}

        {/* 高音谱号 */}
        <text
          x={10}
          y={baseY + 3 * lineSpacing + 8}
          fontSize={40}
          fill="var(--piano-foreground)"
        >𝄞</text>

        {/* 音符 */}
        {notes.map((note, idx) => {
          const offset = midiToStaffOffset(note.midi)
          const x = noteXs[idx]
          // offset 0 对应下加一线（位于第一线之下一个 lineSpacing）
          // offset 每增 1，Y 上移半个间距
          const y = baseY + 4 * lineSpacing - offset * (lineSpacing / 2) + lineSpacing
          const isCurrent = idx === currentNoteIndex
          const black = isBlackKey(note.midi)
          const noteColor = isCurrent ? 'var(--state-success)' : 'var(--piano-foreground)'
          return (
            <g key={idx}>
              {/* 下加线：当下加一线（offset 0）或更低时补一条短横线 */}
              {offset <= 0 && (
                <line
                  x1={x - 7}
                  y1={baseY + 4 * lineSpacing + lineSpacing}
                  x2={x + 7}
                  y2={baseY + 4 * lineSpacing + lineSpacing}
                  stroke="var(--piano-muted-foreground)"
                  strokeWidth={1}
                />
              )}
              {/* 升号 */}
              {black && (
                <text
                  x={x - 10}
                  y={y + 4}
                  fontSize={14}
                  fill="var(--piano-muted-foreground)"
                >♯</text>
              )}
              {/* 符头（椭圆，倾斜 -20°） */}
              <ellipse
                cx={x}
                cy={y}
                rx={5}
                ry={4}
                fill={noteColor}
                transform={`rotate(-20 ${x} ${y})`}
              />
              {/* 符干 */}
              <line
                x1={x + 5}
                y1={y}
                x2={x + 5}
                y2={y - 25}
                stroke={noteColor}
                strokeWidth={1.5}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
