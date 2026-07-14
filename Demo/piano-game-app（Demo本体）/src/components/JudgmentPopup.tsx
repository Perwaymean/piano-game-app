import { useEffect, useState } from 'react'
import type { JudgmentTier } from '../engine/judger'

export interface JudgmentPopupItem {
  id: number
  tier: JudgmentTier
  offsetMs: number
}

export interface JudgmentPopupProps {
  items: JudgmentPopupItem[]      // 父组件推入新判定（带唯一 id）
  className?: string
}

const TIER_CONFIG: Record<JudgmentTier, { label: string; color: string }> = {
  perfect: { label: 'Perfect!', color: 'var(--state-success)' },  // 青
  great: { label: 'Great', color: 'var(--state-info)' },          // 紫
  good: { label: 'Good', color: 'var(--state-warning)' },         // 粉
  miss: { label: 'Miss', color: 'var(--state-error)' },           // 红
}

export default function JudgmentPopup({ items, className = '' }: JudgmentPopupProps) {
  // 仅保留最近 5 条
  const visible = items.slice(-5)
  return (
    <div className={`pointer-events-none flex flex-col items-center gap-1 ${className}`}>
      {visible.map((item, idx) => (
        <PopupLine key={item.id} item={item} idx={idx} />
      ))}
    </div>
  )
}

function PopupLine({ item, idx }: { item: JudgmentPopupItem; idx: number }) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const cfg = TIER_CONFIG[item.tier]

  useEffect(() => {
    setPhase('in')
    const timer = setTimeout(() => setPhase('out'), 50)
    return () => clearTimeout(timer)
  }, [item.id])

  return (
    <div
      style={{
        fontFamily: 'var(--piano-font-display)',
        fontSize: '28px',
        fontWeight: 700,
        color: cfg.color,
        textShadow: `0 0 20px ${cfg.color}, 0 2px 8px rgba(0,0,0,0.5)`,
        transform: phase === 'in' ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.9)',
        // 越早的判定越淡，且淡出时透明度归零
        opacity: phase === 'in' ? 1 - idx * 0.15 : 0,
        transition: 'transform 320ms cubic-bezier(.2,.8,.2,1), opacity 320ms ease-out',
      }}
    >
      {cfg.label}
      {Math.abs(item.offsetMs) > 0 && item.tier !== 'miss' && (
        <span style={{ fontSize: '14px', marginLeft: '6px', opacity: 0.7 }}>
          {item.offsetMs > 0 ? '+' : ''}{item.offsetMs.toFixed(0)}ms
        </span>
      )}
    </div>
  )
}

// 工具：生成唯一 id（供父组件使用）
let popupIdCounter = 0
export function nextPopupId(): number {
  return ++popupIdCounter
}
