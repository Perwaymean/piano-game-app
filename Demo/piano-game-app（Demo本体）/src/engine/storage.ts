import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

// ============ SubTask 8.1: 类型定义 ============

export type Difficulty = 'entry' | 'intermediate' | 'challenge'
export type Rank = 'S' | 'A' | 'B' | 'C'
export type JudgmentTier = 'perfect' | 'great' | 'good' | 'miss'

export interface ScoreDistribution {
  perfect: number
  great: number
  good: number
  miss: number
}

export interface HistoryRecord {
  id?: number
  songId: string
  songTitle: string
  difficulty: Difficulty
  score: number
  maxScore: number
  rank: Rank
  accuracy: number
  maxCombo: number
  distribution: ScoreDistribution
  timestamp: number // Date.now()
}

export interface RecordedNote {
  midi: number
  time: number // 秒，相对于录音开始
  duration: number // 秒
  velocity: number // 0-1
}

export interface RecordingRecord {
  id?: number
  notes: RecordedNote[]
  durationSec: number
  timestamp: number
  title?: string
}

// AI 转谱生成的曲目
export interface AiSongRecord {
  id: string              // 唯一 ID（如 'ai-1700000000000'）
  title: string           // 曲名（取自文件名）
  notes: RecordedNote[]   // 音符列表
  durationSec: number
  bpm: number
  noteCount: number
  timestamp: number       // 创建时间
  gradient: [string, string]
}

export type StorageReason = 'quota' | 'not_found' | 'unknown'

export interface StorageResult<T = void> {
  success: boolean
  data?: T
  reason?: StorageReason
  error?: unknown
}

interface PianoDB extends DBSchema {
  history: {
    key: number
    value: HistoryRecord
    indexes: { 'by-timestamp': number; 'by-songId': string }
  }
  recordings: {
    key: number
    value: RecordingRecord
    indexes: { 'by-timestamp': number }
  }
  aiSongs: {
    key: string
    value: AiSongRecord
    indexes: { 'by-timestamp': number }
  }
}

// ============ SubTask 8.5: 错误分类 ============

function classifyError(err: unknown): StorageReason {
  if (err instanceof DOMException) {
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return 'quota'
    }
  }
  return 'unknown'
}

// ============ SubTask 8.2: db 单例 ============

let dbPromise: Promise<IDBPDatabase<PianoDB>> | null = null

function getDB(): Promise<IDBPDatabase<PianoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PianoDB>('piano-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('history')) {
            const historyStore = db.createObjectStore('history', {
              keyPath: 'id',
              autoIncrement: true,
            })
            historyStore.createIndex('by-timestamp', 'timestamp')
            historyStore.createIndex('by-songId', 'songId')
          }
          if (!db.objectStoreNames.contains('recordings')) {
            const recStore = db.createObjectStore('recordings', {
              keyPath: 'id',
              autoIncrement: true,
            })
            recStore.createIndex('by-timestamp', 'timestamp')
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('aiSongs')) {
            const aiStore = db.createObjectStore('aiSongs', { keyPath: 'id' })
            aiStore.createIndex('by-timestamp', 'timestamp')
          }
        }
      },
    })
  }
  return dbPromise
}

// ============ SubTask 8.3: History CRUD ============

export async function addHistory(
  record: Omit<HistoryRecord, 'id'>,
): Promise<StorageResult<HistoryRecord>> {
  try {
    const db = await getDB()
    const id = await db.add('history', record as HistoryRecord)
    return { success: true, data: { ...record, id: id as number } }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getHistory(
  limit: number = 50,
): Promise<StorageResult<HistoryRecord[]>> {
  try {
    const db = await getDB()
    const all = await db.getAllFromIndex('history', 'by-timestamp')
    // 按 timestamp 降序（最新在前）
    all.sort((a, b) => b.timestamp - a.timestamp)
    return { success: true, data: all.slice(0, limit) }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getRecentScores(
  limit: number = 10,
): Promise<StorageResult<HistoryRecord[]>> {
  return getHistory(limit)
}

export async function getHistoryBySong(
  songId: string,
  limit: number = 20,
): Promise<StorageResult<HistoryRecord[]>> {
  try {
    const db = await getDB()
    const all = await db.getAllFromIndex('history', 'by-songId', songId)
    all.sort((a, b) => b.timestamp - a.timestamp)
    return { success: true, data: all.slice(0, limit) }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function clearHistory(): Promise<StorageResult> {
  try {
    const db = await getDB()
    await db.clear('history')
    return { success: true }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

// ============ SubTask 8.4: Recording CRUD ============

export async function addRecording(
  record: Omit<RecordingRecord, 'id'>,
): Promise<StorageResult<RecordingRecord>> {
  try {
    const db = await getDB()
    const id = await db.add('recordings', record as RecordingRecord)
    return { success: true, data: { ...record, id: id as number } }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getRecording(
  id: number,
): Promise<StorageResult<RecordingRecord>> {
  try {
    const db = await getDB()
    const rec = await db.get('recordings', id)
    if (!rec) return { success: false, reason: 'not_found' }
    return { success: true, data: rec }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getAllRecordings(
  limit: number = 50,
): Promise<StorageResult<RecordingRecord[]>> {
  try {
    const db = await getDB()
    const all = await db.getAllFromIndex('recordings', 'by-timestamp')
    all.sort((a, b) => b.timestamp - a.timestamp)
    return { success: true, data: all.slice(0, limit) }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function clearRecordings(): Promise<StorageResult> {
  try {
    const db = await getDB()
    await db.clear('recordings')
    return { success: true }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

// ============ SubTask 8.6: 便捷统计函数 ============

// 获取近 N 次的分数数组（用于折线图）
export async function getRecentScoreValues(
  limit: number = 10,
): Promise<StorageResult<number[]>> {
  const result = await getRecentScores(limit)
  if (!result.success || !result.data) {
    return { success: false, reason: result.reason }
  }
  // 按时间正序（最旧在前），便于折线图从左到右显示进步
  const sorted = [...result.data].sort((a, b) => a.timestamp - b.timestamp)
  return { success: true, data: sorted.map((r) => r.score) }
}

// 获取存储估算占用（用于 UI 显示）
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
} | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  }
  return null
}

// ============ AI 曲目 CRUD ============

export async function addAiSong(
  record: AiSongRecord,
): Promise<StorageResult<AiSongRecord>> {
  try {
    const db = await getDB()
    await db.put('aiSongs', record)
    return { success: true, data: record }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getAllAiSongs(): Promise<StorageResult<AiSongRecord[]>> {
  try {
    const db = await getDB()
    const all = await db.getAllFromIndex('aiSongs', 'by-timestamp')
    all.sort((a, b) => b.timestamp - a.timestamp) // 最新在前
    return { success: true, data: all }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function getAiSong(id: string): Promise<StorageResult<AiSongRecord>> {
  try {
    const db = await getDB()
    const rec = await db.get('aiSongs', id)
    if (!rec) return { success: false, reason: 'not_found' }
    return { success: true, data: rec }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}

export async function deleteAiSong(id: string): Promise<StorageResult> {
  try {
    const db = await getDB()
    await db.delete('aiSongs', id)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, reason: classifyError(err), error: err }
  }
}
