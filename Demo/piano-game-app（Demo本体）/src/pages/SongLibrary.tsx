import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Music, Clock, Activity, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import type { Song } from '@/engine/song-data'
import type { Difficulty } from '@/engine/storage'
import { getAllSongs } from '@/engine/song-data'
import { getAllAiSongs, deleteAiSong, type AiSongRecord } from '@/engine/storage'

type FilterDifficulty = 'all' | Difficulty

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  entry: '入门',
  intermediate: '进阶',
  challenge: '挑战',
}

const DIFFICULTY_PILL_STYLES: Record<Difficulty, CSSProperties> = {
  entry: {
    background: 'var(--piano-cyan-soft)',
    color: 'var(--piano-cyan-400)',
  },
  intermediate: {
    background: 'color-mix(in srgb, var(--piano-purple-500) 14%, transparent)',
    color: 'var(--piano-purple-400)',
  },
  challenge: {
    background: 'var(--piano-pink-soft)',
    color: 'var(--piano-pink-400)',
  },
}

const DIFFICULTY_DOT_COLOR: Record<Difficulty, string> = {
  entry: 'var(--piano-cyan-400)',
  intermediate: 'var(--piano-purple-400)',
  challenge: 'var(--piano-pink-400)',
}

const FILTER_OPTIONS: Array<{ key: FilterDifficulty; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'entry', label: '入门' },
  { key: 'intermediate', label: '进阶' },
  { key: 'challenge', label: '挑战' },
]

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface MetaRowProps {
  icon: ReactNode
  text: string
}

function MetaRow({ icon, text }: MetaRowProps) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        fontFamily: 'var(--piano-font-mono)',
        fontSize: '12px',
        color: 'var(--piano-muted-foreground)',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--piano-muted-foreground)' }} aria-hidden="true">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  )
}

interface SongCardProps {
  song: Song
  selected: boolean
  onSelect: (id: string) => void
}

function SongCard({ song, selected, onSelect }: SongCardProps) {
  const isAi = song.id.startsWith('ai-')
  const coverStyle: CSSProperties = {
    height: '120px',
    background: `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`,
  }

  const cardStyle: CSSProperties = {
    background: 'var(--piano-card)',
    border: `2px solid ${selected ? 'var(--piano-primary)' : 'var(--piano-border)'}`,
    borderRadius: 'var(--piano-radius-md)',
  }

  return (
    <section
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={song.title}
      className="cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--piano-ring)]"
      style={cardStyle}
      onClick={() => onSelect(song.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(song.id)
        }
      }}
    >
      <div className="relative flex items-center justify-center" style={coverStyle}>
        {isAi ? (
          <Sparkles
            style={{ width: 32, height: 32, color: 'var(--piano-primary-foreground)', opacity: 0.9 }}
            aria-hidden="true"
          />
        ) : (
          <Music
            style={{ width: 32, height: 32, color: 'var(--piano-primary-foreground)', opacity: 0.8 }}
            aria-hidden="true"
          />
        )}
        <span
          className="absolute top-2 right-2 inline-flex items-center"
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--piano-radius-sm)',
            fontSize: '11px',
            fontFamily: 'var(--piano-font-mono)',
            lineHeight: 1.4,
            ...DIFFICULTY_PILL_STYLES[song.difficulty],
          }}
        >
          {DIFFICULTY_LABELS[song.difficulty]}
        </span>
        {isAi && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1"
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--piano-radius-sm)',
              fontSize: '10px',
              fontFamily: 'var(--piano-font-mono)',
              background: 'color-mix(in srgb, var(--piano-primary) 80%, transparent)',
              color: 'var(--piano-primary-foreground)',
            }}
          >
            <Sparkles style={{ width: 10, height: 10 }} aria-hidden="true" />
            AI
          </span>
        )}
      </div>
      <div style={{ padding: '12px' }}>
        <h3
          className="truncate"
          style={{
            fontFamily: 'var(--piano-font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--piano-foreground)',
          }}
        >
          {song.title}
        </h3>
        {song.description && (
          <p
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--piano-muted-foreground)' }}
          >
            {song.description}
          </p>
        )}
        <div className="mt-2 space-y-1">
          <MetaRow icon={<Music style={{ width: 14, height: 14 }} />} text={`${song.bpm} BPM`} />
          <MetaRow icon={<Clock style={{ width: 14, height: 14 }} />} text={formatDuration(song.durationSec)} />
          <MetaRow icon={<Activity style={{ width: 14, height: 14 }} />} text={`${song.notes.length} 个音符`} />
        </div>
      </div>
    </section>
  )
}

export default function SongLibrary() {
  const navigate = useNavigate()
  const builtinSongs = useMemo(() => getAllSongs(), [])
  const [aiSongs, setAiSongs] = useState<AiSongRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<FilterDifficulty>('all')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)

  // 加载 AI 曲目
  useEffect(() => {
    let cancelled = false
    async function loadAi() {
      const res = await getAllAiSongs()
      if (!cancelled && res.success && res.data) {
        setAiSongs(res.data)
      }
    }
    loadAi()
    return () => { cancelled = true }
  }, [])

  // 将 AI 曲目转换为 Song 格式
  const aiSongsAsSong: Song[] = useMemo(() => {
    return aiSongs.map(r => ({
      id: r.id,
      title: r.title,
      difficulty: 'intermediate' as Difficulty,
      bpm: r.bpm,
      durationSec: r.durationSec,
      notes: r.notes.map(n => ({ midi: n.midi, time: n.time, duration: n.duration })),
      gradient: r.gradient,
      description: `AI 转谱 · ${r.noteCount} 音符`,
    }))
  }, [aiSongs])

  // 合并曲目列表（AI 曲目在前）
  const allSongs = useMemo(() => [...aiSongsAsSong, ...builtinSongs], [aiSongsAsSong, builtinSongs])

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allSongs.filter((song) => {
      const matchesDifficulty = difficultyFilter === 'all' || song.difficulty === difficultyFilter
      const matchesQuery = q === '' || song.title.toLowerCase().includes(q)
      return matchesDifficulty && matchesQuery
    })
  }, [allSongs, searchQuery, difficultyFilter])

  const selectedSong = useMemo(
    () => (selectedSongId ? (allSongs.find((s) => s.id === selectedSongId) ?? null) : null),
    [allSongs, selectedSongId],
  )

  // 判断选中的是否为 AI 曲目
  const isSelectedAi = selectedSongId?.startsWith('ai-') ?? false

  const handleDeleteAi = async () => {
    if (!selectedSongId || !isSelectedAi) return
    await deleteAiSong(selectedSongId)
    setAiSongs(prev => prev.filter(s => s.id !== selectedSongId))
    setSelectedSongId(null)
  }

  const handleReset = () => {
    setSearchQuery('')
    setDifficultyFilter('all')
  }

  const handlePlay = () => {
    if (selectedSongId) {
      navigate(`/follow-play?song=${encodeURIComponent(selectedSongId)}`)
    }
  }

  return (
    <div
      className="mx-auto px-4 sm:px-6"
      style={{
        maxWidth: '1200px',
        paddingTop: '80px',
        paddingBottom: selectedSong ? '120px' : '48px',
      }}
    >
      {/* 页面标题 */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: 'var(--piano-font-display)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--piano-foreground)',
            lineHeight: 1.2,
          }}
        >
          曲库
        </h1>
        <p className="mt-1" style={{ fontSize: '14px', color: 'var(--piano-muted-foreground)' }}>
          选择一首曲目开始练习
        </p>
      </div>

      {/* 搜索 + 难度筛选 */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="relative flex-1 min-w-[200px]">
          <label htmlFor="song-search" className="sr-only">
            搜索曲目
          </label>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 16, height: 16, color: 'var(--piano-muted-foreground)' }}
            aria-hidden="true"
          />
          <input
            id="song-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索曲目..."
            className="w-full outline-none"
            style={{
              background: 'var(--piano-card)',
              border: '1px solid var(--piano-border)',
              borderRadius: 'var(--piano-radius-md)',
              padding: '8px 16px 8px 40px',
              color: 'var(--piano-foreground)',
              fontSize: '14px',
            }}
          />
        </div>
        <div
          className="flex gap-2 flex-nowrap overflow-x-auto no-scrollbar"
          role="group"
          aria-label="难度筛选"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = difficultyFilter === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDifficultyFilter(opt.key)}
                aria-pressed={active}
                className="whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5"
                style={{
                  background: active ? 'var(--piano-primary)' : 'var(--piano-muted)',
                  color: active
                    ? 'var(--piano-primary-foreground)'
                    : 'var(--piano-muted-foreground)',
                  border: `1px solid ${active ? 'transparent' : 'var(--piano-border)'}`,
                  borderRadius: 'var(--piano-radius-full)',
                  padding: '4px 16px',
                  fontSize: '13px',
                }}
              >
                {opt.key !== 'all' && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: DIFFICULTY_DOT_COLOR[opt.key],
                      display: 'inline-block',
                    }}
                  />
                )}
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 曲目网格 / 空状态 */}
      {filteredSongs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              selected={song.id === selectedSongId}
              onSelect={setSelectedSongId}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: '64px 16px' }}
        >
          <Search
            style={{ width: 48, height: 48, color: 'var(--piano-muted-foreground)', opacity: 0.5 }}
            aria-hidden="true"
          />
          <p
            className="mt-4"
            style={{ fontSize: '16px', color: 'var(--piano-muted-foreground)' }}
          >
            未找到匹配的曲目
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-2 transition-transform active:scale-95"
            style={{
              background: 'var(--piano-primary)',
              color: 'var(--piano-primary-foreground)',
              borderRadius: 'var(--piano-radius-md)',
              padding: '8px 20px',
              fontSize: '14px',
              fontFamily: 'var(--piano-font-display)',
              fontWeight: 600,
              border: 'none',
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} aria-hidden="true" />
            重置筛选
          </button>
        </div>
      )}

      {/* 底部固定操作条 */}
      {selectedSong && (
        <div
          className="fixed bottom-0 inset-x-0 flex items-center justify-between gap-4 px-4 sm:px-6"
          style={{
            background: 'var(--piano-card)',
            borderTop: '1px solid var(--piano-border)',
            padding: '16px 24px',
            zIndex: 50,
          }}
        >
          <span
            className="text-sm truncate min-w-0"
            style={{ color: 'var(--piano-foreground)', fontSize: '14px' }}
          >
            已选：{selectedSong.title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isSelectedAi && (
              <button
                type="button"
                onClick={handleDeleteAi}
                aria-label="删除 AI 曲目"
                className="inline-flex items-center gap-1.5 transition-transform active:scale-95"
                style={{
                  background: 'transparent',
                  color: 'var(--state-error)',
                  borderRadius: 'var(--piano-radius-md)',
                  padding: '10px 16px',
                  fontFamily: 'var(--piano-font-display)',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--state-error)',
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} aria-hidden="true" />
                删除
              </button>
            )}
            <button
              type="button"
              data-dom-id="cta-play-song"
              onClick={handlePlay}
              className="font-semibold whitespace-nowrap shrink-0 transition-transform active:scale-95"
              style={{
                background: 'var(--piano-primary)',
                color: 'var(--piano-primary-foreground)',
                borderRadius: 'var(--piano-radius-md)',
                padding: '10px 28px',
                fontFamily: 'var(--piano-font-display)',
                fontSize: '15px',
                fontWeight: 600,
                border: 'none',
              }}
            >
              开始跟弹
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
