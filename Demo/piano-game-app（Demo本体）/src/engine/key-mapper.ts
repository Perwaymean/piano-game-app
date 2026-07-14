// M05: 键盘 → MIDI 映射器（2 八度 24 键）
// 标准虚拟钢琴布局：
//   下八度白键: Z X C V B N M  → C D E F G A B
//   下八度黑键: S D G H J      → C# D# F# G# A#
//   上八度白键: Q W E R T Y U  → C D E F G A B
//   上八度黑键: 2 3 5 6 7      → C# D# F# G# A#
// ← / → 方向键平移 2 八度窗口

// 下八度：白键字母 → 半音偏移（0-11）
export const WHITE_KEYS_LOWER: Record<string, number> = {
  'z': 0,   // C
  'x': 2,   // D
  'c': 4,   // E
  'v': 5,   // F
  'b': 7,   // G
  'n': 9,   // A
  'm': 11,  // B
}

// 下八度：黑键字母 → 半音偏移
export const BLACK_KEYS_LOWER: Record<string, number> = {
  's': 1,   // C#
  'd': 3,   // D#
  'g': 6,   // F#
  'h': 8,   // G#
  'j': 10,  // A#
}

// 上八度：白键字母 → 半音偏移（12-23）
export const WHITE_KEYS_UPPER: Record<string, number> = {
  'q': 12,  // C
  'w': 14,  // D
  'e': 16,  // E
  'r': 17,  // F
  't': 19,  // G
  'y': 21,  // A
  'u': 23,  // B
}

// 上八度：黑键字母 → 半音偏移
export const BLACK_KEYS_UPPER: Record<string, number> = {
  '2': 13,  // C#
  '3': 15,  // D#
  '5': 18,  // F#
  '6': 20,  // G#
  '7': 22,  // A#
}

// 所有白键（下+上）
export const WHITE_KEYS: Record<string, number> = {
  ...WHITE_KEYS_LOWER,
  ...WHITE_KEYS_UPPER,
}

// 所有黑键（下+上）
export const BLACK_KEYS: Record<string, number> = {
  ...BLACK_KEYS_LOWER,
  ...BLACK_KEYS_UPPER,
}

// 所有可用键
export const ALL_KEYS: Record<string, number> = { ...WHITE_KEYS, ...BLACK_KEYS }

// 兼容旧导出（FreePlay 的 KEY_ORDER 引用）
export const OCTAVE_DOWN_KEY = 'arrowleft'
export const OCTAVE_UP_KEY = 'arrowright'

export const DEFAULT_OCTAVE = 4
export const MIDI_C4 = 60

// 可见八度跨度
export const OCTAVE_SPAN = 2

export interface MappedKey {
  key: string
  midi: number
  isBlack: boolean
  noteName: string
  isShifted: boolean
}

export interface MidiToKeyResult {
  key: string | null
  isShifted: boolean
  octaveUsed: number
}

export function noteToMidi(note: string): number {
  const match = note.match(/^([A-G])(#|b)?(-?\d+)$/)
  if (!match) throw new Error(`Invalid note: ${note}`)
  const letter = match[1]
  const accidental = match[2]
  const octaveStr = match[3]
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let offset = base[letter]
  if (accidental === '#') offset += 1
  else if (accidental === 'b') offset -= 1
  const octave = parseInt(octaveStr, 10)
  return (octave + 1) * 12 + offset
}

export function midiToNote(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  const name = notes[midi % 12]
  return `${name}${octave}`
}

export function octaveToMidiC(octave: number): number {
  return (octave + 1) * 12
}

export class KeyMapper {
  // 下八度的根 C（如 octave=4 → C4=60，窗口覆盖 C4-B5）
  private octave: number = DEFAULT_OCTAVE

  getOctave(): number { return this.octave }

  setOctave(o: number): void {
    // 限制在 1-6 之间（窗口覆盖 C1-B2 到 C6-B7）
    this.octave = Math.max(1, Math.min(6, o))
  }

  octaveUp(): number {
    this.setOctave(this.octave + 1)
    return this.octave
  }

  octaveDown(): number {
    this.setOctave(this.octave - 1)
    return this.octave
  }

  isOctaveControl(key: string): boolean {
    const k = key.toLowerCase()
    return k === 'arrowleft' || k === 'arrowright'
  }

  handleOctaveKey(key: string): number {
    const k = key.toLowerCase()
    if (k === 'arrowleft' || k === 'z') return this.octaveDown()
    if (k === 'arrowright' || k === 'x') return this.octaveUp()
    return this.octave
  }

  // 物理键 → MIDI（在当前 2 八度窗口下）
  keyToMidi(key: string): number | null {
    const k = key.toLowerCase()
    const offset = ALL_KEYS[k]
    if (offset === undefined) return null
    return octaveToMidiC(this.octave) + offset
  }

  keyToMapped(key: string): MappedKey | null {
    const midi = this.keyToMidi(key)
    if (midi === null) return null
    const k = key.toLowerCase()
    const isBlack = k in BLACK_KEYS
    return {
      key: k,
      midi,
      isBlack,
      noteName: midiToNote(midi),
      isShifted: false,
    }
  }

  // MIDI → 物理键（跟弹页用）
  // 若在当前 2 八度窗口内，直接返回对应键
  // 若不在，折叠到窗口内并标记 isShifted
  midiToKey(midi: number): MidiToKeyResult {
    const currentC = octaveToMidiC(this.octave)
    const offset = midi - currentC  // 相对下八度根 C 的偏移

    // 可见范围：0-23（两个八度内的所有键）
    if (offset >= 0 && offset <= 23) {
      const key = this.findKeyByOffset(offset)
      return { key, isShifted: false, octaveUsed: this.octave }
    }

    // 超出可见范围：折叠到 0-23 内
    const shiftedOffset = ((offset % 24) + 24) % 24
    const key = this.findKeyByOffset(shiftedOffset)
    return { key, isShifted: true, octaveUsed: this.octave }
  }

  private findKeyByOffset(offset: number): string | null {
    for (const [k, o] of Object.entries(ALL_KEYS)) {
      if (o === offset) return k
    }
    return null
  }

  getAllMappedKeys(): MappedKey[] {
    return Object.keys(ALL_KEYS)
      .map(k => this.keyToMapped(k))
      .filter((m): m is MappedKey => m !== null)
  }
}

export function createKeyMapper(): KeyMapper {
  return new KeyMapper()
}
