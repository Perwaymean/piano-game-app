// M03 判定系统：判定窗口 / 分数 / 连击 / 准确率 / 评级
// 纯 TS 模块，无 React 依赖，以 AudioContext.currentTime 为基准（毫秒精度）

export type JudgmentTier = 'perfect' | 'great' | 'good' | 'miss'

export const JUDGMENT_WINDOWS: Record<Exclude<JudgmentTier, 'miss'>, number> = {
  perfect: 50,   // ±50ms
  great: 100,    // ±100ms
  good: 150,     // ±150ms
}

export const JUDGMENT_SCORES: Record<JudgmentTier, number> = {
  perfect: 100,
  great: 60,
  good: 30,
  miss: 0,
}

export type Rank = 'S' | 'A' | 'B' | 'C'

export interface JudgmentResult {
  tier: JudgmentTier
  offsetMs: number  // 实际偏差，正数=晚按，负数=早按
}

export interface NoteToJudge {
  id: string | number
  midi: number
  time: number  // 应当被按下的时间（秒，与 AudioContext.currentTime 同基准）
  judged?: boolean
}

export interface ScoreDistribution {
  perfect: number
  great: number
  good: number
  miss: number
}

export interface JudgerStats {
  score: number
  maxScore: number
  combo: number
  maxCombo: number
  accuracy: number  // 0-1
  distribution: ScoreDistribution
  rank: Rank
  totalNotes: number
  judgedNotes: number
}

// 判定纯函数：根据音符时间与输入时间计算判定结果
export function judge(noteTime: number, inputTime: number): JudgmentResult {
  const offsetMs = (inputTime - noteTime) * 1000
  const absOffset = Math.abs(offsetMs)
  if (absOffset <= JUDGMENT_WINDOWS.perfect) return { tier: 'perfect', offsetMs }
  if (absOffset <= JUDGMENT_WINDOWS.great) return { tier: 'great', offsetMs }
  if (absOffset <= JUDGMENT_WINDOWS.good) return { tier: 'good', offsetMs }
  return { tier: 'miss', offsetMs }
}

// 根据准确率计算评级：S ≥95% / A ≥85% / B ≥70% / C <70%
export function calculateRank(accuracy: number): Rank {
  if (accuracy >= 0.95) return 'S'
  if (accuracy >= 0.85) return 'A'
  if (accuracy >= 0.70) return 'B'
  return 'C'
}

export class Judger {
  private queue: NoteToJudge[] = []
  private judged: Map<string | number, JudgmentResult> = new Map()
  private combo = 0
  private maxCombo = 0
  private score = 0
  private maxScore = 0
  private totalNotes = 0
  private distribution: ScoreDistribution = { perfect: 0, great: 0, good: 0, miss: 0 }
  private onJudgmentCb?: (noteId: string | number, result: JudgmentResult) => void
  private onComboChangeCb?: (combo: number) => void
  private missWindowSec: number  // 超过此时间未按则判 miss（默认 0.15s + 一点缓冲）

  constructor(missWindowSec: number = 0.2) {
    this.missWindowSec = missWindowSec
  }

  // 设置判定回调
  onJudgment(cb: (noteId: string | number, result: JudgmentResult) => void): void {
    this.onJudgmentCb = cb
  }

  // 设置连击变化回调
  onComboChange(cb: (combo: number) => void): void {
    this.onComboChangeCb = cb
  }

  // 加载谱面
  loadNotes(notes: NoteToJudge[]): void {
    this.queue = notes.map(n => ({ ...n, judged: false }))
    this.totalNotes = notes.length
    this.maxScore = notes.length * JUDGMENT_SCORES.perfect
    this.reset()
  }

  reset(): void {
    this.judged.clear()
    this.combo = 0
    this.maxCombo = 0
    this.score = 0
    this.distribution = { perfect: 0, great: 0, good: 0, miss: 0 }
    this.queue.forEach(n => { n.judged = false })
  }

  // 用户按键输入
  // currentTime: AudioContext.currentTime（秒）
  // midi: 按下的 MIDI 编号
  // 返回命中结果，未命中返回 null（无对应音符在窗口内）
  onInput(midi: number, currentTime: number): JudgmentResult | null {
    // 在队列中找未判定 + MIDI 匹配 + 在判定窗口内的最近音符
    let bestNote: NoteToJudge | null = null
    let bestAbsOffset = Infinity
    for (const note of this.queue) {
      if (note.judged) continue
      if (note.midi !== midi) continue
      const offsetMs = Math.abs((currentTime - note.time) * 1000)
      if (offsetMs > JUDGMENT_WINDOWS.good) continue  // 超出 Good 窗口不算
      if (offsetMs < bestAbsOffset) {
        bestAbsOffset = offsetMs
        bestNote = note
      }
    }

    if (!bestNote) return null

    const result = judge(bestNote.time, currentTime)
    this.applyJudgment(bestNote, result)
    return result
  }

  // 检查超时 miss（应被跟弹页主循环每帧调用）
  // currentTime: AudioContext.currentTime（秒）
  // 返回本次检查新产生的 miss 列表
  checkMisses(currentTime: number): JudgmentResult[] {
    const newMisses: JudgmentResult[] = []
    for (const note of this.queue) {
      if (note.judged) continue
      // 音符的判定窗口已完全过去（音符时间 + miss 窗口 < 当前时间）
      if (note.time + this.missWindowSec < currentTime) {
        const result: JudgmentResult = { tier: 'miss', offsetMs: (currentTime - note.time) * 1000 }
        this.applyJudgment(note, result)
        newMisses.push(result)
      }
    }
    return newMisses
  }

  private applyJudgment(note: NoteToJudge, result: JudgmentResult): void {
    note.judged = true
    this.judged.set(note.id, result)
    this.distribution[result.tier]++
    this.score += JUDGMENT_SCORES[result.tier]

    if (result.tier === 'miss') {
      this.combo = 0
    } else {
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
    }
    this.onComboChangeCb?.(this.combo)
    this.onJudgmentCb?.(note.id, result)
  }

  getStats(): JudgerStats {
    const judgedNotes = this.distribution.perfect + this.distribution.great + this.distribution.good + this.distribution.miss
    const accuracy = judgedNotes > 0
      ? (this.distribution.perfect * 1.0 + this.distribution.great * 0.7 + this.distribution.good * 0.3) / judgedNotes
      : 0
    return {
      score: this.score,
      maxScore: this.maxScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      accuracy,
      distribution: { ...this.distribution },
      rank: calculateRank(accuracy),
      totalNotes: this.totalNotes,
      judgedNotes,
    }
  }

  isFinished(): boolean {
    return this.queue.every(n => n.judged)
  }

  // 获取当前未判定的可见音符（用于跟弹页渲染下落音符）
  getPendingNotes(): NoteToJudge[] {
    return this.queue.filter(n => !n.judged)
  }
}
