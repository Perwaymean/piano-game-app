import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Chart, registerables } from 'chart.js'
import { Zap, Target, Share2 } from 'lucide-react'
import { getSongById } from '@/engine/song-data'
import { addHistory, getRecentScoreValues } from '@/engine/storage'
import type { Rank } from '@/engine/storage'

Chart.register(...registerables)

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function Results() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const songId = params.get('song') ?? 'twinkle'
  const score = parseInt(params.get('score') ?? '0', 10)
  const rank = (params.get('rank') ?? 'C') as Rank
  const distribution = {
    perfect: parseInt(params.get('p') ?? '0', 10),
    great: parseInt(params.get('g') ?? '0', 10),
    good: parseInt(params.get('gd') ?? '0', 10),
    miss: parseInt(params.get('m') ?? '0', 10),
  }
  const maxCombo = parseInt(params.get('combo') ?? '0', 10)
  const accuracy = parseFloat(params.get('accuracy') ?? '0')

  const song = getSongById(songId)
  const songTitle = song?.title ?? songId

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyWrittenRef = useRef(false)
  const [toast, setToast] = useState(false)

  // 写入历史记录（仅一次）
  useEffect(() => {
    if (historyWrittenRef.current) return
    historyWrittenRef.current = true
    addHistory({
      songId,
      songTitle,
      difficulty: song?.difficulty ?? 'entry',
      score,
      maxScore: 0,
      rank,
      accuracy,
      maxCombo,
      distribution,
      timestamp: Date.now(),
    }).catch(() => {})
  }, [])

  // 近 10 次成绩趋势折线图
  useEffect(() => {
    let chart: Chart | null = null
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rootStyle = getComputedStyle(document.documentElement)
    const primary = (rootStyle.getPropertyValue('--piano-primary') || '#8b5cf6').trim()
    const gridColor = (rootStyle.getPropertyValue('--piano-border') || '#2a2545').trim()
    const tickColor = (rootStyle.getPropertyValue('--piano-muted-foreground') || '#a89fcf').trim()

    getRecentScoreValues(10).then((res) => {
      if (cancelled) return
      const scores = res.success && res.data ? res.data : []
      const gradient = ctx.createLinearGradient(0, 0, 0, 200)
      gradient.addColorStop(0, hexToRgba(primary, 0.35))
      gradient.addColorStop(1, hexToRgba(primary, 0))

      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: scores.map((_, i) => `${i + 1}`),
          datasets: [
            {
              label: '分数',
              data: scores,
              borderColor: primary,
              backgroundColor: gradient,
              fill: 'origin',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: primary,
              pointBorderColor: primary,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `分数 ${(item.parsed.y ?? 0).toLocaleString()}`,
              },
            },
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor } },
          },
        },
      })
    })

    return () => {
      cancelled = true
      chart?.destroy()
    }
  }, [])

  const rankBg =
    rank === 'S'
      ? 'linear-gradient(135deg, var(--state-success), var(--piano-cyan-400))'
      : rank === 'A'
        ? 'linear-gradient(135deg, var(--state-info), var(--piano-purple-400))'
        : rank === 'B'
          ? 'linear-gradient(135deg, var(--state-warning), var(--piano-pink-400))'
          : 'var(--piano-muted)'

  const total =
    distribution.perfect + distribution.great + distribution.good + distribution.miss
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  const handleShare = async () => {
    const text =
      `琴键飞舞 · ${songTitle} · ${rank} 评级\n` +
      `分数 ${score.toLocaleString()} · 准确率 ${(accuracy * 100).toFixed(1)}%\n` +
      `最大连击 ${maxCombo}\n` +
      `Perfect ${distribution.perfect} / Great ${distribution.great} / Good ${distribution.good} / Miss ${distribution.miss}`
    try {
      await navigator.clipboard.writeText(text)
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    } catch {
      /* 忽略剪贴板错误 */
    }
  }

  return (
    <div className="mx-auto w-full max-w-[700px] px-4 sm:px-6 pt-6 pb-10 text-center">
      {/* 1. 主分数区 */}
      <section className="flex flex-col items-center gap-3">
        <span
          className="text-xs uppercase"
          style={{ color: 'var(--piano-muted-foreground)', letterSpacing: '2px' }}
        >
          本曲成绩
        </span>
        <div
          style={{
            fontFamily: 'var(--piano-font-mono)',
            fontWeight: 700,
            fontSize: 'clamp(64px, 12vw, 120px)',
            lineHeight: 1,
            color: 'var(--piano-foreground)',
          }}
        >
          {score.toLocaleString()}
        </div>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
          style={{ background: rankBg }}
        >
          <span
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: '36px',
              fontWeight: 700,
              color:
                rank === 'C'
                  ? 'var(--piano-foreground)'
                  : 'var(--piano-primary-foreground)',
            }}
          >
            {rank}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--piano-foreground)',
            }}
          >
            {songTitle}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--piano-muted)', color: 'var(--piano-muted-foreground)' }}
          >
            演奏完成
          </span>
        </div>
      </section>

      {/* 2. 指标行：最大连击 + 准确率 */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6 my-8"
        style={{
          borderTop: '1px solid var(--piano-border)',
          borderBottom: '1px solid var(--piano-border)',
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <Zap className="h-6 w-6" style={{ color: 'var(--state-success)' }} />
          <div className="flex flex-col items-start">
            <span
              style={{
                fontFamily: 'var(--piano-font-mono)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--piano-foreground)',
                lineHeight: 1,
              }}
            >
              {maxCombo}
            </span>
            <span className="text-xs" style={{ color: 'var(--piano-muted-foreground)' }}>
              最大连击
            </span>
          </div>
        </div>
        <div
          className="flex items-center justify-center gap-3 sm:border-l"
          style={{ borderColor: 'var(--piano-border)' }}
        >
          <Target className="h-6 w-6" style={{ color: 'var(--piano-primary)' }} />
          <div className="flex flex-col items-start">
            <span
              style={{
                fontFamily: 'var(--piano-font-mono)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--piano-foreground)',
                lineHeight: 1,
              }}
            >
              {(accuracy * 100).toFixed(1)}%
            </span>
            <span className="text-xs" style={{ color: 'var(--piano-muted-foreground)' }}>
              准确率
            </span>
          </div>
        </div>
      </section>

      {/* 3. 判定分布 */}
      <section className="mb-8 text-left">
        <div className="text-sm mb-2" style={{ color: 'var(--piano-foreground)' }}>
          判定分布
        </div>
        <div
          className="flex w-full overflow-hidden"
          style={{
            height: '24px',
            borderRadius: 'var(--piano-radius-full)',
            background: 'var(--piano-muted)',
          }}
        >
          {pct(distribution.perfect) > 0 && (
            <div style={{ width: `${pct(distribution.perfect)}%`, background: 'var(--state-success)' }} />
          )}
          {pct(distribution.great) > 0 && (
            <div style={{ width: `${pct(distribution.great)}%`, background: 'var(--state-info)' }} />
          )}
          {pct(distribution.good) > 0 && (
            <div style={{ width: `${pct(distribution.good)}%`, background: 'var(--state-warning)' }} />
          )}
          {pct(distribution.miss) > 0 && (
            <div style={{ width: `${pct(distribution.miss)}%`, background: 'var(--state-error)' }} />
          )}
        </div>
        <div
          className="flex flex-wrap gap-x-4 gap-y-2 mt-3"
          style={{ fontFamily: 'var(--piano-font-mono)', fontSize: '12px' }}
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--state-success)' }} />
            <span style={{ color: 'var(--piano-muted-foreground)' }}>Perfect</span>
            <span style={{ color: 'var(--state-success)' }}>{distribution.perfect}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--state-info)' }} />
            <span style={{ color: 'var(--piano-muted-foreground)' }}>Great</span>
            <span style={{ color: 'var(--state-info)' }}>{distribution.great}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--state-warning)' }} />
            <span style={{ color: 'var(--piano-muted-foreground)' }}>Good</span>
            <span style={{ color: 'var(--state-warning)' }}>{distribution.good}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--state-error)' }} />
            <span style={{ color: 'var(--piano-muted-foreground)' }}>Miss</span>
            <span style={{ color: 'var(--state-error)' }}>{distribution.miss}</span>
          </span>
        </div>
      </section>

      {/* 4. 近 10 次成绩趋势折线图 */}
      <section className="text-left mb-8">
        <div className="text-sm mb-3" style={{ color: 'var(--piano-foreground)' }}>
          近 10 次成绩趋势
        </div>
        <div
          style={{
            background: 'var(--piano-card)',
            borderRadius: 'var(--piano-radius-lg)',
            padding: '16px',
          }}
        >
          <div style={{ position: 'relative', height: '200px' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </section>

      {/* 5. 操作区 */}
      <section className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
        <button
          type="button"
          data-dom-id="cta-retry"
          onClick={() => navigate(`/follow-play?song=${encodeURIComponent(songId)}`)}
          className="px-8 py-3 rounded-md font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
          style={{
            background: 'var(--piano-primary)',
            color: 'var(--piano-primary-foreground)',
            fontFamily: 'var(--piano-font-display)',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          再来一次
        </button>
        <button
          type="button"
          data-dom-id="shortcut-library"
          onClick={() => navigate('/library')}
          className="px-8 py-3 rounded-md whitespace-nowrap inline-flex items-center justify-center transition-opacity hover:opacity-90"
          style={{
            border: '1px solid var(--piano-border)',
            color: 'var(--piano-foreground)',
            fontFamily: 'var(--piano-font-display)',
            fontSize: '15px',
          }}
        >
          换一首
        </button>
        <button
          type="button"
          data-dom-id="cta-share"
          onClick={handleShare}
          className="px-6 py-3 rounded-md whitespace-nowrap inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            border: '1px solid var(--piano-border)',
            color: 'var(--piano-foreground)',
            fontFamily: 'var(--piano-font-display)',
            fontSize: '15px',
          }}
        >
          <Share2 className="h-4 w-4" />
          <span>分享成绩</span>
        </button>
      </section>

      {/* 已复制 Toast */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md text-sm"
          style={{
            bottom: '32px',
            background: 'var(--piano-card)',
            color: 'var(--piano-foreground)',
            border: '1px solid var(--piano-border)',
          }}
        >
          已复制
        </div>
      )}
    </div>
  )
}
