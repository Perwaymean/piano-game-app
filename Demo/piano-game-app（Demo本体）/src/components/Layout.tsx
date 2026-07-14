import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import ImmersiveBackground from './ImmersiveBackground'
import Onboarding from './Onboarding'
import { useSettings } from '../context/SettingsContext'

export default function Layout() {
  const { settings } = useSettings()
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  return (
    <>
      <ImmersiveBackground style={settings.visualStyle} />
      <TopBar onHelp={() => setOnboardingOpen(true)} />
      <main className="pt-14 min-h-screen">
        <Outlet />
      </main>
      <footer className="px-4 sm:px-6 py-6 text-center">
        <p className="text-xs" style={{ fontFamily: 'var(--piano-font-body)', color: 'var(--piano-muted-foreground)' }}>琴键飞舞 · 纯前端零后端</p>
      </footer>
      <Onboarding
        forceOpen={onboardingOpen}
        onComplete={() => setOnboardingOpen(false)}
      />
    </>
  )
}
