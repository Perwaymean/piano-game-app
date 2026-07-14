import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: number; type: ToastType; message: string }
interface ToastContextValue { show: (type: ToastType, message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => <ToastLine key={t.id} item={t} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const CONFIG: Record<ToastType, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle, color: 'var(--state-success)' },
  error: { icon: AlertCircle, color: 'var(--state-error)' },
  warning: { icon: AlertTriangle, color: 'var(--state-warning)' },
  info: { icon: Info, color: 'var(--state-info)' },
}

function ToastLine({ item }: { item: ToastItem }) {
  const cfg = CONFIG[item.type]
  const Icon = cfg.icon
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg pointer-events-auto"
      style={{ background: 'var(--piano-popover)', border: '1px solid var(--piano-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
      <span className="text-sm" style={{ color: 'var(--piano-foreground)' }}>{item.message}</span>
    </div>
  )
}
