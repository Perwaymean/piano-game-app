import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'
export type VisualStyle = 'starry' | 'sakura' | 'cyber'
export type Timbre = 'piano' | 'music_box' | 'pad' | '8bit' // 与 audio-engine Timbre 对齐
export type ColorBlindPalette = 'none' | 'deuteranopia' | 'protanopia'

export interface Settings {
  theme: Theme
  visualStyle: VisualStyle
  defaultTimbre: Timbre
  latencyOffsetMs: number // 延迟校准（毫秒）
  metronomeVolume: number // 0-1
  highContrast: boolean
  keyboardNav: boolean
  vibration: boolean
  colorBlindPalette: ColorBlindPalette
  cameraEnabled: boolean
  onboarded: boolean // 是否完成新手引导
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  visualStyle: 'starry',
  defaultTimbre: 'piano',
  latencyOffsetMs: 0,
  metronomeVolume: 0.5,
  highContrast: false,
  keyboardNav: true,
  vibration: false,
  colorBlindPalette: 'none',
  cameraEnabled: false,
  onboarded: false,
}

const STORAGE_KEY = 'piano.settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsContextValue {
  settings: Settings
  update: (partial: Partial<Settings>) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsContextProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  // 持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // 静默失败（隐私模式等）
    }
  }, [settings])

  // 同步 <html> 的 dark 类（控制深/浅主题）
  useEffect(() => {
    const html = document.documentElement
    if (settings.theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [settings.theme])

  // 同步色弱配色类（在 <html> 上添加 .color-blind）
  useEffect(() => {
    const html = document.documentElement
    if (settings.colorBlindPalette !== 'none') {
      html.classList.add('color-blind')
    } else {
      html.classList.remove('color-blind')
    }
  }, [settings.colorBlindPalette])

  // 同步高对比度（与 theme 联动：高对比度开启时强制 light）
  useEffect(() => {
    if (settings.highContrast) {
      setSettings((s) => ({ ...s, theme: 'light' }))
    }
  }, [settings.highContrast])

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...partial }))
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsContextProvider')
  return ctx
}
