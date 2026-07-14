import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ChevronsUpDown, Keyboard, Upload } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettings } from '@/context/SettingsContext'

export interface OnboardingStep {
  title: string
  description: string
  icon?: string // lucide icon name
  selector?: string // CSS selector for highlight target (optional)
}

export interface OnboardingProps {
  steps?: OnboardingStep[]
  onComplete?: () => void
  forceOpen?: boolean // 外部强制打开（如顶栏帮助按钮）
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    title: '键盘即琴键',
    description:
      '下八度白键：Z X C V B N M，黑键：S D G H J。上八度白键：Q W E R T Y U，黑键：2 3 5 6 7。← → 方向键切换八度。',
    icon: 'Keyboard',
  },
  {
    title: '看下落音符',
    description:
      '跟弹模式中，音符从上往下落。当音符到达底部判定线时按下对应键，越准时分数越高。',
    icon: 'ArrowDown',
  },
  {
    title: '切换八度',
    description: '按 ← 降低八度，按 → 升高八度。键盘指示器会显示当前八度（如 C4）。',
    icon: 'ChevronsUpDown',
  },
  {
    title: '上传转谱',
    description:
      '在 AI 转谱页上传音频文件，系统会自动识别音符生成谱面，即可跟弹你的专属曲目。',
    icon: 'Upload',
  },
]

const ICON_MAP: Record<string, LucideIcon> = {
  Keyboard,
  ArrowDown,
  ChevronsUpDown,
  Upload,
}

export default function Onboarding({
  steps = DEFAULT_STEPS,
  onComplete,
  forceOpen = false,
}: OnboardingProps) {
  const { settings, update } = useSettings()
  const [currentStep, setCurrentStep] = useState(0)
  const [open, setOpen] = useState(forceOpen || !settings.onboarded)

  const handleComplete = useCallback(() => {
    setOpen(false)
    update({ onboarded: true })
    onComplete?.()
  }, [onComplete, update])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }, [currentStep, steps.length, handleComplete])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }, [currentStep])

  const handleSkip = useCallback(() => {
    handleComplete()
  }, [handleComplete])

  // 外部 forceOpen 变 true 时重新打开（如点击帮助按钮）
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  // 键盘支持：Enter 下一步/完成，Escape 跳过，左右箭头切换
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handleNext()
          break
        case 'Escape':
          e.preventDefault()
          handleSkip()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrev()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, handleNext, handlePrev, handleSkip])

  if (!open || steps.length === 0) return null

  const step = steps[currentStep]
  const Icon = step.icon ? ICON_MAP[step.icon] : null
  const isLast = currentStep === steps.length - 1

  return (
    <>
      <style>{`
        @keyframes onboarding-card-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes onboarding-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        style={{
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="新手引导"
          className="w-full"
          style={{
            maxWidth: '480px',
            background: 'var(--piano-card)',
            border: '1px solid var(--piano-border)',
            borderRadius: 'var(--piano-radius-lg)',
            padding: '32px',
            color: 'var(--piano-card-foreground)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'onboarding-card-in 300ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: '8px',
                  height: '8px',
                  background:
                    i === currentStep
                      ? 'var(--piano-primary)'
                      : 'var(--piano-muted)',
                }}
              />
            ))}
          </div>

          {/* 内容区（key 触发淡入） */}
          <div key={currentStep} style={{ animation: 'onboarding-fade 200ms ease' }}>
            {Icon && (
              <div className="flex justify-center mb-4">
                <Icon size={48} color="var(--piano-primary)" strokeWidth={1.75} />
              </div>
            )}
            <h2
              className="text-center mb-3"
              style={{
                fontFamily: 'var(--piano-font-display)',
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--piano-foreground)',
                lineHeight: 1.25,
              }}
            >
              {step.title}
            </h2>
            <p
              className="text-center mb-6"
              style={{
                fontSize: '16px',
                color: 'var(--piano-muted-foreground)',
                lineHeight: 1.6,
              }}
            >
              {step.description}
            </p>
          </div>

          {/* 进度文字 */}
          <div
            className="text-center mb-5"
            style={{
              fontFamily: 'var(--piano-font-mono)',
              fontSize: '13px',
              color: 'var(--piano-muted-foreground)',
              letterSpacing: '0.05em',
            }}
          >
            {currentStep + 1} / {steps.length}
          </div>

          {/* 按钮区 */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm transition-opacity hover:opacity-80"
              style={{
                color: 'var(--piano-muted-foreground)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 4px',
              }}
            >
              跳过
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="text-sm px-4 py-2 rounded-md transition-opacity hover:opacity-80"
                  style={{
                    color: 'var(--piano-foreground)',
                    background: 'var(--piano-muted)',
                    border: '1px solid var(--piano-border)',
                    cursor: 'pointer',
                  }}
                >
                  上一步
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="text-sm font-semibold px-5 py-2 rounded-md transition-opacity hover:opacity-90"
                style={{
                  color: 'var(--piano-primary-foreground)',
                  background: 'var(--piano-primary)',
                  border: '1px solid var(--piano-primary)',
                  cursor: 'pointer',
                }}
              >
                {isLast ? '完成' : '下一步'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
