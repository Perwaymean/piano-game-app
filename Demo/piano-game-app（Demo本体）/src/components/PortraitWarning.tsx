import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'

export default function PortraitWarning() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setShow(e.matches)
    setShow(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-8" style={{ background: 'var(--piano-background)' }}>
      <div className="flex flex-col items-center gap-4 text-center">
        <RotateCw className="w-16 h-16 animate-spin" style={{ color: 'var(--piano-primary)', animationDuration: '2s' }} />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--piano-foreground)' }}>请横屏使用</h2>
        <p style={{ color: 'var(--piano-muted-foreground)' }}>旋转设备至横屏以获得最佳弹奏体验</p>
      </div>
    </div>
  )
}
