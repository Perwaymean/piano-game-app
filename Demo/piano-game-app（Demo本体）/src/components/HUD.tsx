import type { JudgerStats } from '../engine/judger'

export interface HUDProps {
  stats: JudgerStats
  currentTime: number
  totalTime: number
  onPause?: () => void
  paused?: boolean
  className?: string
}

export default function HUD({ stats, currentTime, totalTime, onPause, paused, className = '' }: HUDProps) {
  const progressPct = totalTime > 0 ? Math.min(100, (currentTime / totalTime) * 100) : 0
  const accuracyPct = (stats.accuracy * 100).toFixed(1)

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-lg ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--piano-card) 85%, transparent)',
        border: '1px solid var(--piano-border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 暂停按钮 */}
      {onPause && (
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md shrink-0"
          style={{ background: 'var(--piano-muted)', color: 'var(--piano-foreground)', border: '1px solid var(--piano-border)' }}
          aria-label={paused ? '继续' : '暂停'}
        >
          {paused ? '▶' : '❚❚'}
        </button>
      )}

      {/* 大分数 */}
      <div className="flex flex-col items-start">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>分数</span>
        <span
          style={{
            fontFamily: 'var(--piano-font-mono)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--piano-foreground)',
            lineHeight: 1,
          }}
        >
          {stats.score.toLocaleString()}
        </span>
      </div>

      {/* 连击 */}
      <div className="flex flex-col items-start">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>连击</span>
        <span
          style={{
            fontFamily: 'var(--piano-font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            color: stats.combo >= 10 ? 'var(--state-success)' : 'var(--piano-foreground)',
            lineHeight: 1,
          }}
        >
          {stats.combo}
          {stats.combo >= 10 && <span className="text-xs ml-1" style={{ color: 'var(--state-success)' }}>×{1 + Math.floor(stats.combo / 10)}</span>}
        </span>
      </div>

      {/* 准确率 */}
      <div className="flex flex-col items-start">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--piano-muted-foreground)' }}>准确率</span>
        <span
          style={{
            fontFamily: 'var(--piano-font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--piano-foreground)',
            lineHeight: 1,
          }}
        >
          {accuracyPct}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="flex-1 flex flex-col gap-1 min-w-[100px]">
        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--piano-muted-foreground)' }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalTime)}</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--piano-muted)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, var(--piano-primary), var(--piano-cyan-400))',
            }}
          />
        </div>
      </div>

      {/* 评级 */}
      {stats.judgedNotes > 0 && (
        <div
          className="inline-flex items-center justify-center h-10 w-10 rounded-full text-lg font-bold shrink-0"
          style={{
            background: stats.rank === 'S' ? 'linear-gradient(135deg, var(--state-success), var(--piano-cyan-400))'
              : stats.rank === 'A' ? 'linear-gradient(135deg, var(--state-info), var(--piano-purple-400))'
              : stats.rank === 'B' ? 'linear-gradient(135deg, var(--state-warning), var(--piano-pink-400))'
              : 'var(--piano-muted)',
            color: stats.rank === 'C' ? 'var(--piano-foreground)' : 'var(--piano-primary-foreground)',
          }}
        >
          {stats.rank}
        </div>
      )}
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
