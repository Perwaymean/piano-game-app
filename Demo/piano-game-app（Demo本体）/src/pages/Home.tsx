import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Piano,
  Target,
  WandSparkles,
  ArrowRight,
  Music,
  GraduationCap,
  Sparkles,
} from 'lucide-react'
import { getRecommendedSongs } from '@/engine/song-data'
import type { Difficulty } from '@/engine/storage'
import { useSettings } from '@/context/SettingsContext'
import heroImg from '@/assets/hero-starry-piano.jpg'

// 难度 → 文案 + 状态色（与判定色阶一致）
const DIFFICULTY_META: Record<Difficulty, { label: string; stateVar: string }> = {
  entry: { label: '入门', stateVar: 'var(--state-success)' },
  intermediate: { label: '进阶', stateVar: 'var(--state-info)' },
  challenge: { label: '挑战', stateVar: 'var(--state-warning)' },
}

export default function Home() {
  const navigate = useNavigate()
  const { update } = useSettings()
  // 无历史时返回入门曲；取 4 首用于横向滚动
  const songs = useMemo(() => getRecommendedSongs([], 4), [])

  // 点击「开始引导」：标记未完成引导并跳转自由弹奏，触发引导流程
  const handleStartGuide = () => {
    update({ onboarded: false })
    navigate('/free-play')
  }

  return (
    <>
      {/* ============ Hero ============ */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 sm:px-6 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, var(--piano-background) 50%, transparent), color-mix(in srgb, var(--piano-background) 82%, transparent)), url(${heroImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <h1
            style={{
              fontFamily: 'var(--piano-font-display)',
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 700,
              color: 'var(--piano-foreground)',
              lineHeight: 1.1,
              textWrap: 'balance',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            键盘即琴键
          </h1>
          <p
            className="max-w-md"
            style={{
              fontFamily: 'var(--piano-font-body)',
              fontSize: '18px',
              color: 'var(--piano-muted-foreground)',
              lineHeight: 1.6,
            }}
          >
            弹、跟、转，三秒听到第一个音
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              to="/free-play"
              data-dom-id="cta-free-play"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-8 py-3 text-base font-semibold transition-transform hover:scale-[1.02] w-full sm:w-auto"
              style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)' }}
            >
              立即弹奏
            </Link>
            <Link
              to="/ai-transcription"
              data-dom-id="cta-ai-transcription"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-8 py-3 text-base font-semibold transition-opacity hover:opacity-80 w-full sm:w-auto"
              style={{
                background: 'transparent',
                color: 'var(--piano-foreground)',
                border: '1px solid var(--piano-border)',
              }}
            >
              AI 转谱
            </Link>
            <Link
              to="/free-play?mode=3d"
              data-dom-id="cta-3d-piano"
              aria-label="3D 展示"
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-6 py-3 text-base font-semibold transition-opacity hover:opacity-80 w-full sm:w-auto"
              style={{
                background: 'transparent',
                color: 'var(--piano-cyan-400)',
                border: '1px solid var(--piano-cyan)',
              }}
            >
              <Sparkles className="h-4 w-4" /> 3D 展示
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 模式三栏（非等高卡片） ============ */}
      <section className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
            <ModeCard
              dataDomId="shortcut-free-play"
              to="/free-play"
              icon={<Piano className="h-5 w-5" />}
              iconBg="var(--piano-muted)"
              iconColor="var(--piano-primary)"
              title="自由弹奏"
              description="用键盘弹奏，四种音色随心切换，无需登录即开即弹。"
              minHeight={220}
            />
            <ModeCard
              dataDomId="shortcut-follow-play"
              to="/follow-play"
              icon={<Target className="h-5 w-5" />}
              iconBg="var(--piano-cyan-soft)"
              iconColor="var(--piano-cyan-400)"
              title="跟弹打分"
              description="下落音符 + 实时判定，像音游一样练琴，逐句打磨节奏与准度。"
              minHeight={260}
            />
            <ModeCard
              dataDomId="link-ai-transcription"
              to="/ai-transcription"
              icon={<WandSparkles className="h-5 w-5" />}
              iconBg="var(--piano-pink-soft)"
              iconColor="var(--piano-pink-400)"
              title="AI 转谱"
              description="上传音频，AI 自动生成可弹谱面，把任何旋律变成可练习的曲子。"
              minHeight={300}
            />
          </div>
        </div>
      </section>

      {/* ============ 为你推荐（横向滚动） ============ */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2
              className="text-2xl sm:text-3xl whitespace-nowrap"
              style={{
                fontFamily: 'var(--piano-font-display)',
                fontWeight: 700,
                color: 'var(--piano-foreground)',
              }}
            >
              为你推荐
            </h2>
            <Link
              to="/library"
              data-dom-id="cta-library"
              className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-80"
              style={{ color: 'var(--piano-primary)' }}
            >
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {songs.map((song) => {
              const meta = DIFFICULTY_META[song.difficulty]
              return (
                <Link
                  key={song.id}
                  to={`/follow-play?song=${song.id}`}
                  className="snap-start shrink-0 w-[170px] sm:w-[200px] rounded-lg p-3 flex flex-col gap-3 transition-transform hover:-translate-y-1"
                  style={{
                    background: 'var(--piano-card)',
                    border: '1px solid var(--piano-border)',
                  }}
                >
                  <div
                    className="aspect-square rounded-md flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`,
                      color: 'var(--piano-primary-foreground)',
                    }}
                  >
                    <Music className="h-7 w-7 opacity-90" />
                  </div>
                  <h4
                    className="text-base font-semibold truncate"
                    style={{
                      fontFamily: 'var(--piano-font-display)',
                      color: 'var(--piano-foreground)',
                    }}
                  >
                    {song.title}
                  </h4>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: `color-mix(in srgb, ${meta.stateVar} 16%, transparent)`,
                        color: meta.stateVar,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="text-xs whitespace-nowrap"
                      style={{
                        fontFamily: 'var(--piano-font-mono)',
                        color: 'var(--piano-muted-foreground)',
                      }}
                    >
                      {song.bpm} BPM
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ 新手引导入口 ============ */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24">
        <div
          className="max-w-6xl mx-auto rounded-lg p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
          style={{ background: 'var(--piano-card)', border: '1px solid var(--piano-border)' }}
        >
          <span
            className="inline-flex items-center justify-center h-12 w-12 shrink-0 rounded-lg"
            style={{ background: 'var(--piano-muted)', color: 'var(--piano-primary)' }}
          >
            <GraduationCap className="h-6 w-6" />
          </span>
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg sm:text-xl whitespace-nowrap"
              style={{
                fontFamily: 'var(--piano-font-display)',
                fontWeight: 600,
                color: 'var(--piano-foreground)',
              }}
            >
              第一次来？3 步学会弹琴
            </h3>
            <p
              className="text-sm mt-1"
              style={{
                fontFamily: 'var(--piano-font-body)',
                color: 'var(--piano-muted-foreground)',
              }}
            >
              新手引导带你认识键位映射，快速上手键盘弹奏。
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartGuide}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-6 py-2.5 text-sm font-semibold shrink-0 transition-opacity hover:opacity-90 w-full sm:w-auto"
            style={{ background: 'var(--piano-primary)', color: 'var(--piano-primary-foreground)' }}
          >
            开始引导
          </button>
        </div>
      </section>

      {/* ============ 页脚 ============ */}
      <footer className="px-4 sm:px-6 py-6 text-center">
        <p
          className="text-xs"
          style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}
        >
          © 2025 琴键飞舞 · 纯前端零后端 · TRAE AI Creative Competition
        </p>
      </footer>
    </>
  )
}

// ============ 模式卡片子组件 ============

interface ModeCardProps {
  dataDomId: string
  to: string
  icon: ReactNode
  iconBg: string
  iconColor: string
  title: string
  description: string
  minHeight: number
}

function ModeCard({
  dataDomId,
  to,
  icon,
  iconBg,
  iconColor,
  title,
  description,
  minHeight,
}: ModeCardProps) {
  return (
    <Link
      to={to}
      data-dom-id={dataDomId}
      className="group block rounded-lg p-6 transition-transform duration-200 hover:-translate-y-1"
      style={{
        background: 'var(--piano-card)',
        border: '1px solid var(--piano-border)',
        minHeight,
      }}
    >
      <div className="flex flex-col gap-3 h-full">
        <span
          className="inline-flex items-center justify-center h-11 w-11 rounded-lg"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </span>
        <h3
          className="text-xl whitespace-nowrap"
          style={{
            fontFamily: 'var(--piano-font-display)',
            fontWeight: 600,
            color: 'var(--piano-foreground)',
          }}
        >
          {title}
        </h3>
        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{
            fontFamily: 'var(--piano-font-body)',
            color: 'var(--piano-muted-foreground)',
          }}
        >
          {description}
        </p>
        <span
          className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap mt-1 transition-opacity group-hover:opacity-80"
          style={{ color: 'var(--piano-primary)' }}
        >
          开始 <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}
