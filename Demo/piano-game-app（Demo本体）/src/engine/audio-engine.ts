// AudioEngine: Web Audio API 驱动的轻量音频引擎
// 对应 PRD M01：键盘/触屏/自动播放触发后 ≤50ms 出声；4 种音色；ADSR；多音无爆音
// 纯 TS 模块，无 React 依赖；单例化交由 Task 4 的 AudioContextProvider 处理

export type Timbre = 'piano' | 'music_box' | 'pad' | '8bit'

export interface PlayNoteOptions {
  timbre?: Timbre
  duration?: number // 秒，默认 0.5
  velocity?: number // 0-1，默认 0.7
  when?: number // AudioContext.currentTime + 偏移，默认 0（立即）
}

export interface StopHandle {
  stop: (when?: number) => void
}

// MIDI -> 频率（A4=440Hz, midi=69，12 平均律）
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

type AudioContextCtor = typeof AudioContext

interface WindowWithWebkitAudio {
  AudioContext: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

export class AudioEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private compressor: DynamicsCompressorNode
  private activeNodes: Map<string, { stop: (when?: number) => void }> = new Map()

  constructor() {
    // 兼容 webkitAudioContext，避免使用 any
    const w = window as unknown as WindowWithWebkitAudio
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) {
      throw new Error('Web Audio API is not supported in this environment')
    }
    this.ctx = new Ctor()
    this.compressor = this.ctx.createDynamicsCompressor()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7
    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.ctx.destination)
  }

  get currentTime(): number {
    return this.ctx.currentTime
  }

  get state(): AudioContextState {
    return this.ctx.state
  }

  // iOS 首次交互需要 resume
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') {
      await this.ctx.resume()
    }
  }

  async suspend(): Promise<void> {
    await this.ctx.suspend()
  }

  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }

  playNote(midi: number, opts: PlayNoteOptions = {}): StopHandle {
    const { timbre = 'piano', duration = 0.5, velocity = 0.7, when = 0 } = opts
    const freq = midiToFreq(midi)
    const startAt = Math.max(when, this.ctx.currentTime)
    const stopAt = startAt + duration

    // 包络共享 gain 节点，多振荡器混合后进入 masterGain
    const gain = this.ctx.createGain()
    gain.connect(this.masterGain)

    // ADSR: attack 5ms / decay 100ms / sustain 0.6 / release 200ms
    const attack = 0.005
    const decay = 0.1
    const sustain = 0.6
    const release = 0.2
    const peak = velocity
    const sustainLevel = velocity * sustain

    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(peak, startAt + attack)
    gain.gain.linearRampToValueAtTime(sustainLevel, startAt + attack + decay)
    gain.gain.setValueAtTime(sustainLevel, Math.max(startAt + attack + decay, stopAt))
    gain.gain.linearRampToValueAtTime(0, stopAt + release)

    const oscillators: OscillatorNode[] = []
    this.buildTimbre(timbre, freq, startAt, stopAt + release, oscillators, gain)

    const stop = (whenStop?: number) => {
      const t = whenStop ?? this.ctx.currentTime
      oscillators.forEach((osc) => {
        try {
          osc.stop(t)
        } catch {
          // 节点可能已自动结束，忽略
        }
      })
    }

    const handleId = `${midi}-${startAt}`
    this.activeNodes.set(handleId, { stop })
    // 第一个振荡器结束时清理 handle
    oscillators[0].onended = () => this.activeNodes.delete(handleId)

    return { stop }
  }

  private buildTimbre(
    timbre: Timbre,
    freq: number,
    startAt: number,
    stopAt: number,
    oscillators: OscillatorNode[],
    gain: GainNode,
  ): void {
    switch (timbre) {
      case 'piano': {
        // 三角钢琴：基频 + 谐波叠加 + 低通
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 4000
        lp.connect(gain)
        const harmonics: Array<{
          mult: number
          gain: number
          type: OscillatorType
        }> = [
          { mult: 1, gain: 1.0, type: 'triangle' },
          { mult: 2, gain: 0.4, type: 'sine' },
          { mult: 3, gain: 0.2, type: 'sine' },
          { mult: 4, gain: 0.1, type: 'sine' },
        ]
        harmonics.forEach((h) => {
          const osc = this.ctx.createOscillator()
          osc.type = h.type
          osc.frequency.value = freq * h.mult
          const oscGain = this.ctx.createGain()
          oscGain.gain.value = h.gain
          osc.connect(oscGain)
          oscGain.connect(lp)
          osc.start(startAt)
          osc.stop(stopAt)
          oscillators.push(osc)
        })
        break
      }
      case 'music_box': {
        // 音乐盒：三角波 + 上移八度更清脆 + 高八度弱音点缀
        const osc = this.ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq * 2
        const oscGain = this.ctx.createGain()
        oscGain.gain.value = 0.8
        osc.connect(oscGain)
        oscGain.connect(gain)
        osc.start(startAt)
        osc.stop(stopAt)
        oscillators.push(osc)

        const osc2 = this.ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.value = freq * 4
        const osc2Gain = this.ctx.createGain()
        osc2Gain.gain.value = 0.15
        osc2.connect(osc2Gain)
        osc2Gain.connect(gain)
        osc2.start(startAt)
        osc2.stop(stopAt)
        oscillators.push(osc2)
        break
      }
      case 'pad': {
        // 合成 Pad：两个轻微失谐锯齿 + 低通 + 长释放
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1200
        lp.Q.value = 2
        lp.connect(gain)
        const detunes = [-7, 7]
        detunes.forEach((d) => {
          const osc = this.ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = freq
          osc.detune.value = d
          osc.connect(lp)
          osc.start(startAt)
          osc.stop(stopAt)
          oscillators.push(osc)
        })
        break
      }
      case '8bit': {
        // 8-bit：方波
        const osc = this.ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = freq
        osc.connect(gain)
        osc.start(startAt)
        osc.stop(stopAt)
        oscillators.push(osc)
        break
      }
    }
  }

  dispose(): void {
    this.activeNodes.forEach(({ stop }) => stop())
    this.activeNodes.clear()
    void this.ctx.close().catch(() => {
      // 关闭可能已关闭的 ctx，忽略
    })
  }
}
