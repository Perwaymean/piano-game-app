import type { Difficulty } from './storage'

// ============ SubTask 9.1: 类型定义 ============

export interface SongNote {
  midi: number
  time: number // 秒，相对于曲开始
  duration: number // 秒
}

export interface Song {
  id: string
  title: string
  difficulty: Difficulty
  bpm: number
  durationSec: number
  notes: SongNote[]
  gradient: [string, string] // CSS 颜色渐变 [from, to]，用于封面
  description?: string
}

// ============ 内部工具：根据 [midi, 拍数] 序列构建音符 ============
// 每个音符时长 = 拍数 * beatSec - gapSec（留出小间隔避免叠加）
// 返回 notes 数组与整曲总时长（最后一个音符的结束时间）

function buildNotes(
  seq: Array<[number, number]>,
  bpm: number,
  gapSec = 0.05,
): { notes: SongNote[]; durationSec: number } {
  const beatSec = 60 / bpm
  const notes: SongNote[] = []
  let t = 0
  for (const [midi, beats] of seq) {
    const span = beats * beatSec
    const dur = span - gapSec
    notes.push({ midi, time: t, duration: dur > 0.05 ? dur : 0.05 })
    t += span
  }
  return { notes, durationSec: t }
}

// ============ SubTask 9.2: 内置曲目 ============
// MIDI 参考：C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72
// 升半音：C#4=61 D#4=63 F#4=66 G#4=68 A#4=70
// 高八度：D5=74 E5=76 F5=77 G5=79 C6=84 ；低八度 C3=48 D3=50 E3=52

// 1. 小星星 (entry, 80 BPM) —— 经典儿歌，C 大调，公有领域
// 每拍 0.75s，每句末长音 2 拍
const twinkle = buildNotes([
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
], 80)

// 2. 欢乐颂 (intermediate, 120 BPM) —— 贝多芬第九交响曲主题，公有领域
// 每拍 0.5s，每行末长音 2 拍
const odeToJoy = buildNotes([
  [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
  [60, 1], [60, 1], [62, 1], [64, 1], [64, 1], [62, 1], [62, 2],
  [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
  [60, 1], [60, 1], [62, 1], [64, 1], [62, 1], [60, 1], [60, 2],
], 120)

// 3. 卡农片段 (challenge, 64 BPM) —— 帕赫贝尔卡农主题简化片段，公有领域
// 每拍约 0.9375s，旋律线 32 音
const canon = buildNotes([
  [74, 1], [73, 1], [71, 1], [69, 1], [67, 1], [66, 1], [67, 1], [69, 1],
  [71, 1], [69, 1], [67, 1], [66, 1], [64, 1], [62, 1], [64, 1], [66, 1],
  [74, 1], [73, 1], [71, 1], [69, 1], [67, 1], [66, 1], [67, 1], [69, 1],
  [71, 1], [69, 1], [67, 1], [66, 1], [64, 1], [62, 1], [66, 1], [69, 1],
], 64)

// 4. 天空之城风格练习曲 (intermediate, 72 BPM) —— 自创纯音阶片段，避免版权
// 每拍约 0.8333s，6-5-3-5-1-3-5 风格动机
const laputa = buildNotes([
  [69, 1], [67, 1], [64, 1], [67, 0.5], [60, 0.5],
  [64, 1], [67, 1], [69, 1], [67, 0.5], [64, 0.5],
  [72, 1], [67, 1], [64, 1], [67, 0.5], [60, 0.5],
  [64, 1], [67, 1], [69, 1], [67, 0.5], [60, 0.5],
], 72)

// 5. 生日快乐 (entry, 100 BPM) —— 公有领域
// 每拍 0.6s，每句“to”字长音 2 拍
const happyBirthday = buildNotes([
  [67, 1], [67, 1], [69, 1], [67, 1], [72, 2], [71, 1],
  [67, 1], [67, 1], [69, 1], [67, 1], [74, 2], [72, 1],
  [67, 1], [67, 1], [79, 1], [76, 1], [72, 1], [71, 1], [69, 1],
  [77, 1], [77, 1], [76, 1], [72, 1], [74, 1], [72, 2],
], 100)

// 6. 自创练习曲 1 - 五度跳跃 (entry, 90 BPM)
// C-G-D-A-E-B-F-C 上下行，每拍约 0.6667s
const practice1 = buildNotes([
  [60, 1], [67, 1], [62, 1], [69, 1], [64, 1], [71, 1], [65, 1], [72, 1],
  [72, 1], [65, 1], [71, 1], [64, 1], [69, 1], [62, 1], [67, 1], [60, 1],
], 90)

// 7. 自创练习曲 2 - 琶音 (intermediate, 110 BPM)
// C 大三和弦琶音 C-E-G-C-E-G-C 上下行，每拍约 0.5455s，顶点与末音长 2 拍
const practice2 = buildNotes([
  [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [79, 1], [84, 2],
  [79, 1], [76, 1], [72, 1], [67, 1], [64, 2],
], 110)

// 8. 自创练习曲 3 - 半音阶挑战 (challenge, 130 BPM)
// 12 半音上下行，每拍约 0.4615s，顶点 C5 长 2 拍
const practice3 = buildNotes([
  [60, 1], [61, 1], [62, 1], [63, 1], [64, 1], [65, 1], [66, 1], [67, 1],
  [68, 1], [69, 1], [70, 1], [71, 1], [72, 2],
  [71, 1], [70, 1], [69, 1], [68, 1], [67, 1], [66, 1], [65, 1], [64, 1],
  [63, 1], [62, 1], [61, 1], [60, 1],
], 130)

// 9. 玛丽有只小羊羔 (entry, 100 BPM) —— 公有领域
// 补充入门曲目，使 getRecommendedSongs([], 4) 可返回 4 首入门曲
const maryLamb = buildNotes([
  [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [64, 1], [64, 2],
  [62, 1], [62, 1], [62, 2],
  [64, 1], [67, 1], [67, 2],
  [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [64, 1], [64, 2],
  [62, 1], [62, 1], [64, 1], [62, 1], [60, 2],
], 100)

const SONGS: Song[] = [
  {
    id: 'twinkle',
    title: '小星星',
    difficulty: 'entry',
    bpm: 80,
    durationSec: twinkle.durationSec,
    notes: twinkle.notes,
    gradient: ['var(--piano-purple-700)', 'var(--piano-purple-500)'],
    description: '经典儿歌，C 大调入门曲目（公有领域）',
  },
  {
    id: 'ode-to-joy',
    title: '欢乐颂',
    difficulty: 'intermediate',
    bpm: 120,
    durationSec: odeToJoy.durationSec,
    notes: odeToJoy.notes,
    gradient: ['var(--piano-purple-600)', 'var(--piano-pink-400)'],
    description: '贝多芬第九交响曲主题（公有领域）',
  },
  {
    id: 'canon-fragment',
    title: '卡农片段',
    difficulty: 'challenge',
    bpm: 64,
    durationSec: canon.durationSec,
    notes: canon.notes,
    gradient: ['var(--piano-cyan)', 'var(--piano-purple-600)'],
    description: '帕赫贝尔卡农主题变奏简化片段（公有领域）',
  },
  {
    id: 'laputa-practice',
    title: '天空之城风格练习曲',
    difficulty: 'intermediate',
    bpm: 72,
    durationSec: laputa.durationSec,
    notes: laputa.notes,
    gradient: ['var(--piano-purple-600)', 'var(--piano-pink-400)'],
    description: '自创纯音阶练习片段，规避版权',
  },
  {
    id: 'happy-birthday',
    title: '生日快乐',
    difficulty: 'entry',
    bpm: 100,
    durationSec: happyBirthday.durationSec,
    notes: happyBirthday.notes,
    gradient: ['var(--piano-pink)', 'var(--piano-cyan-400)'],
    description: '经典生日歌（公有领域）',
  },
  {
    id: 'practice-1',
    title: '自创练习曲 1 · 五度跳跃',
    difficulty: 'entry',
    bpm: 90,
    durationSec: practice1.durationSec,
    notes: practice1.notes,
    gradient: ['var(--piano-cyan-400)', 'var(--piano-purple-400)'],
    description: 'C-G-D-A-E-B-F-C 上下行纯练习',
  },
  {
    id: 'practice-2',
    title: '自创练习曲 2 · 琶音',
    difficulty: 'intermediate',
    bpm: 110,
    durationSec: practice2.durationSec,
    notes: practice2.notes,
    gradient: ['var(--piano-purple-600)', 'var(--piano-pink-400)'],
    description: 'C 大三和弦琶音上下行',
  },
  {
    id: 'practice-3',
    title: '自创练习曲 3 · 半音阶挑战',
    difficulty: 'challenge',
    bpm: 130,
    durationSec: practice3.durationSec,
    notes: practice3.notes,
    gradient: ['var(--piano-cyan)', 'var(--piano-purple-600)'],
    description: '12 半音上下行挑战',
  },
  {
    id: 'mary-lamb',
    title: '玛丽有只小羊羔',
    difficulty: 'entry',
    bpm: 100,
    durationSec: maryLamb.durationSec,
    notes: maryLamb.notes,
    gradient: ['var(--piano-purple-700)', 'var(--piano-purple-500)'],
    description: '经典儿歌（公有领域），入门补充曲目',
  },
]

// ============ SubTask 9.3: 查询函数 ============

export function getAllSongs(): Song[] {
  return SONGS
}

export function getSongById(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id)
}

export function getSongsByDifficulty(diff: Difficulty): Song[] {
  return SONGS.filter((s) => s.difficulty === diff)
}

// 推荐歌曲：无历史时返回入门曲；有历史时优先推荐进阶，不足则补入门
export function getRecommendedSongs(
  history: Array<{ songId: string; rank: string }>,
  limit: number = 4,
): Song[] {
  if (history.length === 0) {
    return SONGS.filter((s) => s.difficulty === 'entry').slice(0, limit)
  }
  const intermediateSongs = SONGS.filter((s) => s.difficulty === 'intermediate')
  if (intermediateSongs.length >= limit) return intermediateSongs.slice(0, limit)
  const entrySongs = SONGS.filter((s) => s.difficulty === 'entry')
  return [...intermediateSongs, ...entrySongs].slice(0, limit)
}
