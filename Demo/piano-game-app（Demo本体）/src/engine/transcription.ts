// AI 转谱引擎：基于 Spotify Basic Pitch（TensorFlow.js 图模型）
// 动态加载依赖，避免影响初始 bundle 体积
// 模型从 CDN 加载（~900KB），在浏览器端用 WebGL 推理

export interface TranscribedNote {
  midi: number
  time: number // 秒
  duration: number // 秒
}

export interface TranscriptionResult {
  notes: TranscribedNote[]
  durationSec: number
  bpm: number
  noteCount: number
}

type ProgressCallback = (percent: number) => void

// 模型 CDN 地址（jsdelivr 代理 GitHub，国内访问更稳定）
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/spotify/basic-pitch-ts@main/model/model.json'

let modelLoaded = false

/**
 * 将音频 File 解码为 AudioBuffer（重采样到 22050 Hz，Basic Pitch 要求）
 */
async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  // 先用默认采样率解码
  const ctx = new AudioCtx()
  const originalBuffer = await ctx.decodeAudioData(arrayBuffer)
  ctx.close()

  // Basic Pitch 要求 22050 Hz，需要重采样
  const targetRate = 22050
  if (originalBuffer.sampleRate === targetRate) {
    return originalBuffer
  }

  // 用 OfflineAudioContext 重采样
  const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const offlineCtx = new OfflineCtx(
    1, // mono
    Math.ceil(originalBuffer.duration * targetRate),
    targetRate,
  )
  const source = offlineCtx.createBufferSource()
  source.buffer = originalBuffer
  // 如果是立体声，down-mix 到 mono（连接到 destination 自动 down-mix）
  source.connect(offlineCtx.destination)
  source.start()
  const resampledBuffer = await offlineCtx.startRendering()
  return resampledBuffer
}

/**
 * 运行 Basic Pitch 转谱
 * @param file 音频文件（WAV/MP3/OGG/FLAC/MP4）
 * @param onProgress 进度回调（0-1）
 * @returns 转谱结果
 */
export async function transcribeAudio(
  file: File,
  onProgress?: ProgressCallback,
): Promise<TranscriptionResult> {
  // 动态导入，避免 TF.js 影响初始加载
  const [tf, basicPitchModule] = await Promise.all([
    import('@tensorflow/tfjs'),
    import('@spotify/basic-pitch'),
  ])

  // 注册 WebGL backend（TF.js 默认会尝试，但显式注册更可靠）
  await tf.ready()

  // 解码音频
  onProgress?.(0.05)
  const audioBuffer = await decodeAudioFile(file)
  onProgress?.(0.15)

  // 收集模型输出
  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []

  // 创建 BasicPitch 实例（首次会从 CDN 加载模型）
  const basicPitch = new basicPitchModule.BasicPitch(MODEL_URL)

  // 推理（这是最耗时的步骤，占 15%-90% 进度）
  await basicPitch.evaluateModel(
    audioBuffer,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f)
      onsets.push(...o)
      contours.push(...c)
    },
    (p: number) => {
      // 模型推理进度映射到 15%-90%
      onProgress?.(0.15 + p * 0.75)
    },
  )

  onProgress?.(0.92)

  // 后处理：将帧输出转为音符事件
  const notesWithBends = basicPitchModule.addPitchBendsToNoteEvents(
    contours,
    basicPitchModule.outputToNotesPoly(frames, onsets, 0.25, 0.25, 5),
  )

  // 转为时间表示
  const timedNotes = basicPitchModule.noteFramesToTime(notesWithBends)

  onProgress?.(0.96)

  // 转为项目格式
  const notes: TranscribedNote[] = timedNotes.map((n) => ({
    midi: n.pitchMidi,
    time: n.startTimeSeconds,
    duration: Math.max(0.1, n.durationSeconds),
  }))

  // 按时间排序
  notes.sort((a, b) => a.time - b.time)

  const durationSec = audioBuffer.duration
  const bpm = estimateBPM(notes)

  modelLoaded = true
  onProgress?.(1.0)

  return {
    notes,
    durationSec,
    bpm,
    noteCount: notes.length,
  }
}

/**
 * 简易 BPM 估计：基于音符间隔的中位数
 */
function estimateBPM(notes: TranscribedNote[]): number {
  if (notes.length < 4) return 120
  const intervals: number[] = []
  for (let i = 1; i < notes.length; i++) {
    const dt = notes[i].time - notes[i - 1].time
    if (dt > 0.1 && dt < 2.0) intervals.push(dt)
  }
  if (intervals.length < 3) return 120
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  // 假设中位数间隔是一个四分音符
  const bpm = 60 / median
  // 归一化到 60-180 范围
  if (bpm < 60) return Math.round(bpm * 2)
  if (bpm > 180) return Math.round(bpm / 2)
  return Math.round(bpm)
}

export function isModelLoaded(): boolean {
  return modelLoaded
}
