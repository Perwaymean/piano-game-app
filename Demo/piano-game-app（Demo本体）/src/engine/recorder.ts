// 录音回放与 MIDI 导出模块
// 提供 Recorder 类（录音）、playback（回放）、exportMidi（MIDI 文件导出）、downloadMidi（下载）
// 纯 TS 模块，无 React 依赖

import type { AudioEngine, Timbre } from '@/engine/audio-engine'

// ============ 数据结构 ============

export interface RecordedNote {
  midi: number
  time: number       // 相对录制开始的秒数
  duration: number   // 秒
  velocity: number   // 0-1
}

export interface Recording {
  notes: RecordedNote[]
  durationSec: number
  bpm: number
  timbre: string
  createdAt: number
}

// ============ MIDI 编码辅助函数 ============

// VLQ（Variable Length Quantity）编码：MIDI 标准的可变长度字节编码
function encodeVLQ(value: number): number[] {
  if (value === 0) return [0]
  const bytes: number[] = []
  let v = value
  while (v > 0) {
    bytes.unshift(v & 0x7F)
    v >>= 7
  }
  for (let i = 0; i < bytes.length - 1; i++) {
    bytes[i] |= 0x80
  }
  return bytes
}

// 秒 → ticks 转换
function secondsToTicks(seconds: number, bpm: number, ticksPerQuarter: number): number {
  const secondsPerQuarter = 60 / bpm
  return Math.round(seconds / secondsPerQuarter * ticksPerQuarter)
}

// 构建 MIDI 文件头（MThd chunk）：format 0，单轨
function createMidiHeader(ticksPerQuarter: number): number[] {
  return [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // chunk length = 6
    0x00, 0x00,              // format 0
    0x00, 0x01,              // 1 track
    (ticksPerQuarter >> 8) & 0xFF,
    ticksPerQuarter & 0xFF,
  ]
}

// MIDI 事件（内部使用）
interface MidiEvent {
  tick: number
  type: 'on' | 'off'
  midi: number
  velocity: number
}

// 构建音轨数据：tempo meta + note on/off 事件 + end of track
function createTrackData(notes: RecordedNote[], bpm: number, ticksPerQuarter: number): number[] {
  const microsPerQuarter = Math.floor(60000000 / bpm)
  const events: MidiEvent[] = []

  for (const note of notes) {
    const startTick = Math.max(0, secondsToTicks(note.time, bpm, ticksPerQuarter))
    const endTick = Math.max(startTick, secondsToTicks(note.time + note.duration, bpm, ticksPerQuarter))
    const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * 127)))
    const midi = Math.max(0, Math.min(127, note.midi))
    events.push({ tick: startTick, type: 'on', midi, velocity })
    events.push({ tick: endTick, type: 'off', midi, velocity: 0 })
  }

  // 按 tick 排序；同一 tick 下 note-off 优先于 note-on，避免音符堆叠
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick
    if (a.type !== b.type) return a.type === 'off' ? -1 : 1
    return 0
  })

  const data: number[] = []

  // Tempo meta event：delta=0 + FF 51 03 + 3 字节 microsPerQuarter
  data.push(0x00)
  data.push(0xFF, 0x51, 0x03)
  data.push((microsPerQuarter >> 16) & 0xFF)
  data.push((microsPerQuarter >> 8) & 0xFF)
  data.push(microsPerQuarter & 0xFF)

  // Note On/Off 事件，使用 delta time（相对前一事件的 tick 差）
  let lastTick = 0
  for (const event of events) {
    const delta = Math.max(0, event.tick - lastTick)
    lastTick = event.tick
    data.push(...encodeVLQ(delta))
    if (event.type === 'on') {
      data.push(0x90, event.midi, event.velocity)
    } else {
      data.push(0x80, event.midi, 0x00)
    }
  }

  // End of track meta event
  data.push(0x00)
  data.push(0xFF, 0x2F, 0x00)

  return data
}

// 构建 MTrk chunk：标识头 + 4 字节长度 + 音轨数据
function createMidiTrackChunk(trackData: number[]): number[] {
  const length = trackData.length
  return [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (length >> 24) & 0xFF,
    (length >> 16) & 0xFF,
    (length >> 8) & 0xFF,
    length & 0xFF,
    ...trackData,
  ]
}

// ============ Recorder 类 ============

export class Recorder {
  private notes: RecordedNote[] = []
  private startTime: number = 0
  private activeNotes: Map<number, { pressTime: number; velocity: number }> = new Map()
  private recording: boolean = false
  private timer: number | null = null
  private durationSec: number = 0

  // 开始录音：重置状态，启动计时器
  start(): void {
    this.notes = []
    this.activeNotes.clear()
    this.recording = true
    this.startTime = performance.now() / 1000
    this.durationSec = 0
    this.timer = window.setInterval(() => {
      this.durationSec = performance.now() / 1000 - this.startTime
    }, 100)
  }

  // 记录按键按下
  record(midi: number, velocity: number = 0.8): void {
    if (!this.recording) return
    const now = performance.now() / 1000
    this.activeNotes.set(midi, { pressTime: now, velocity })
  }

  // 记录按键释放
  release(midi: number): void {
    if (!this.recording) return
    const active = this.activeNotes.get(midi)
    if (!active) return
    const now = performance.now() / 1000
    this.notes.push({
      midi,
      time: active.pressTime - this.startTime,
      duration: Math.max(0.1, now - active.pressTime),
      velocity: active.velocity,
    })
    this.activeNotes.delete(midi)
  }

  // 停止录音并返回录音数据
  stop(): Recording {
    this.recording = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    return {
      notes: [...this.notes],
      durationSec: this.durationSec,
      bpm: 120,
      timbre: 'piano',
      createdAt: Date.now(),
    }
  }

  isRecording(): boolean {
    return this.recording
  }

  getDuration(): number {
    return this.durationSec
  }

  getNoteCount(): number {
    return this.notes.length
  }

  // 重置录音数据（不影响录音状态）
  reset(): void {
    this.notes = []
    this.activeNotes.clear()
    this.durationSec = 0
  }
}

// ============ 回放函数 ============

// 回放录音：按 note.time 调度 setTimeout 触发 AudioEngine.playNote
export function playback(recording: Recording, engine: AudioEngine, timbre: string = 'piano'): void {
  recording.notes.forEach(note => {
    setTimeout(() => {
      engine.playNote(note.midi, {
        timbre: timbre as Timbre,
        duration: note.duration,
        velocity: note.velocity,
      })
    }, note.time * 1000)
  })
}

// ============ MIDI 文件导出 ============

// 导出标准 MIDI 文件（format 0，单轨）
export function exportMidi(recording: Recording): Blob {
  const ticksPerQuarter = 480
  const bpm = recording.bpm || 120

  const headerChunk = createMidiHeader(ticksPerQuarter)
  const trackData = createTrackData(recording.notes, bpm, ticksPerQuarter)
  const trackChunk = createMidiTrackChunk(trackData)

  const bytes = [...headerChunk, ...trackChunk]
  return new Blob([new Uint8Array(bytes)], { type: 'audio/midi' })
}

// 下载 MIDI 文件
export function downloadMidi(recording: Recording, filename: string = 'recording.mid'): void {
  const blob = exportMidi(recording)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
