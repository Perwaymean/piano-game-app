import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Palette, HelpCircle } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

const STYLE_OPTIONS = [
  { key: 'starry', label: '星空' },
  { key: 'sakura', label: '樱花' },
  { key: 'cyber', label: '赛博' },
] as const

interface TopBarProps {
  onHelp?: () => void
}

export default function TopBar({ onHelp }: TopBarProps) {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const { settings, update } = useSettings()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap text-sm sm:text-base transition-opacity hover:opacity-80 ${
      isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
    }`

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between gap-2 px-4 sm:px-6"
      style={{ background: 'var(--piano-card)', borderBottom: '1px solid var(--piano-border)' }}
    >
      <Link
        to="/"
        data-dom-id="back-home"
        className="shrink-0 whitespace-nowrap"
        style={{
          fontFamily: 'var(--piano-font-display)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--piano-foreground)',
        }}
      >
        琴键飞舞
      </Link>

      <nav className="flex items-center gap-3 sm:gap-6">
        <NavLink to="/" data-dom-id="nav-home" end className={navClass}>
          首页
        </NavLink>
        <NavLink to="/library" data-dom-id="nav-library" className={navClass}>
          曲库
        </NavLink>
        <NavLink to="/settings" data-dom-id="nav-settings" className={navClass}>
          设置
        </NavLink>
      </nav>

      <div className="flex items-center gap-1 shrink-0 relative">
        <button
          type="button"
          aria-label="切换主题"
          onClick={() => setStyleMenuOpen((v) => !v)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md transition-opacity hover:opacity-80"
          style={{ color: 'var(--piano-muted-foreground)' }}
        >
          <Palette className="h-5 w-5" />
        </button>
        {styleMenuOpen && (
          <div
            className="absolute right-0 top-11 min-w-32 rounded-md p-1 flex flex-col gap-1"
            style={{ background: 'var(--piano-popover)', border: '1px solid var(--piano-border)' }}
          >
            {STYLE_OPTIONS.map((opt) => {
              const active = settings.visualStyle === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  className="text-left text-sm px-3 py-1.5 rounded transition-opacity hover:opacity-80"
                  style={{
                    color: active ? 'var(--piano-primary)' : 'var(--piano-foreground)',
                    fontWeight: active ? 600 : 400,
                  }}
                  onClick={() => {
                    update({ visualStyle: opt.key })
                    setStyleMenuOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          aria-label="帮助"
          onClick={onHelp}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md transition-opacity hover:opacity-80"
          style={{ color: 'var(--piano-muted-foreground)' }}
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
