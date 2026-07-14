import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AudioEngine } from '../engine/audio-engine'

interface AudioContextValue {
  engine: AudioEngine
  ready: boolean
  resume: () => Promise<void>
}

const AudioCtx = createContext<AudioContextValue | null>(null)

export function AudioContextProvider({ children }: { children: ReactNode }) {
  // 单例：useRef 保证跨 re-render 不重建
  const engineRef = useRef<AudioEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new AudioEngine()
  }
  const [ready, setReady] = useState(false)

  // 首次用户交互时 resume AudioContext（iOS Safari 要求）
  useEffect(() => {
    const engine = engineRef.current!
    const onFirstInteraction = async () => {
      try {
        await engine.resume()
        setReady(true)
        // resume 成功后移除监听
        window.removeEventListener('pointerdown', onFirstInteraction)
        window.removeEventListener('keydown', onFirstInteraction)
      } catch {
        // 静默失败
      }
    }
    if (engine.state === 'running') {
      setReady(true)
    } else {
      window.addEventListener('pointerdown', onFirstInteraction)
      window.addEventListener('keydown', onFirstInteraction)
    }
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
  }, [])

  const resume = async () => {
    await engineRef.current!.resume()
    setReady(true)
  }

  return (
    <AudioCtx.Provider value={{ engine: engineRef.current, ready, resume }}>
      {children}
    </AudioCtx.Provider>
  )
}

export function useAudioEngine(): AudioContextValue {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudioEngine must be used within AudioContextProvider')
  return ctx
}
