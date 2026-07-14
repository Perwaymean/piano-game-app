import { useEffect, useRef, useState, useCallback } from 'react'

export interface UseKeyboardInputOptions {
  onPress: (key: string) => void       // 按下回调，key 已转小写
  onRelease?: (key: string) => void    // 抬起回调
  onOctaveUp?: () => void              // → 键按下
  onOctaveDown?: () => void            // ← 键按下
  enabled?: boolean                    // 默认 true
}

export interface UseKeyboardInputResult {
  pressedKeys: Set<string>             // 当前按下的物理键集合（小写）
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  return INPUT_TAGS.has(el.tagName)
}

export function useKeyboardInput(opts: UseKeyboardInputOptions): UseKeyboardInputResult {
  const { onPress, onRelease, onOctaveUp, onOctaveDown, enabled = true } = opts
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())
  // 用 ref 存最新回调，避免 effect 频繁重建
  const cbRef = useRef({ onPress, onRelease, onOctaveUp, onOctaveDown })
  cbRef.current = { onPress, onRelease, onOctaveUp, onOctaveDown }

  // pressedKeys 也用 ref 存一份，避免 setPressedKeys 异步问题
  const pressedRef = useRef<Set<string>>(new Set())

  const updatePressed = useCallback((next: Set<string>) => {
    pressedRef.current = next
    setPressedKeys(next)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框焦点
      if (isInputFocused()) return
      // 忽略 repeat
      if (e.repeat) return
      // 忽略修饰键组合（Ctrl/Cmd/Alt + 字母）
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()
      // 八度控制：仅方向键 ← →（Z/X 已用作白键 C/D）
      if (key === 'arrowleft') {
        cbRef.current.onOctaveDown?.()
        return
      }
      if (key === 'arrowright') {
        cbRef.current.onOctaveUp?.()
        return
      }
      // 仅响应字母键和数字键（数字键用于上八度黑键 2/3/5/6/7）
      if (!/^[a-z0-9]$/.test(key)) return

      // 加入按下集合
      if (!pressedRef.current.has(key)) {
        const next = new Set(pressedRef.current)
        next.add(key)
        updatePressed(next)
      }
      cbRef.current.onPress?.(key)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return
      const key = e.key.toLowerCase()
      if (!/^[a-z0-9]$/.test(key)) return
      if (pressedRef.current.has(key)) {
        const next = new Set(pressedRef.current)
        next.delete(key)
        updatePressed(next)
      }
      cbRef.current.onRelease?.(key)
    }

    // 失焦时清空所有按下状态
    const handleBlur = () => {
      if (pressedRef.current.size > 0) {
        updatePressed(new Set())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [enabled, updatePressed])

  return { pressedKeys }
}
